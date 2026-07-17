/**
 * Step 2 — Personal Info (Forest Ledger redesign).
 *
 * The lean personal-details step: legal first + last name, public display name,
 * storefront shop name, country (full dataset + Other), state/province, city,
 * ZIP/postal, an international phone number, and an optional alternate email.
 * Business-only fields appear when the Step 1 seller type is "business".
 *
 * CONTRACT — feeds the SAME legacy `step2Schema` shape the untouched server
 * action expects. Two UI-side reshapings, both lossless and contract-safe:
 *   • Legal name is shown as first + last but JOINED into the single
 *     `fullLegalName` column the backend already reads.
 *   • ZIP / postal code has no dedicated legacy column, so on submit it is
 *     folded into `stateProvince` (persisted as `state_province`) and the
 *     UI-only `zipPostal` key is dropped from the emitted payload. Nothing new
 *     reaches submitSellerApplication.
 * Every other field maps 1:1 to an existing step2 field.
 */

'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserRound } from 'lucide-react'

import {
  step2Schema,
  type Step2FormData,
} from '../../../schemas'
import { COUNTRIES, OTHER_COUNTRY, findCountryByName } from '../../../data/countries'
import { PALETTE } from '../../theme'
import StepHeader from '../StepHeader'
import { FieldShell, TextField, LightCombobox, LightPhoneInput } from '../fields'
import StepNav from './StepNav'
import SectionLabel from './SectionLabel'

const COUNTRY_OPTIONS = [
  ...COUNTRIES.map((c) => ({ value: c.name, label: c.name, keywords: [c.iso2] })),
  { value: OTHER_COUNTRY, label: 'Other (Not Listed)', keywords: ['other'] },
]

const BUSINESS_TYPE_OPTIONS = [
  { value: 'llc', label: 'LLC' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Other' },
]

export interface Step2PersonalInfoProps {
  /** Seller type chosen in Step 1 — gates the business fields. */
  sellerType?: 'individual' | 'business'
  /** Previously-entered step 2 values (edit / resume). */
  initialData?: Partial<Step2FormData>
  /** Called with the validated legacy-shape step2 payload on Continue. */
  onSubmit: (data: Step2FormData) => void
  onBack?: () => void
}

/** Split a stored "First Last" into first + last for the two-field UI. */
function splitLegalName(full: string | undefined): { first: string; last: string } {
  const trimmed = (full ?? '').trim()
  if (!trimmed) return { first: '', last: '' }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export default function Step2PersonalInfo({
  sellerType,
  initialData,
  onSubmit,
  onBack,
}: Step2PersonalInfoProps) {
  const isBusiness = sellerType === 'business'

  const initialName = splitLegalName(initialData?.fullLegalName)
  const [firstName, setFirstName] = React.useState(initialName.first)
  const [lastName, setLastName] = React.useState(initialName.last)
  // Local touched flags so the split-name errors only show after a submit attempt.
  const [nameTouched, setNameTouched] = React.useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      fullLegalName: initialData?.fullLegalName ?? '',
      displayName: initialData?.displayName ?? '',
      shopName: initialData?.shopName ?? '',
      country: initialData?.country ?? '',
      countryOther: initialData?.countryOther ?? '',
      stateProvince: initialData?.stateProvince ?? '',
      city: initialData?.city ?? '',
      phoneNumber: initialData?.phoneNumber ?? '',
      alternateEmail: initialData?.alternateEmail ?? '',
      companyLegalName: initialData?.companyLegalName ?? '',
      businessRegistrationNumber: initialData?.businessRegistrationNumber ?? '',
      taxIdVat: initialData?.taxIdVat ?? '',
      companyAddress: initialData?.companyAddress ?? '',
      businessType: initialData?.businessType,
      yearEstablished: initialData?.yearEstablished ?? '',
      businessEmail: initialData?.businessEmail ?? '',
      businessPhone: initialData?.businessPhone ?? '',
    },
  })

  const country = watch('country')
  const regions = findCountryByName(country)?.regions ?? []

  // Keep fullLegalName in lockstep with the two split fields.
  const syncFullLegalName = React.useCallback(
    (first: string, last: string) => {
      const joined = [first.trim(), last.trim()].filter(Boolean).join(' ')
      setValue('fullLegalName', joined, { shouldValidate: nameTouched })
    },
    [setValue, nameTouched],
  )

  const firstMissing = nameTouched && !firstName.trim()
  const lastMissing = nameTouched && !lastName.trim()

  const submit = handleSubmit((data) => {
    // Guard the split-name fields ourselves (the schema only sees the joined value).
    if (!firstName.trim() || !lastName.trim()) {
      setNameTouched(true)
      return
    }
    // Fold the UI-only ZIP/postal into stateProvince (the persisted column) and
    // drop the phantom key so the emitted payload matches the legacy contract.
    const { zipPostal, ...rest } = data
    const zip = zipPostal?.trim()
    const region = rest.stateProvince?.trim()
    const stateProvince = zip
      ? region
        ? `${region} ${zip}`
        : zip
      : region || ''
    onSubmit({ ...rest, stateProvince })
  })

  const onContinue = () => {
    setNameTouched(true)
    void submit()
  }

  return (
    <div>
      <StepHeader
        heading="Personal Info"
        explainer="Your legal details keep payouts landing in the right account, on time."
        icon={UserRound}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onContinue()
        }}
        className="space-y-7"
        noValidate
      >
        {/* ── Identity ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionLabel>{isBusiness ? 'About You' : 'Your Name'}</SectionLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Legal First Name" htmlFor="firstName" error={firstMissing ? 'First name is required' : undefined}>
              <TextField
                id="firstName"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value)
                  syncFullLegalName(e.target.value, lastName)
                }}
                onBlur={() => setNameTouched(true)}
                placeholder="Jordan"
                invalid={firstMissing}
                autoComplete="given-name"
              />
            </FieldShell>

            <FieldShell label="Legal Last Name" htmlFor="lastName" error={lastMissing ? 'Last name is required' : undefined}>
              <TextField
                id="lastName"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value)
                  syncFullLegalName(firstName, e.target.value)
                }}
                onBlur={() => setNameTouched(true)}
                placeholder="Rivera"
                invalid={lastMissing}
                autoComplete="family-name"
              />
            </FieldShell>
          </div>
          <p className="text-xs" style={{ color: PALETTE.ink2 }}>
            Enter your name exactly as it appears on your government ID.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Display Name"
              htmlFor="displayName"
              hint="How your seller profile appears to buyers."
              error={errors.displayName?.message}
            >
              <TextField
                id="displayName"
                {...register('displayName')}
                placeholder="Jordan's Vault"
                invalid={!!errors.displayName}
                autoComplete="off"
              />
            </FieldShell>

            <FieldShell
              label="Shop Name"
              htmlFor="shopName"
              hint="Your storefront URL, e.g. /shop/your-shop-name."
              error={errors.shopName?.message}
            >
              <TextField
                id="shopName"
                {...register('shopName')}
                placeholder="jordans-vault"
                invalid={!!errors.shopName}
                autoComplete="off"
              />
            </FieldShell>
          </div>
        </div>

        {/* ── Location ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionLabel>Location</SectionLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Country" error={errors.country?.message}>
              <LightCombobox
                value={country || ''}
                onChange={(v) => {
                  setValue('country', v, { shouldValidate: true })
                  setValue('stateProvince', '')
                  if (v !== OTHER_COUNTRY) setValue('countryOther', '')
                }}
                options={COUNTRY_OPTIONS}
                placeholder="Select your country"
                ariaLabel="Country"
                invalid={!!errors.country}
              />
            </FieldShell>

            {country === OTHER_COUNTRY && (
              <FieldShell label="Country Name" htmlFor="countryOther" error={errors.countryOther?.message}>
                <TextField
                  id="countryOther"
                  {...register('countryOther')}
                  placeholder="Enter your country"
                  invalid={!!errors.countryOther}
                  autoComplete="country-name"
                />
              </FieldShell>
            )}

            <FieldShell label="State / Province" optional error={errors.stateProvince?.message}>
              {regions.length > 0 ? (
                <LightCombobox
                  value={watch('stateProvince') || ''}
                  onChange={(v) => setValue('stateProvince', v)}
                  options={regions.map((r) => ({ value: r, label: r }))}
                  placeholder="Select state or province"
                  ariaLabel="State or province"
                />
              ) : (
                <TextField
                  {...register('stateProvince')}
                  placeholder="e.g. Bavaria"
                  autoComplete="address-level1"
                />
              )}
            </FieldShell>

            <FieldShell label="City" htmlFor="city" error={errors.city?.message}>
              <TextField
                id="city"
                {...register('city')}
                placeholder="e.g. Los Angeles"
                invalid={!!errors.city}
                autoComplete="address-level2"
              />
            </FieldShell>

            <FieldShell label="ZIP / Postal Code" htmlFor="zipPostal" optional>
              <TextField
                id="zipPostal"
                {...register('zipPostal')}
                placeholder="e.g. 90001"
                autoComplete="postal-code"
              />
            </FieldShell>
          </div>
        </div>

        {/* ── Contact ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionLabel>Contact</SectionLabel>

          <FieldShell label="Phone Number" error={errors.phoneNumber?.message}>
            <LightPhoneInput
              value={watch('phoneNumber') || ''}
              onChange={(v) =>
                setValue('phoneNumber', v, { shouldValidate: !!errors.phoneNumber })
              }
              defaultCountryName={country !== OTHER_COUNTRY ? country : undefined}
              invalid={!!errors.phoneNumber}
            />
          </FieldShell>

          <FieldShell
            label="Alternate Email"
            htmlFor="alternateEmail"
            optional
            hint="A backup address we can reach you at."
            error={errors.alternateEmail?.message}
          >
            <TextField
              id="alternateEmail"
              type="email"
              {...register('alternateEmail')}
              placeholder="backup@example.com"
              invalid={!!errors.alternateEmail}
              autoComplete="email"
            />
          </FieldShell>
        </div>

        {/* ── Business (conditional) ───────────────────────────── */}
        {isBusiness && (
          <div className="space-y-4">
            <SectionLabel>Business Details</SectionLabel>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldShell label="Company Legal Name" optional htmlFor="companyLegalName" className="sm:col-span-2">
                <TextField
                  id="companyLegalName"
                  {...register('companyLegalName')}
                  placeholder="Registered company name"
                  autoComplete="organization"
                />
              </FieldShell>

              <FieldShell label="Business Registration Number" optional htmlFor="businessRegistrationNumber">
                <TextField
                  id="businessRegistrationNumber"
                  {...register('businessRegistrationNumber')}
                  placeholder="123456789"
                />
              </FieldShell>

              <FieldShell label="Tax ID / VAT Number" optional htmlFor="taxIdVat">
                <TextField id="taxIdVat" {...register('taxIdVat')} placeholder="XX-XXXXXXX" />
              </FieldShell>

              <FieldShell label="Company Address" optional htmlFor="companyAddress" className="sm:col-span-2">
                <TextField
                  id="companyAddress"
                  {...register('companyAddress')}
                  placeholder="123 Business St, Suite 100"
                  autoComplete="street-address"
                />
              </FieldShell>

              <FieldShell label="Business Type" optional>
                <LightCombobox
                  value={watch('businessType') || ''}
                  onChange={(v) =>
                    setValue('businessType', v as Step2FormData['businessType'])
                  }
                  options={BUSINESS_TYPE_OPTIONS}
                  placeholder="Select type"
                  ariaLabel="Business type"
                  unsorted
                />
              </FieldShell>

              <FieldShell label="Year Established" optional htmlFor="yearEstablished">
                <TextField
                  id="yearEstablished"
                  {...register('yearEstablished')}
                  placeholder="2020"
                  maxLength={4}
                  inputMode="numeric"
                />
              </FieldShell>

              <FieldShell label="Business Email" optional htmlFor="businessEmail" error={errors.businessEmail?.message}>
                <TextField
                  id="businessEmail"
                  type="email"
                  {...register('businessEmail')}
                  placeholder="contact@company.com"
                  invalid={!!errors.businessEmail}
                />
              </FieldShell>

              <FieldShell label="Business Phone" optional htmlFor="businessPhone">
                <TextField
                  id="businessPhone"
                  type="tel"
                  {...register('businessPhone')}
                  placeholder="+1 555 000 0000"
                />
              </FieldShell>
            </div>
          </div>
        )}

        <StepNav onBack={onBack} />
      </form>
    </div>
  )
}
