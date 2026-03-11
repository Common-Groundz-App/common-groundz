/**
 * Centralized auth URL builder.
 * Encodes current location as returnTo parameter for post-auth redirects.
 */
export const buildAuthUrl = (tab?: 'signup' | 'login'): string => {
  const returnTo = encodeURIComponent(
    window.location.pathname + window.location.search + window.location.hash
  );

  const params = new URLSearchParams();
  if (tab) params.set('tab', tab);
  params.set('returnTo', returnTo);

  return `/auth?${params.toString()}`;
};
