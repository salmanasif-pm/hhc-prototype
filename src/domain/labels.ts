import type {
  CredentialStatus, CredentialType, Discipline, PayoutStatus, PlotStatus, RequestStatus,
  SubmissionStatus, ChannelType, UserRole,
} from './types';

export const DISCIPLINES: Discipline[] = ['PT', 'PTA', 'OT', 'COTA', 'ST'];
export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  PT: 'Physical Therapist',
  PTA: 'Physical Therapist Assistant',
  OT: 'Occupational Therapist',
  COTA: 'Occupational Therapy Assistant',
  ST: 'Speech Therapist',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  assigned: 'Assigned',
  closed: 'Closed',
};
export const PLOT_LABEL: Record<PlotStatus, string> = {
  not_plotted: 'Not plotted',
  plotted: 'Plotted in agency EMR',
  delayed: 'Plot delayed',
};
export const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  submitted: 'Awaiting review',
  approved: 'Approved',
  returned: 'Returned',
};
export const PAYOUT_LABEL: Record<PayoutStatus, string> = {
  pending: 'Pending',
  approved: 'Approved for payment',
  exception: 'Exception',
  paid: 'Paid',
};
export const CREDENTIAL_STATUS_LABEL: Record<CredentialStatus, string> = {
  approved: 'Approved',
  under_review: 'Under review',
  returned: 'Returned',
  rejected: 'Rejected',
  missing: 'Missing',
};
export const CREDENTIAL_TYPE_LABEL: Record<CredentialType, string> = {
  license: 'Professional license',
  cpr: 'CPR / BLS certification',
  tb: 'TB test',
  physical: 'Annual physical',
  drivers_license: "Driver's license",
  auto_insurance: 'Auto insurance',
  liability: 'Professional liability insurance',
  background: 'Background check',
};
export const CHANNEL_LABEL: Record<ChannelType, string> = {
  intake: 'Intake',
  hr: 'Human Resources',
  billing: 'Billing',
  medical_records: 'Medical Records',
  announcements: 'Announcements',
};
export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin / Manager',
  office: 'Office Team',
  clinician: 'Clinician',
};
export const LANGUAGES = ['English', 'Spanish', 'Tagalog', 'Cantonese', 'Mandarin', 'Vietnamese', 'Hindi', 'Russian'];
