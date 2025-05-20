
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon, CheckCircle2, ShieldAlert } from 'lucide-react';
import { migrateExistingEntityImages } from '@/services/migration/setupEntityImages';
import { useAuth } from '@/contexts/AuthContext';

type MigrationResults = {
  total: number;
  processed: number;
  storageSuccessful: number;
  databaseUpdated: number;
};

export const EntityImageMigration = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<MigrationResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verboseLog, setVerboseLog] = useState<string[]>([]);
  
  const addToLog = (message: string) => {
    setVerboseLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const runMigration = async () => {
    if (!user) {
      setError("You must be logged in to perform this operation");
      return;
    }
    
    setIsRunning(true);
    setError(null);
    setResults(null);
    
    try {
      addToLog("Starting entity image migration process...");
      
      const migrationResults = await migrateExistingEntityImages();
      
      setResults(migrationResults);
      
      addToLog(`✅ Migration process complete:`);
      addToLog(`- ${migrationResults.total} total entities with images`);
      addToLog(`- ${migrationResults.processed} entities needed migration`);
      addToLog(`- ${migrationResults.storageSuccessful} images successfully stored in Supabase`);
      addToLog(`- ${migrationResults.databaseUpdated} database records updated with new URLs`);
      
      if (migrationResults.storageSuccessful > 0) {
        toast({
          title: "Migration Complete",
          description: `Successfully migrated ${migrationResults.storageSuccessful} entity images`,
          variant: "default",
        });
      } else {
        toast({
          title: "Migration Complete",
          description: "No entity images needed migration",
        });
      }
      
    } catch (err) {
      const errorMsg = "An unexpected error occurred during image migration";
      console.error("Error running migration:", err);
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

  const getMigrationProgressPercentage = () => {
    if (!results || results.processed === 0) return 0;
    const totalProcessed = results.storageSuccessful + results.databaseUpdated;
    const totalNeeded = results.processed * 2; // Each entity needs storage and DB update
    return Math.round((totalProcessed / totalNeeded) * 100);
  };

  const renderAuthWarning = () => {
    if (!user) {
      return (
        <Alert variant="destructive" className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in to perform migration operations. Please log in and try again.
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
          Download entity images to Supabase Storage and update database records
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderAuthWarning()}
        
        <Alert className="mb-4">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>How Migration Works</AlertTitle>
          <AlertDescription>
            <p>This tool handles the migration of entity images to Supabase Storage:</p>
            <ol className="list-decimal ml-5 mt-2">
              <li>Identifies all entity images that need migration (especially from Google Places API)</li>
              <li>Downloads each image and stores it in Supabase Storage</li>
              <li>Updates the database records with the new reliable URLs</li>
              <li>Processes images in batches to avoid rate limiting</li>
            </ol>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <Button 
            onClick={runMigration} 
            disabled={isRunning || !user}
            className="w-full"
          >
            {isRunning ? "Running Migration..." : "Start Entity Image Migration"}
          </Button>
        </div>

        {results && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-medium">Migration Progress</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.total}</p>
                <p className="text-xs text-muted-foreground">Total Entities</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.processed}</p>
                <p className="text-xs text-muted-foreground">Need Migration</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.storageSuccessful}</p>
                <p className="text-xs text-muted-foreground">Storage Success</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-2xl font-bold">{results.databaseUpdated}</p>
                <p className="text-xs text-muted-foreground">DB Updated</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm items-center">
                <span>Migration Progress</span>
                <span>{getMigrationProgressPercentage()}%</span>
              </div>
              <Progress value={getMigrationProgressPercentage()} className="h-2" />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="my-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {verboseLog.length > 0 && (
          <div className="space-y-2 mt-6">
            <div className="flex items-center gap-2">
              <InfoIcon className="h-4 w-4" />
              <h4 className="text-sm font-medium">Operation Log</h4>
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
          <p>Storage bucket: <code>entity-images</code></p>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <p>Images stored in Supabase are permanent and reliable</p>
        </div>
      </CardFooter>
    </Card>
  );
};
