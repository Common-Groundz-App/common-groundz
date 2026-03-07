export function getProfileUrl(username?: string | null): string {
  return username ? `/u/${username}` : '/profile';
}
