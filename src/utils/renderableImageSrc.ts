export const isRemote = (url: string) => /^https?:\/\//i.test(url);

/** Local rule: which src values may be rendered. */
export const isRenderableImageSrc = (url: string): boolean => {
  if (!url) return false;
  if (url.startsWith('/')) return !url.startsWith('//');
  if (/^blob:/i.test(url)) return true;
  if (/^data:/i.test(url)) return /^data:image\//i.test(url);
  if (isRemote(url)) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

