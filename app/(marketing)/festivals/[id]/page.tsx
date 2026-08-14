import { FestivalDetail } from "@/components/festival/festival-detail"

export const metadata = {
  title: "Festival",
  description:
    "Games on this Arcadia festival, and the discounts running on them.",
}

/** `params` is a promise in Next 16 — synchronous access was removed. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <FestivalDetail id={id} />
}
