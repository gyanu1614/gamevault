import { Lato } from 'next/font/google'

/**
 * The blog's reading face (Blog v2, 2026-10-13): Lato for article text — a
 * humanist sans that stays easy to read at 18 px over long posts (the owner
 * chose it after the Eldorado comparison). Titles use Archivo (--font-archivo,
 * root layout). Only the blog routes and the post editor import this module,
 * so other pages never fetch the files. Applied through `.blog-type`.
 */
export const blogFont = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-blog',
})
