
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface MetadataResponse {
  title?: string
  description?: string
  image?: string
  type?: string
  url: string
  siteName?: string
}

async function fetchUrlMetadata(url: string): Promise<MetadataResponse> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // Basic metadata extraction from HTML
    const metadata: MetadataResponse = { url };
    
    // Helper function to extract content from meta tags
    const getMetaContent = (html: string, property: string): string | undefined => {
      const match = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, 'i'));
      return match ? match[1] : undefined;
    };

    // Extract Open Graph and basic meta tags
    metadata.title = getMetaContent(html, 'og:title') 
      || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    metadata.description = getMetaContent(html, 'og:description') 
      || getMetaContent(html, 'description');
    metadata.image = getMetaContent(html, 'og:image');
    metadata.type = getMetaContent(html, 'og:type');
    metadata.siteName = getMetaContent(html, 'og:site_name');

    return metadata;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return { url };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadata = await fetchUrlMetadata(url);

    return new Response(
      JSON.stringify(metadata),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
