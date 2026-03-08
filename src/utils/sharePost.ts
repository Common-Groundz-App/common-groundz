import { toast } from '@/hooks/use-toast';

export async function sharePost(postId: string, title?: string) {
  const url = `${window.location.origin}/post/${postId}`;
  const shareTitle = title || 'Check out this post on Common Groundz';

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
    toast({ title: 'Link copied', description: 'Post link copied to clipboard' });
  } catch {
    toast({ title: 'Copy failed', description: 'Please copy the URL manually.', variant: 'destructive' });
  }
}
