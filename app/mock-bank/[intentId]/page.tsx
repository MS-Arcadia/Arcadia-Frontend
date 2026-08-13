import { MockBankPage } from "./_mock-bank-page"

/** `params` is a promise in Next 16 — synchronous access was removed. */
export default async function Page({
  params,
}: {
  params: Promise<{ intentId: string }>
}) {
  const { intentId } = await params
  return <MockBankPage intentId={intentId} />
}
