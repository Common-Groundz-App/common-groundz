
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { setupEntityImagesBucket, migrateExistingEntityImages } from '@/services/migration/setupEntityImages';
import { AlertCircle, CheckCircle2, InfoIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

type MigrationResults = {
  total: number;
  processed: number;
  successful: number;
};

export const EntityImageMigration = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isBucketSetup, setIsBucketSetup] = useState<boolean | null>(null);
  const [results, setResults] = useState<MigrationResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verboseLog, setVerboseLog] = useState<string[]>([]);

  const setupBucket = async () => {
    if (!user) {
      setError("You must be logged in to perform this operation");
      toast({
        title: "Authentication required",
        description: "Please log in to access storage features",
        variant: "destructive",
      });
      return;
    }
    
    setIsRunning(true);
    setError(null);
    
    // Add to verbose log
    addToLog("Starting bucket verification...");
    
    try {
      const success = await setupEntityImagesBucket();
      setIsBucketSetup(success);
      
      if (success) {
        addToLog("✅ Storage bucket verification successful");
        toast({
          title: "Success",
          description: "Entity images bucket access verified successfully",
        });
      } else {
        const errorMsg = "Failed to verify entity-images bucket access. Please check the console for details.";
        setError(errorMsg);
        addToLog("❌ " + errorMsg);
        toast({
          title: "Error",
          description: "Failed to verify bucket access. See console for details.",
          variant: "destructive",
        });
      }
    } catch (err) {
      const errorMsg = "An unexpected error occurred while verifying bucket access";
      console.error("Error verifying bucket:", err);
      setError(errorMsg);
      addToLog("❌ " + errorMsg);
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
    if (!user) {
      setError("You must be logged in to perform this operation");
      return;
    }
    
    setIsRunning(true);
    setError(null);
    
    // Add to verbose log
    addToLog("Starting image migration...");
    
    try {
      const migrationResults = await migrateExistingEntityImages();
      setResults(migrationResults);
      
      if (migrationResults.processed > 0) {
        addToLog(`✅ Processed ${migrationResults.processed} images, ${migrationResults.successful} successful`);
        toast({
          title: "Migration Complete",
          description: `Processed ${migrationResults.processed} images, ${migrationResults.successful} successful`,
        });
      } else {
        addToLog("ℹ️ No entity images needed migration");
        toast({
          title: "No Images to Process",
          description: "No entity images needed migration",
        });
      }
    } catch (err) {
      const errorMsg = "An unexpected error occurred during migration";
      console.error("Error running migration:", err);
      setError(errorMsg);
      addToLog("❌ " + errorMsg);
      toast({
        title: "Error",
        description: "An unexpected error occurred during migration",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };
  
  const addToLog = (message: string) => {
    setVerboseLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const getProgressPercentage = () => {
    if (!results || results.processed === 0) return 0;
    return Math.round((results.successful / results.processed) * 100);
  };

  const renderAuthWarning = () => {
    if (!user) {
      return (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in to perform storage operations. Please log in and try again.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
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
        {renderAuthWarning()}
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Step 1: Verify Storage Bucket</h3>
          <p className="text-sm text-muted-foreground">
            First, we need to verify access to the "entity-images" bucket in your Supabase project.
            Make sure this bucket exists and has public read access enabled.
          </p>
          <Button 
            onClick={setupBucket} 
            disabled={isRunning || isBucketSetup === true || !user}
            variant={isBucketSetup === true ? "outline" : "default"}
          >
            {isRunning && "Checking..."}
            {!isRunning && isBucketSetup === true && "✓ Bucket Ready"}
            {!isRunning && isBucketSetup !== true && "Verify Storage Bucket"}
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
            disabled={isRunning || isBucketSetup !== true || !user}
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
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              <p className="text-sm mt-2">
                Check that the "entity-images" bucket exists in your Supabase project and 
                has the correct RLS policies for public access.
              </p>
            </AlertDescription>
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
          <p>This tool only needs to be run once to migrate all existing entity images.</p>
          <p>New entities will automatically have their images downloaded and stored.</p>
        </div>
      </CardFooter>
    </Card>
  );
};
