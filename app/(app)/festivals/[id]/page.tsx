import { FestivalDetail } from "./_festival-detail"

/** `params` is a promise in Next 16 — synchronous access was removed, not just
 *  deprecated. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <FestivalDetail id={id} />
}
