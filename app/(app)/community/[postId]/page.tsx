import { PostPage } from "./_post-page"

/** `params` is a promise in Next 16 — synchronous access was removed, not just
 *  deprecated. */
export default async function Page({
  params,
}: {
  params: Promise<{ postId: string }>
}) {
  const { postId } = await params
  return <PostPage postId={postId} />
}
