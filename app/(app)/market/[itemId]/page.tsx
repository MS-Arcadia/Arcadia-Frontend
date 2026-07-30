import { ItemPage } from "./_item-page"

/** `params` is a promise in Next 16 — synchronous access was removed, not just
 *  deprecated. */
export default async function Page({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params
  return <ItemPage itemId={itemId} />
}
