import { fetchImageWithRetries } from './imageUtils';

/**
 * Download a file from a URL by fetching it as a blob and triggering a download
 * This works around CORS restrictions that prevent direct downloads from external domains
 */
export async function downloadFileFromUrl(url: string, fallbackFilename?: string): Promise<void> {
  try {
    // Extract filename from URL or use fallback
    const urlPath = new URL(url).pathname;
    const filename = fallbackFilename || urlPath.split('/').pop() || 'download';
    
    // Fetch the file as a blob using existing retry logic
    const blob = await fetchImageWithRetries(url, 3);
    
    if (!blob) {
      throw new Error('Failed to fetch file');
    }
    
    // Create blob URL and trigger download
    const blobUrl = URL.createObjectURL(blob);
    
    // Create temporary link element and trigger download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up blob URL after a short delay
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);
    
  } catch (error) {
    console.error('Failed to download file:', error);
    throw error;
  }
}