import { toast } from '@/hooks/use-toast';

export async function sharePost(postId: string, title?: string) {
  return shareUrl(`${window.location.origin}/post/${postId}`, title || 'Check out this post on Common Groundz', 'Post link copied to clipboard');
}

/**
 * Shares an absolute in-app URL using the same behaviour as post sharing:
 * the native share sheet when available, otherwise a clipboard copy with a toast.
 */
export async function shareUrl(url: string, title: string, copiedDescription = 'Link copied to clipboard') {
  const shareTitle = title;



  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, url });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      // Fall through to clipboard
    }
  }

  // Clipboard fallback — URL only
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      if (!successful) throw new Error('Copy command failed');
    }
    toast({ title: 'Link copied', description: copiedDescription });
  } catch {
    toast({ title: 'Copy failed', description: 'Please copy the URL manually.', variant: 'destructive' });
  }
}
