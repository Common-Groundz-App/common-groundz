
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { refreshEntityImage } from '@/services/recommendation/entityOperations';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, InfoIcon, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type RecoveryResults = {
  total: number;
  needsRecovery: number;
  recovered: number;
  failed: number;
};

export const EntityImageRecovery = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<RecoveryResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verboseLog, setVerboseLog] = useState<string[]>([]);
  
  const addToLog = (message: string) => {
    setVerboseLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const identifyFallbackEntities = async (): Promise<{
    entities: Array<{ id: string; name: string; api_source: string | null; api_ref: string | null; }>;
    needsRecovery: number;
    total: number;
  }> => {
    try {
      addToLog("Analyzing entity images to identify those using fallback images...");
      
      // Get Google Places entities that are using Unsplash fallback images
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, api_source, api_ref, image_url')
        .eq('is_deleted', false)
        .eq('api_source', 'google_places')
        .filter('image_url', 'ilike', '%unsplash.com%');
      
      if (error) {
        throw error;
      }

      // Get total number of Google Places entities for comparison
      const { count, error: countError } = await supabase
        .from('entities')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('api_source', 'google_places');
      
      if (countError) {
        throw countError;
      }
      
      addToLog(`Found ${data.length} entities with fallback Unsplash images out of ${count} Google Places entities`);
      
      return {
        entities: data,
        needsRecovery: data.length,
        total: count || 0
      };
    } catch (err) {
      console.error("Error identifying fallback entities:", err);
      setError("Failed to analyze entities. See console for details.");
      return { entities: [], needsRecovery: 0, total: 0 };
    }
  };
  
  const recoverEntityImage = async (entityId: string, entityName: string): Promise<boolean> => {
    try {
      addToLog(`Attempting to recover image for entity: ${entityName} (${entityId})`);
      
      const success = await refreshEntityImage(entityId);
      
      if (success) {
        addToLog(`✅ Successfully recovered image for: ${entityName}`);
        return true;
      } else {
        addToLog(`❌ Failed to recover image for: ${entityName}`);
        return false;
      }
    } catch (error) {
      console.error(`Error recovering image for entity ${entityId}:`, error);
      addToLog(`❌ Error recovering image for ${entityName}: ${(error as Error).message}`);
      return false;
    }
  };
  
  const runRecovery = async () => {
    if (!user) {
      setError("You must be logged in to perform this operation");
      return;
    }
    
    setIsRunning(true);
    setError(null);
    setResults(null);
    
    try {
      addToLog("Starting image recovery process...");
      
      // Step 1: Identify entities with fallback images
      const { entities, needsRecovery, total } = await identifyFallbackEntities();
      
      const initialResults: RecoveryResults = {
        total,
        needsRecovery,
        recovered: 0,
        failed: 0
      };
      
      setResults(initialResults);
      
      if (entities.length === 0) {
        addToLog("No entities need image recovery");
        toast({
          title: "No Recovery Needed",
          description: "No entities were found that need image recovery",
        });
        setIsRunning(false);
        return;
      }
      
      // Step 2: Process entities in batches to avoid rate limiting
      const batchSize = 2; // Small batch size to avoid rate limiting
      let recovered = 0;
      let failed = 0;
      
      for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, i + batchSize);
        addToLog(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(entities.length/batchSize)}`);
        
        // Process each entity in the batch
        const batchPromises = batch.map(async entity => {
          const success = await recoverEntityImage(entity.id, entity.name);
          
          if (success) {
            recovered++;
          } else {
            failed++;
          }
          
          // Update results after each entity
          setResults({
            total,
            needsRecovery,
            recovered,
            failed
          });
        });
        
        // Wait for batch to complete
        await Promise.all(batchPromises);
        
        // Add delay between batches
        if (i + batchSize < entities.length) {
          addToLog("Waiting between batches to avoid rate limiting...");
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      addToLog(`✅ Recovery process complete: ${recovered} images recovered, ${failed} failed`);
      
      toast({
        title: "Recovery Complete",
        description: `Successfully recovered ${recovered} entity images out of ${needsRecovery}`,
        variant: recovered === 0 ? "destructive" : "default",
      });
      
    } catch (err) {
      const errorMsg = "An unexpected error occurred during image recovery";
      console.error("Error running recovery:", err);
      setError(errorMsg);
      addToLog(`❌ ${errorMsg}: ${(err as Error).message}`);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getRecoveryProgressPercentage = () => {
    if (!results || results.needsRecovery === 0) return 0;
    return Math.round(((results.recovered + results.failed) / results.needsRecovery) * 100);
  };

  const renderAuthWarning = () => {
    if (!user) {
      return (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in to perform recovery operations. Please log in and try again.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Entity Image Recovery Tool</CardTitle>
        <CardDescription>
          Recover original images for entities that are currently using fallback Unsplash images
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderAuthWarning()}
        
        <Alert className="mb-4">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>How Recovery Works</AlertTitle>
          <AlertDescription>
            <p>This tool identifies entities with fallback Unsplash images and attempts to recover the original images by:</p>
            <ol className="list-decimal ml-5 mt-2">
              <li>Finding Google Places entities using Unsplash fallback images</li>
              <li>Using the stored Place ID to re-fetch the original image from Google Places</li>
              <li>Storing the recovered image in Supabase Storage</li>
              <li>Updating the database with the new image URL</li>
            </ol>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <Button 
            onClick={runRecovery} 
            disabled={isRunning || !user}
            className="w-full"
          >
            {isRunning ? "Running Recovery..." : "Start Image Recovery"}
          </Button>
        </div>

        {results && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-medium">Recovery Progress</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.total}</p>
                <p className="text-xs text-muted-foreground">Total Entities</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.needsRecovery}</p>
                <p className="text-xs text-muted-foreground">Need Recovery</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.recovered}</p>
                <p className="text-xs text-muted-foreground">Successfully Recovered</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.failed}</p>
                <p className="text-xs text-muted-foreground">Failed Recovery</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm items-center">
                <span>Recovery Progress</span>
                <span>{getRecoveryProgressPercentage()}%</span>
              </div>
              <Progress value={getRecoveryProgressPercentage()} className="h-2" />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {verboseLog.length > 0 && (
          <div className="space-y-2 mt-6">
            <div className="flex items-center gap-2">
              <InfoIcon className="h-4 w-4" />
              <h4 className="text-sm font-medium">Diagnostic Log</h4>
            </div>
            <div className="bg-muted p-2 rounded-md max-h-48 overflow-y-auto">
              {verboseLog.map((log, index) => (
                <div key={index} className="text-xs font-mono py-1">{log}</div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between text-sm text-muted-foreground">
        <div>
          <p>This tool only recovers images for Google Places entities that currently use Unsplash fallback images.</p>
        </div>
      </CardFooter>
    </Card>
  );
};
