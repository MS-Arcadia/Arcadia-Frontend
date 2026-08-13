import { PublicGamePage } from "./_public-game-page"

/** `params` is a promise in Next 16 — synchronous access was removed. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PublicGamePage id={id} />
}
