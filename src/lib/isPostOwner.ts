/**
 * Shared post-owner gate. Used by PostView (to decide whether to mount
 * MuxOwnerHint) and by MuxOwnerHint itself (defense-in-depth internal gate).
 */
export interface PostOwnerInput {
  user_id?: string | null;
  authorId?: string | null;
}

export interface UserOwnerInput {
  id?: string | null;
}

export function isPostOwner(
  post: PostOwnerInput | null | undefined,
  user: UserOwnerInput | null | undefined,
): boolean {
  if (!post || !user?.id) return false;
  const authorId = post.user_id ?? post.authorId ?? null;
  return !!authorId && authorId === user.id;
}
