import { redirect } from 'next/navigation'

export default function PromoCodesRedirect() {
  // Redirect to the main promo admin page
  redirect('/admin/promos')
}
