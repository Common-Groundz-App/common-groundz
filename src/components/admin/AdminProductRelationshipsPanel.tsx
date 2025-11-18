import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, TrendingUp, GitCompare, Link2, Eye, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const AdminProductRelationshipsPanel = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStats, setExtractionStats] = useState<any>(null);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [relationshipFilter, setRelationshipFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, upgrade: 0, alternative: 0, complement: 0, avgConfidence: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadRelationships();
    loadStats();
  }, [relationshipFilter]);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('product_relationships')
        .select('relationship_type, confidence_score');

      if (error) throw error;

      const total = data.length;
      const upgrade = data.filter(r => r.relationship_type === 'upgrade').length;
      const alternative = data.filter(r => r.relationship_type === 'alternative').length;
      const complement = data.filter(r => r.relationship_type === 'complement').length;
      const avgConfidence = total > 0 ? data.reduce((sum, r) => sum + r.confidence_score, 0) / total : 0;

      setStats({ total, upgrade, alternative, complement, avgConfidence });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRelationships = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('product_relationships')
        .select(`
          id, 
          relationship_type, 
          confidence_score, 
          evidence_text, 
          created_at,
          entities_a:entity_a_id(id, name, image_url, type),
          entities_b:entity_b_id(id, name, image_url, type)
        `)
        .gte('confidence_score', 0.6)
        .order('created_at', { ascending: false });

      if (relationshipFilter !== 'all') {
        query = query.eq('relationship_type', relationshipFilter);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setRelationships(data || []);
    } catch (error) {
      console.error('Error loading relationships:', error);
      toast.error('Failed to load relationships');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtract = async (limit: number, dryRun: boolean = false) => {
    try {
      setIsExtracting(true);
      setExtractionStats(null);
      setPreviewMode(dryRun);

      const { data, error } = await supabase.functions.invoke('extract-product-relationships', {
        body: { 
          batchMode: true, 
          limit,
          skipProcessed: true,
          dryRun
        }
      });

      if (error) throw error;

      setExtractionStats(data);

      if (dryRun) {
        toast.success(
          `Preview complete! Found ${data.extractedRelationships} potential relationships (not saved)`,
          { duration: 5000 }
        );
      } else {
        toast.success(
          `Extraction complete! Processed: ${data.processedReviews}, Extracted: ${data.extractedRelationships} relationships`
        );
        await loadRelationships();
        await loadStats();
      }
    } catch (error: any) {
      console.error('Extraction error:', error);
      toast.error('Extraction failed: ' + error.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const getRelationshipIcon = (type: string) => {
    switch (type) {
      case 'upgrade': return <TrendingUp className="h-4 w-4" />;
      case 'alternative': return <GitCompare className="h-4 w-4" />;
      case 'complement': return <Link2 className="h-4 w-4" />;
      default: return null;
    }
  };

  const getRelationshipColor = (type: string) => {
    switch (type) {
      case 'upgrade': return 'bg-green-500';
      case 'alternative': return 'bg-blue-500';
      case 'complement': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Relationships</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{stats.upgrade}</div>
            <p className="text-xs text-muted-foreground">Upgrades</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{stats.alternative}</div>
            <p className="text-xs text-muted-foreground">Alternatives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-500">{stats.complement}</div>
            <p className="text-xs text-muted-foreground">Complements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{(stats.avgConfidence * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Avg Confidence</p>
          </CardContent>
        </Card>
      </div>

      {/* Extraction Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Extract Product Relationships</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleExtract(5, true)}
              disabled={isExtracting}
              variant="outline"
              className="border-yellow-500 text-yellow-600"
            >
              {isExtracting && previewMode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Eye className="mr-2 h-4 w-4" />
              🔍 Preview (5 Reviews)
            </Button>
            <Button
              onClick={() => handleExtract(10, false)}
              disabled={isExtracting}
            >
              {isExtracting && !previewMode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Extract from Recent 10
            </Button>
            <Button
              onClick={() => handleExtract(50, false)}
              disabled={isExtracting}
              variant="secondary"
            >
              {isExtracting && !previewMode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Extract from Recent 50
            </Button>
          </div>

          {extractionStats && (
            <div className={`p-4 rounded-lg space-y-2 ${extractionStats.dryRun ? 'bg-yellow-50 border border-yellow-200' : 'bg-muted'}`}>
              {extractionStats.dryRun && (
                <Alert className="mb-2 bg-yellow-100 border-yellow-300">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Preview Mode:</strong> No changes were saved to database. Review results below.
                  </AlertDescription>
                </Alert>
              )}
              <p><strong>Processed:</strong> {extractionStats.processedReviews} reviews</p>
              <p><strong>Skipped:</strong> {extractionStats.skippedReviews} (too short or already processed)</p>
              <p><strong>Found:</strong> {extractionStats.extractedRelationships} relationships</p>
              <p><strong>Errors:</strong> {extractionStats.errors}</p>

              {extractionStats.relationships && extractionStats.relationships.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h4 className="font-semibold">
                    {extractionStats.dryRun ? 'Preview Results (not saved):' : 'Extracted Relationships:'}
                  </h4>
                  {extractionStats.relationships[0]?.source_entity_name && (
                    <p className="text-sm text-muted-foreground mb-3 pb-2 border-b">
                      <strong>Extracting relationships from:</strong> {extractionStats.relationships[0].source_entity_name}
                    </p>
                  )}
                  {extractionStats.relationships.map((rel: any, idx: number) => (
                    <div key={idx} className="border rounded p-3 bg-background space-y-2">
                      {/* Relationship type badge and metadata */}
                      <div className="flex items-center gap-2">
                        <Badge className={getRelationshipColor(rel.relationship_type)}>
                          {getRelationshipIcon(rel.relationship_type)}
                          <span className="ml-1">{rel.relationship_type}</span>
                        </Badge>
                        <Badge variant="outline">{(rel.confidence * 100).toFixed(0)}%</Badge>
                        {rel.preview && rel.matched_via && (
                          <Badge variant="secondary" className="text-xs">
                            {rel.matched_via} match
                          </Badge>
                        )}
                      </div>
                      
                      {/* Show explicit source → target */}
                      <div className="text-sm space-y-1">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground font-medium min-w-[50px]">From:</span>
                          <span className="text-foreground">{rel.source_entity_name}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground font-medium min-w-[50px]">To:</span>
                          <span className="text-foreground font-medium">{rel.target_entity_name}</span>
                        </div>
                      </div>
                      
                      {/* Evidence quote */}
                      {rel.evidence && (
                        <p className="text-sm text-muted-foreground italic border-t pt-2">"{rel.evidence}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relationship Browser */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Discovered Relationships (≥60% confidence)</CardTitle>
            <Select value={relationshipFilter} onValueChange={setRelationshipFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="upgrade">Upgrades</SelectItem>
                <SelectItem value="alternative">Alternatives</SelectItem>
                <SelectItem value="complement">Complements</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : relationships.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">
              No relationships found. Run extraction to discover relationships from reviews.
            </p>
          ) : (
            <div className="space-y-4">
              {relationships.map((rel) => (
                <div key={rel.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    {rel.entities_a?.image_url && (
                      <img
                        src={rel.entities_a.image_url}
                        alt={rel.entities_a.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{rel.entities_a?.name}</span>
                        <span className="text-muted-foreground">→</span>
                        <Badge className={getRelationshipColor(rel.relationship_type)}>
                          {getRelationshipIcon(rel.relationship_type)}
                          <span className="ml-1">{rel.relationship_type}</span>
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{rel.entities_b?.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Confidence: {(rel.confidence_score * 100).toFixed(0)}%
                      </p>
                    </div>
                    {rel.entities_b?.image_url && (
                      <img
                        src={rel.entities_b.image_url}
                        alt={rel.entities_b.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                    )}
                  </div>
                  {rel.evidence_text && (
                    <div className="bg-muted p-3 rounded text-sm italic">
                      "{rel.evidence_text}"
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Discovered: {new Date(rel.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
