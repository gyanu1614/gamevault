/**
 * Title Case label for a seller application status. Unknown statuses are
 * rendered honestly (Title Case of the raw value) instead of being mislabelled
 * as Pending Review — that's how withdrawn rows once showed as pending.
 */
const LABELS: Record<string, string> = {
  pending: 'Pending Review',
  under_review: 'Under Review',
  info_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export function applicationStatusLabel(status: string | null | undefined): string {
  const known = LABELS[status ?? 'pending']
  if (known) return known
  return (status ?? 'Unknown')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
