/**
 * Client helpers for admin image uploads.
 *
 * Every admin image (game logo/cover/banner, currency + bundle + platform
 * icons, template option icons, blog images) is read in the browser as a
 * base64 data URL and posted to a server action. That request is capped
 * twice: Next's `experimental.serverActions.bodySizeLimit` (next.config.js,
 * 1 MB by default) and Vercel's 4.5 MB function payload limit. Base64 grows
 * the file by 4/3, so the file itself must stay well under both — a file over
 * the cap is refused here with a clear message instead of failing inside the
 * action call (which used to leave a spinner running and show nothing).
 */

const MB = 1024 * 1024

/** Largest image the admin can upload (its base64 request fits bodySizeLimit = 4mb). */
export const MAX_IMAGE_UPLOAD_BYTES = 2.5 * MB

/** Bytes a server-action call carrying `rawBytes` of image adds up to: base64 + data-URL prefix + envelope. */
export function base64RequestBytes(rawBytes: number): number {
  return Math.ceil(rawBytes / 3) * 4 + 64 * 1024
}

const formatMb = (bytes: number) => `${Number((bytes / MB).toFixed(1)).toString()} MB`

/** null when the file fits; otherwise the toast text ("Icon must be 1 MB or smaller"). */
export function imageTooLargeMessage(
  file: { size: number },
  maxBytes: number = MAX_IMAGE_UPLOAD_BYTES,
  label = 'Image',
): string | null {
  return file.size > maxBytes ? `${label} must be ${formatMb(maxBytes)} or smaller` : null
}

/** A readable message for an upload that threw (network error, 413 body limit). */
export function uploadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/body exceeded|payload too large|413/i.test(message)) {
    return `That image is too large to upload. Use one under ${formatMb(MAX_IMAGE_UPLOAD_BYTES)}.`
  }
  return message ? `Upload failed: ${message}` : 'Upload failed'
}

/** The file as a base64 data URL (what the upload actions expect). */
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}
