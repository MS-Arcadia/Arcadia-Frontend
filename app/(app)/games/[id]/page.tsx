import { GamePage } from "./_game-page"

/** `params` is a promise in Next 16 — synchronous access was removed, not just
 *  deprecated. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <GamePage id={id} />
}
