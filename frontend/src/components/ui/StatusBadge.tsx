import clsx from 'clsx';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple' | 'orange';

const toneClass: Record<Tone, string> = {
  green: 'bg-green-100 text-green-800 ring-green-200',
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  red: 'bg-red-100 text-red-800 ring-red-200',
  blue: 'bg-blue-100 text-blue-800 ring-blue-200',
  gray: 'bg-gray-100 text-gray-700 ring-gray-200',
  purple: 'bg-purple-100 text-purple-800 ring-purple-200',
  orange: 'bg-orange-100 text-orange-800 ring-orange-200',
};

/** One mapping for every status-like value in the app (shelter / stock / transfer / alert / priority / case / checkin). */
const MAP: Record<string, [Tone, string]> = {
  // shelter
  ACTIVE: ['green', 'Active'],
  FULL: ['red', 'Full'],
  INACTIVE: ['gray', 'Inactive'],
  EMERGENCY_CLOSED: ['red', 'Emergency closed'],
  // occupancy classification
  AVAILABLE: ['green', 'Available'],
  CRITICAL: ['red', 'Critical'],
  // stock
  HEALTHY: ['green', 'Healthy'],
  LOW: ['amber', 'Low'],
  EMPTY: ['red', 'Empty'],
  // transfer
  PENDING: ['amber', 'Pending'],
  APPROVED: ['blue', 'Approved'],
  IN_TRANSIT: ['purple', 'In transit'],
  RECEIVED: ['green', 'Received'],
  REJECTED: ['red', 'Rejected'],
  CANCELLED: ['gray', 'Cancelled'],
  // alert
  ACKNOWLEDGED: ['blue', 'Acknowledged'],
  RESOLVED: ['green', 'Resolved'],
  // severity
  INFO: ['blue', 'Info'],
  WARNING: ['amber', 'Warning'],
  // medical priority
  NONE: ['gray', 'None'],
  MEDIUM: ['amber', 'Medium'],
  HIGH: ['orange', 'High'],
  // check-in
  CONFIRMED: ['green', 'Checked in'],
  CHECKED_OUT: ['gray', 'Checked out'],
  // reunification
  MISSING: ['red', 'Missing'],
  POTENTIAL_MATCH: ['amber', 'Potential match'],
  REUNITED: ['green', 'Reunited'],
  CLOSED: ['gray', 'Closed'],
  // donations / shifts
  OPEN: ['green', 'Open'],
};

// LOW means different things for stock (amber) and priority (blue-ish low risk); the context prop disambiguates.
export function StatusBadge({ status, context, className }: { status: string; context?: 'priority'; className?: string }) {
  let [tone, label] = MAP[status] ?? ['gray', status.replace(/_/g, ' ').toLowerCase()];
  if (context === 'priority' && status === 'LOW') [tone, label] = ['blue', 'Low'];
  if (context === 'priority' && status === 'CRITICAL') [tone, label] = ['red', 'Critical'];
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', toneClass[tone], className)}>
      {label}
    </span>
  );
}
