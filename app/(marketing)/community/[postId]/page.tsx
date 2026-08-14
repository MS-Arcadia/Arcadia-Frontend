import { PostPage } from "@/components/community/post-page"

export const metadata = {
  title: "Post",
  description: "A community post on Arcadia, and the comments on it.",
}

/** `params` is a promise in Next 16 — synchronous access was removed. */
export default async function Page({
  params,
}: {
  params: Promise<{ postId: string }>
}) {
  const { postId } = await params
  return <PostPage postId={postId} />
}
