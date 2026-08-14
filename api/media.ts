import { API } from "@/lib/api-paths"
import { http } from "@/services/http"

export interface UploadedMedia {
  id: string
  kind: string
  url: string
  content_type: string
  size_bytes: number
  filename: string
}

/** Multipart upload to media-service. Catalog only stores the returned URL. */
export async function uploadMedia(
  file: File,
  fields: { kind: "IMAGE"; referenceId?: string }
): Promise<UploadedMedia> {
  const form = new FormData()
  form.set("file", file)
  form.set("kind", fields.kind)
  if (fields.referenceId) form.set("reference_id", fields.referenceId)

  const { data } = await http.post<UploadedMedia>(API.media.upload, form, {
    headers: { "Content-Type": undefined },
    timeout: 60_000,
  })
  return data
}
