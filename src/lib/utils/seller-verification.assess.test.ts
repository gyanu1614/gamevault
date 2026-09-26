/** ACC-02 — approval-time identity assessment. */
import { describe, it, expect } from 'vitest'
import { assessIdentityForApproval } from './seller-verification'

const doc = (document_type: string, verified = false, file_path = `kyc/${document_type}.png`) => ({ document_type, verified, file_path })

describe('assessIdentityForApproval', () => {
  it('passes only with a VERIFIED government ID and a VERIFIED selfie', () => {
    expect(assessIdentityForApproval([doc('id_front', true), doc('selfie_with_id', true)])).toEqual({ verified: true, viaDidit: false, missing: [], unverified: [] })
    expect(assessIdentityForApproval([doc('id_back', true), doc('selfie_with_id', true)]).verified).toBe(true)
  })
  it('an uploaded but unverified document is a gap (calculateVerificationStatus counts it as done — this does not)', () => {
    expect(assessIdentityForApproval([doc('id_front'), doc('selfie_with_id', true)])).toMatchObject({ verified: false, unverified: ['Government ID'], missing: [] })
    expect(assessIdentityForApproval([doc('id_front', true), doc('selfie_with_id')])).toMatchObject({ verified: false, unverified: ['Selfie with ID'] })
  })
  it('missing documents are named', () => {
    expect(assessIdentityForApproval([])).toMatchObject({ verified: false, missing: ['Government ID', 'Selfie with ID'] })
    expect(assessIdentityForApproval([doc('proof_of_address', true)])).toMatchObject({ verified: false, missing: ['Government ID', 'Selfie with ID'] })
    expect(assessIdentityForApproval(null)).toMatchObject({ verified: false })
  })
  it('an approved Didit session satisfies identity on its own', () => {
    expect(assessIdentityForApproval([doc('other', false, 'didit:abc123')])).toEqual({ verified: true, viaDidit: true, missing: [], unverified: [] })
  })
})
