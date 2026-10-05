import type { ScheduleRecord } from "@/lib/api/schedules"

export class PendingScheduleUploadError extends Error {
  constructor(readonly originalError: unknown, readonly files: File[], readonly confirmedSchedule: ScheduleRecord) {
    super("O envio de anexos foi interrompido.")
  }
}

// A response may be lost after storage succeeded. Reconcile before offering retry.
export function remainingScheduleUploads(error: PendingScheduleUploadError, refreshed: ScheduleRecord) {
  const confirmedUrls = new Set(error.confirmedSchedule.naAttachments?.map((attachment) => attachment.documentUrl))
  const newlySaved = (refreshed.naAttachments ?? []).filter((attachment) => !confirmedUrls.has(attachment.documentUrl))
  return error.files.filter((file) => {
    const index = newlySaved.findIndex((attachment) => attachment.fileName === file.name && attachment.fileSize === file.size)
    if (index < 0) return true
    newlySaved.splice(index, 1)
    return false
  })
}
