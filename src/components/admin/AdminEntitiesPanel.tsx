
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, MapPin, Calendar, Loader2 } from 'lucide-react';
import { useAdminEntitiesPanel } from '@/hooks/admin/useAdminEntitiesPanel';
import { formatRelativeDate } from '@/utils/dateUtils';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { AdminEntity } from '@/types/admin';

export const AdminEntitiesPanel = () => {
  const { entities, isLoading, isGenerating, isBulkGenerating, generateEntitySummary, generateBulkEntitySummaries } = useAdminEntitiesPanel();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Entity AI Summaries
          </CardTitle>
          <CardDescription>
            Generate AI summaries for entities with dynamic reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading entities...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Entity AI Summaries
          </CardTitle>
          <CardDescription>
            Generate AI summaries for entities with dynamic reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No entities found with dynamic reviews</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Entity AI Summaries ({entities.length})
            </CardTitle>
            <CardDescription>
              Generate and manage AI summaries for entities with dynamic reviews
            </CardDescription>
          </div>
          <Button
            onClick={generateBulkEntitySummaries}
            disabled={isBulkGenerating || isLoading}
            className="gap-2"
          >
            {isBulkGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate All Entity Summaries
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {entities.map((entity: AdminEntity) => {
            const hasGeneratedSummary = !!entity.ai_dynamic_review_summary;
            const isCurrentlyGenerating = isGenerating[entity.id];
            
            return (
              <div
                key={entity.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-card"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Entity Image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <ImageWithFallback
                      src={entity.image_url}
                      alt={entity.name}
                      className="w-full h-full object-cover"
                      entityType={entity.type}
                    />
                  </div>
                  
                  {/* Entity Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{entity.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {entity.type}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{entity.dynamic_review_count} dynamic review{entity.dynamic_review_count !== 1 ? 's' : ''}</span>
                      
                      {hasGeneratedSummary ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Generated
                          </Badge>
                          {entity.ai_dynamic_review_summary_last_generated_at && (
                            <div className="flex items-center gap-1 text-xs">
                              <Calendar className="h-3 w-3" />
                              {formatRelativeDate(entity.ai_dynamic_review_summary_last_generated_at)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                          Not Generated
                        </Badge>
                      )}
                    </div>
                    
                    {hasGeneratedSummary && entity.ai_dynamic_review_summary && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {entity.ai_dynamic_review_summary}
                      </p>
                    )}
                    
                    {hasGeneratedSummary && entity.ai_dynamic_review_summary_model_used && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Model: {entity.ai_dynamic_review_summary_model_used}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Action Button */}
                <div className="flex-shrink-0 ml-4">
                  <Button
                    onClick={() => generateEntitySummary(entity.id)}
                    disabled={isCurrentlyGenerating}
                    variant={hasGeneratedSummary ? "outline" : "default"}
                    size="sm"
                    className="gap-2"
                  >
                    {isCurrentlyGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {hasGeneratedSummary ? 'Regenerate' : 'Generate'} Summary
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
