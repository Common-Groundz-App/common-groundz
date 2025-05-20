
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { setupEntityImagesBucket, migrateExistingEntityImages } from '@/services/migration/setupEntityImages';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

type MigrationResults = {
  total: number;
  processed: number;
  successful: number;
};

export const EntityImageMigration = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isBucketSetup, setIsBucketSetup] = useState<boolean | null>(null);
  const [results, setResults] = useState<MigrationResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setupBucket = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      const success = await setupEntityImagesBucket();
      setIsBucketSetup(success);
      
      if (success) {
        toast({
          title: "Success",
          description: "Entity images bucket access verified successfully",
        });
      } else {
        setError("Failed to verify entity-images bucket access. Please check the console for details.");
        toast({
          title: "Error",
          description: "Failed to verify bucket access. See console for details.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error verifying bucket:", err);
      setError("An unexpected error occurred while verifying bucket access");
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runMigration = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      const migrationResults = await migrateExistingEntityImages();
      setResults(migrationResults);
      
      if (migrationResults.processed > 0) {
        toast({
          title: "Migration Complete",
          description: `Processed ${migrationResults.processed} images, ${migrationResults.successful} successful`,
        });
      } else {
        toast({
          title: "No Images to Process",
          description: "No entity images needed migration",
        });
      }
    } catch (err) {
      console.error("Error running migration:", err);
      setError("An unexpected error occurred during migration");
      toast({
        title: "Error",
        description: "An unexpected error occurred during migration",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getProgressPercentage = () => {
    if (!results || results.processed === 0) return 0;
    return Math.round((results.successful / results.processed) * 100);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Entity Image Migration Tool</CardTitle>
        <CardDescription>
          Migrate external entity images (from Google, OMDB, etc.) to Supabase Storage for better reliability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Step 1: Verify Storage Bucket</h3>
          <p className="text-sm text-muted-foreground">
            First, we need to verify access to the "entity-images" bucket in your Supabase project.
            Make sure this bucket exists and has public read access enabled.
          </p>
          <Button 
            onClick={setupBucket} 
            disabled={isRunning || isBucketSetup === true}
            variant={isBucketSetup === true ? "outline" : "default"}
          >
            {isBucketSetup === true ? "✓ Bucket Ready" : "Verify Storage Bucket"}
          </Button>
          {isBucketSetup === true && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <p>Storage bucket access verified successfully!</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Step 2: Run Migration</h3>
          <p className="text-sm text-muted-foreground">
            This will find all entities with external image URLs (like Google Places photos) 
            and download them to Supabase Storage for reliability.
          </p>
          <Button 
            onClick={runMigration} 
            disabled={isRunning || isBucketSetup !== true}
          >
            {isRunning ? "Running Migration..." : "Start Migration"}
          </Button>
        </div>

        {results && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-medium">Migration Results</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.total}</p>
                <p className="text-xs text-muted-foreground">Total Entities</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.processed}</p>
                <p className="text-xs text-muted-foreground">Needed Migration</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.successful}</p>
                <p className="text-xs text-muted-foreground">Successfully Migrated</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{getProgressPercentage()}%</span>
              </div>
              <Progress value={getProgressPercentage()} />
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">Error</p>
            </div>
            <p className="text-sm">{error}</p>
            <p className="text-sm mt-2">
              Check that the "entity-images" bucket exists in your Supabase project and 
              has the correct RLS policies for public access.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between text-sm text-muted-foreground">
        <div>
          <p>This tool only needs to be run once to migrate all existing entity images.</p>
          <p>New entities will automatically have their images downloaded and stored.</p>
        </div>
      </CardFooter>
    </Card>
  );
};
