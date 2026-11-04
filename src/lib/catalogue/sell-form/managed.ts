/**
 * The admin builder's guard for fields the sell-form sync owns (a field with
 * options marked `metadata.catalogue`). Listings save their answers under the
 * field's key, so a new key orphans every listing that answered it, and the
 * buyer filters only read dropdowns. Labels, help text, order and new
 * options stay free: the sync adopts an option the admin adds.
 */
type AnyClient = { from: (table: string) => any }

export const MANAGED_KEY_MESSAGE = "This field is filled from the values list, so its key can't change (listings are saved under it). You can still rename its label."
export const MANAGED_TYPE_MESSAGE = 'This field is filled from the values list, so it has to stay a dropdown.'

export async function guardManagedFieldEdit(
  client: AnyClient,
  attributeId: string,
  patch: { slug?: unknown; type?: unknown },
): Promise<string | null> {
  if (patch.slug === undefined && patch.type === undefined) return null
  const { data: field, error } = await client.from('attributes').select('slug,type').eq('id', attributeId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!field) return null
  const keyChanges = patch.slug !== undefined && patch.slug !== field.slug
  const typeChanges = patch.type !== undefined && patch.type !== field.type
  if (!keyChanges && !typeChanges) return null
  const { data: marked, error: mErr } = await client
    .from('attribute_options')
    .select('id')
    .eq('attribute_id', attributeId)
    .not('metadata->catalogue', 'is', null)
    .limit(1)
  if (mErr) throw new Error(mErr.message)
  if (!marked?.length) return null
  return keyChanges ? MANAGED_KEY_MESSAGE : MANAGED_TYPE_MESSAGE
}
