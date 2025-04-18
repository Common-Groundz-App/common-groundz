
import { supabase } from '@/integrations/supabase/client';

export interface UrlMetadata {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  url: string;
  siteName?: string;
}

export const fetchUrlMetadata = async (url: string): Promise<UrlMetadata | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-url-metadata', {
      body: { url }
    });

    if (error) {
      console.error('Error fetching URL metadata:', error);
      return null;
    }

    return data as UrlMetadata;
  } catch (error) {
    console.error('Exception when fetching URL metadata:', error);
    return null;
  }
};
