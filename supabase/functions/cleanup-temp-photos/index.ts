import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧹 Starting cleanup of orphaned temp photo folders...');

    // List all folders in entity-images bucket
    const { data: folders, error: listError } = await supabaseAdmin
      .storage
      .from('entity-images')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      throw listError;
    }

    // Filter for temp-* folders older than 24 hours
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tempFolders = folders.filter(folder => 
      folder.name.startsWith('temp-') && 
      new Date(folder.created_at) < cutoffTime
    );

    console.log(`📊 Found ${tempFolders.length} temp folders older than 24h`);

    let deletedCount = 0;
    let errorCount = 0;

    for (const folder of tempFolders) {
      try {
        // List all files in the temp folder's places subdirectory
        const { data: folderFiles, error: listFilesError } = await supabaseAdmin
          .storage
          .from('entity-images')
          .list(`${folder.name}/places`);

        if (listFilesError) {
          console.error(`❌ Failed to list files in ${folder.name}:`, listFilesError);
          errorCount++;
          continue;
        }

        if (folderFiles && folderFiles.length > 0) {
          const filePaths = folderFiles.map(f => `${folder.name}/places/${f.name}`);
          
          console.log(`🗑️ Deleting ${filePaths.length} files from ${folder.name}`);
          
          // Delete all files in the folder
          const { error: deleteError } = await supabaseAdmin
            .storage
            .from('entity-images')
            .remove(filePaths);

          if (deleteError) {
            console.error(`❌ Failed to delete files in ${folder.name}:`, deleteError);
            errorCount++;
          } else {
            deletedCount++;
            console.log(`✅ Deleted temp folder: ${folder.name}`);
          }
        } else {
          console.log(`ℹ️ Folder ${folder.name} is empty, skipping`);
        }
      } catch (folderError) {
        console.error(`❌ Error processing folder ${folder.name}:`, folderError);
        errorCount++;
      }
    }

    const summary = {
      success: true,
      found: tempFolders.length,
      deleted: deletedCount,
      errors: errorCount,
      message: `Cleaned up ${deletedCount} orphaned temp folders (${errorCount} errors)`
    };

    console.log('✅ Cleanup complete:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
