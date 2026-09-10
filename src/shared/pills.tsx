import React from 'react';
import { Pill, type Tone } from '../ui';
import type { CredentialStatus, PayoutStatus, PlotStatus, RequestStatus, SubmissionStatus, UserStatus, VisitRequest } from '../domain/types';
import { CREDENTIAL_STATUS_LABEL, PAYOUT_LABEL, PLOT_LABEL, REQUEST_STATUS_LABEL, SUBMISSION_LABEL } from '../domain/labels';
import { READINESS_LABEL, type Readiness, type CredentialLine } from '../domain/rules';

export function RequestPill({ req }: { req: Pick<VisitRequest, 'status' | 'closedReason'> }) {
  const tone: Record<RequestStatus, Tone> = { draft: 'gray', pending: 'amber', assigned: 'green', closed: 'outline' };
  const label = req.status === 'closed' && req.closedReason ? `Closed - ${req.closedReason}` : REQUEST_STATUS_LABEL[req.status];
  return <Pill tone={tone[req.status]} dot>{label}</Pill>;
}
export function PlotPill({ status }: { status: PlotStatus }) {
  const tone: Record<PlotStatus, Tone> = { not_plotted: 'amber', plotted: 'green', delayed: 'red' };
  return <Pill tone={tone[status]} dot>{PLOT_LABEL[status]}</Pill>;
}
export function SubmissionPill({ status }: { status: SubmissionStatus }) {
  const tone: Record<SubmissionStatus, Tone> = { submitted: 'blue', approved: 'green', returned: 'red' };
  return <Pill tone={tone[status]} dot>{SUBMISSION_LABEL[status]}</Pill>;
}
export function PayoutPill({ status }: { status: PayoutStatus }) {
  const tone: Record<PayoutStatus, Tone> = { pending: 'gray', approved: 'blue', exception: 'red', paid: 'green' };
  return <Pill tone={tone[status]}>{PAYOUT_LABEL[status]}</Pill>;
}
export function CredStatusPill({ status }: { status: CredentialStatus }) {
  const tone: Record<CredentialStatus, Tone> = { approved: 'green', under_review: 'periwinkle', returned: 'amber', rejected: 'red', missing: 'red' };
  return <Pill tone={tone[status]}>{CREDENTIAL_STATUS_LABEL[status]}</Pill>;
}
export function LineStatePill({ line }: { line: CredentialLine }) {
  const map: Record<CredentialLine['state'], [Tone, string]> = {
    ok: ['green', line.daysLeft !== null ? `Valid - ${line.daysLeft} days left` : 'Valid'],
    expiring: ['amber', `Expiring in ${line.daysLeft} days`],
    expired: ['red', `Expired ${Math.abs(line.daysLeft ?? 0)} days ago`],
    missing: ['red', 'Missing'],
    under_review: ['periwinkle', 'Under review'],
    returned: ['amber', 'Returned'],
    rejected: ['red', 'Rejected'],
  };
  const [tone, label] = map[line.state];
  return <Pill tone={tone} dot>{label}</Pill>;
}
export function ReadinessPill({ readiness }: { readiness: Readiness }) {
  const tone: Record<Readiness, Tone> = { ready: 'green', expiring: 'amber', blocked: 'red', override: 'periwinkle', under_review: 'periwinkle' };
  return <Pill tone={tone[readiness]} dot>{READINESS_LABEL[readiness]}</Pill>;
}
export function UserStatusPill({ status }: { status: UserStatus }) {
  const tone: Record<UserStatus, Tone> = { active: 'green', invited: 'blue', inactive: 'gray' };
  return <Pill tone={tone[status]}>{status[0]!.toUpperCase() + status.slice(1)}</Pill>;
}
export function Confirmation({ at, label }: { at: string | null; label: string }) {
  return at ? <Pill tone="green" sm>✓ {label}</Pill> : <Pill tone="outline" sm>{label} pending</Pill>;
}
export const _r = React;
