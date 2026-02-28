import React, { useState } from 'react';
import { Bookmark, Trash2, ArrowRight, ExternalLink, StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
import SEOHead from '@/components/seo/SEOHead';
import { Link, useNavigate } from 'react-router-dom';
import { useSavedInsights } from '@/hooks/use-saved-insights';
import { SavedInsight } from '@/services/savedInsightsService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';

const SavedInsightCard: React.FC<{
  insight: SavedInsight;
  onRemove: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}> = ({ insight, onRemove, onUpdateNotes }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(insight.notes || '');
  const navigate = useNavigate();

  const insightData = insight.insight_data as {
    headline?: string;
    description?: string;
    from_entity?: { name: string; slug?: string };
    to_entity?: { name: string; slug?: string };
    transition_type?: string;
    confidence?: string;
    sentiment_change?: string;
    evidence_quote?: string;
  };

  const handleSaveNotes = () => {
    onUpdateNotes(insight.id, notes);
    setEditingNotes(false);
  };

  const getTransitionTypeColor = (type?: string) => {
    switch (type) {
      case 'upgrade': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'alternative': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'complementary': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base line-clamp-2">
              {insightData.headline || 'Saved Insight'}
            </CardTitle>
            {insightData.transition_type && (
              <Badge variant="outline" className={`mt-2 ${getTransitionTypeColor(insightData.transition_type)}`}>
                {insightData.transition_type}
              </Badge>
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove saved insight?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove this insight from your saved collection.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRemove(insight.id)}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Entity journey visualization */}
        {insightData.from_entity && insightData.to_entity && (
          <div className="flex items-center gap-2 text-sm">
            <button 
              onClick={() => insightData.from_entity?.slug && navigate(`/entity/${insightData.from_entity.slug}`)}
              className="font-medium hover:text-primary transition-colors"
            >
              {insightData.from_entity.name}
            </button>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <button
              onClick={() => insightData.to_entity?.slug && navigate(`/entity/${insightData.to_entity.slug}`)}
              className="font-medium hover:text-primary transition-colors"
            >
              {insightData.to_entity.name}
            </button>
          </div>
        )}

        {/* Description */}
        {insightData.description && (
          <p className="text-sm text-muted-foreground">{insightData.description}</p>
        )}

        {/* Expandable details */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {isExpanded ? 'Show less' : 'Show more'}
        </button>

        {isExpanded && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            {/* Sentiment change */}
            {insightData.sentiment_change && (
              <div className="text-xs">
                <span className="text-muted-foreground">Sentiment: </span>
                <span className={insightData.sentiment_change.includes('+') ? 'text-green-600' : 'text-muted-foreground'}>
                  {insightData.sentiment_change}
                </span>
              </div>
            )}

            {/* Evidence quote */}
            {insightData.evidence_quote && (
              <blockquote className="text-xs italic border-l-2 border-primary/30 pl-3 text-muted-foreground">
                "{insightData.evidence_quote}"
              </blockquote>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StickyNote className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium">Your notes</span>
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your notes..."
                    className="text-sm min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveNotes}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setEditingNotes(true)}
                  className="w-full text-left text-xs text-muted-foreground p-2 rounded border border-dashed border-border hover:border-primary/50 transition-colors"
                >
                  {notes || 'Click to add notes...'}
                </button>
              )}
            </div>

            {/* Saved date */}
            <p className="text-xs text-muted-foreground">
              Saved on {new Date(insight.created_at).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const SavedInsights: React.FC = () => {
  const { insights, isLoading, removeInsight, updateNotes } = useSavedInsights();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <VerticalTubelightNavbar />}

      <div className={`transition-all duration-300 ${!isMobile ? 'ml-[280px]' : ''}`}>
        <div className="container mx-auto px-4 py-8 pb-24 md:pb-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bookmark className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Saved Insights</h1>
              <p className="text-sm text-muted-foreground">
                Your bookmarked journey recommendations and discoveries
              </p>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No saved insights yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                When you find helpful journey recommendations, bookmark them here for easy access later.
              </p>
              <Link to="/my-stuff">
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Browse My Stuff
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {insights.length} saved insight{insights.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map(insight => (
                  <SavedInsightCard 
                    key={insight.id} 
                    insight={insight}
                    onRemove={removeInsight}
                    onUpdateNotes={updateNotes}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default SavedInsights;
