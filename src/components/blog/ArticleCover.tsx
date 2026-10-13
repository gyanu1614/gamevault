import { Picture } from '@/lib/blog/render/nodes'
import type { StoredImage } from '@/lib/blog/doc/types'

/**
 * The cover: always 16:9, loaded first (it is the page's largest paint). A
 * block post carries its processed source set; a legacy post only has a URL,
 * shown in the same 16:9 frame so every cover reads the same.
 */
export function ArticleCover({ image, url, alt }: { image: StoredImage | null; url: string | null; alt: string }) {
  if (!image && !url) return null
  return (
    <div className="mx-auto mb-8 mt-8 aspect-video w-full max-w-[960px] overflow-hidden rounded-[12px] bg-white/[0.03]">
      {image ? (
        <Picture image={image} alt={alt} sizes="(min-width: 1024px) 960px, calc(100vw - 32px)" eager className="h-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url!} alt={alt} width={1600} height={900} loading="eager" fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
      )}
    </div>
  )
}
