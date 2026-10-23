import { COMPANY, COMPANY_REGISTERED_OFFICE, COMPANY_REGISTER_URL, COMPANY_VAT_DISPLAY } from '@/lib/config/company'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'

/**
 * The registered company on one card (About, Contact): the details a buyer
 * or a payment provider's reviewer looks for, from the same constants the
 * footer, the legal pages and the Organization JSON-LD use.
 */
export function CompanyDetails({ className }: { className?: string }) {
  const link = 'text-text-primary underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white/70'
  const rows: Array<[string, React.ReactNode]> = [
    ['Legal name', COMPANY.legalName],
    [
      'Company number',
      <a key="n" href={COMPANY_REGISTER_URL} target="_blank" rel="noopener noreferrer" className={link}>
        {COMPANY.companyNumber}
      </a>,
    ],
    ['Registered in', COMPANY.jurisdiction],
    ['Incorporated', COMPANY.incorporatedOn],
    ['Registered office', COMPANY_REGISTERED_OFFICE],
    ['VAT number', COMPANY_VAT_DISPLAY],
    [
      'Email',
      <a key="e" href={`mailto:${COMPANY.email}`} className={link}>
        {COMPANY.email}
      </a>,
    ],
    [
      'Phone',
      <a key="p" href={`tel:${COMPANY.phone.replace(/\s+/g, '')}`} className={link}>
        {COMPANY.phone}
      </a>,
    ],
  ]
  return (
    <dl className={cn('overflow-hidden rounded-lg', MARKET_CARD, className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-4 py-3 even:bg-white/[0.025] sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4 sm:px-5">
          <dt className="text-body-sm text-text-tertiary">{label}</dt>
          <dd className="text-body-sm text-text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
