// Domain model for the HHC Operations Platform prototype.
// One shared data set feeds both the Office Staff and Clinician experiences.

export type Discipline = 'PT' | 'PTA' | 'OT' | 'COTA' | 'ST';
export type VisitTypeCode = 'SOC' | 'EVAL' | 'RE_EVAL' | 'FUV' | 'DC';

export interface VisitType {
  code: VisitTypeCode;
  label: string; // e.g. "Start of Care"
  short: string; // e.g. "SOC"
}

export type UserRole = 'admin' | 'office' | 'clinician';
export type UserStatus = 'invited' | 'active' | 'inactive';

export interface OnboardingItem {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  title?: string; // office users: "Intake Coordinator"
  email: string;
  phone?: string;
  status: UserStatus;
  // clinician-only fields
  disciplines?: Discipline[];
  languages?: string[];
  regionIds?: string[];
  homeCity?: string;
  homeZip?: string;
  acceptingWork?: boolean;
  rateCard?: Partial<Record<VisitTypeCode, number>>; // clinician pay rates (office-only visibility)
  onboarding?: OnboardingItem[];
  startedOn?: string; // ISO date
  includeInPatientChats?: boolean; // office users auto-joined to new patient chats
}

export interface Agency {
  id: string;
  name: string;
  emrLabel: string; // "Kinnser", "Devero", "HHMD"
  emrDomain: string; // "kinnser.net"
  billingAddress: string;
  contactEmail: string;
  active: boolean;
  rateCard: Partial<Record<VisitTypeCode, number>>; // agency bill rates
  terms: string; // "Net 30"
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Referral {
  id: string;
  receivedOn: string; // ISO date
  discipline: Discipline;
  visitTypeCode: VisitTypeCode;
  caseNotes: string; // case-management notes
  source: string; // how it arrived (email/phone/portal)
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  mrn?: string;
  phone: string;
  address: Address;
  agencyId: string;
  emrRef: string; // agency EMR reference / label
  insurance: string; // display-only context
  officeNotes: string;
  clinicianNotes: string; // language, PTSOC etc.
  referrals: Referral[];
  attachments: { id: string; name: string; uploadedAt: string; by: string }[];
  createdAt: string;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  at: string;
  actorId: string;
  text: string;
}

export type RequestStatus = 'draft' | 'pending' | 'assigned' | 'closed';
export type ClosedReason = 'cancelled' | 'expired' | 'unstaffed' | 'completed';
export type AssignMode = 'fcfs' | 'office';
export type ResponseValue = 'available' | 'not_available';

export interface Recipient {
  clinicianId: string;
  groupNo: number;
  sentAt: string | null; // null = queued in a later priority group
  readAt: string | null;
  response: ResponseValue | null;
  respondedAt: string | null;
  comment?: string;
  outsideCoverage?: boolean; // office exception
  overrideId?: string; // credential block override used
}

export interface PriorityGroup {
  no: number;
  delayMinutes: number; // wait after previous group, 0 = immediately
  releasedAt: string | null;
}

export interface VisitRequest {
  id: string;
  patientId: string;
  referralId: string;
  agencyId: string;
  discipline: Discipline;
  visitTypeCode: VisitTypeCode;
  visitBy: string; // ISO datetime
  notesToClinicians: string;
  officeNotes: string;
  languages: string[];
  assignMode: AssignMode;
  groups: PriorityGroup[];
  recipients: Recipient[];
  status: RequestStatus;
  closedReason?: ClosedReason;
  assignedClinicianId?: string;
  assignedAt?: string;
  createdAt: string;
  createdBy: string;
  log: HistoryEntry[];
}

export type PlotStatus = 'not_plotted' | 'plotted' | 'delayed';

export interface Visit {
  id: string;
  requestId: string;
  patientId: string;
  clinicianId: string;
  agencyId: string;
  visitTypeCode: VisitTypeCode;
  discipline: Discipline;
  plannedDate: string | null; // ISO date
  plotStatus: PlotStatus;
  plotUpdatedAt: string | null;
  officeNote: string;
  visitCompletedAt: string | null; // clinician declaration
  noteCompletedAt: string | null; // clinician declaration: note done in agency EMR
  billingSubmissionId?: string;
  history: HistoryEntry[];
}

export type SubmissionStatus = 'submitted' | 'approved' | 'returned';
export type PayoutStatus = 'pending' | 'approved' | 'exception' | 'paid';

export interface BillingSubmission {
  id: string;
  visitId: string;
  clinicianId: string;
  patientId: string;
  agencyId: string;
  visitDate: string;
  visitTypeCode: VisitTypeCode;
  clinicianRate: number; // snapshot from clinician rate card at submit
  agencyRate: number | null; // snapshot from agency rate card at approval
  agencyAmountOverride?: { amount: number; reason: string; by: string; at: string };
  memo: string;
  evidenceFileName?: string;
  status: SubmissionStatus;
  returnReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  invoiceBatchId?: string;
  exportedAt?: string;
  payoutStatus: PayoutStatus;
  paymentDate?: string;
  paymentRef?: string;
  history: HistoryEntry[];
}

export interface InvoiceBatch {
  id: string;
  invoiceNo: string;
  agencyId: string;
  from: string;
  to: string;
  lineIds: string[];
  total: number;
  status: 'ready' | 'exported';
  createdAt: string;
  createdBy: string;
  exportedAt?: string;
  exportedBy?: string;
  fileName?: string;
}

export type CredentialType =
  | 'license'
  | 'cpr'
  | 'tb'
  | 'physical'
  | 'drivers_license'
  | 'auto_insurance'
  | 'liability'
  | 'background';

export type CredentialStatus = 'approved' | 'under_review' | 'returned' | 'rejected' | 'missing';

export interface Credential {
  id: string;
  clinicianId: string;
  type: CredentialType;
  fileName?: string;
  issuedOn?: string;
  expiresOn?: string; // ISO date
  status: CredentialStatus;
  uploadedAt?: string;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  history: HistoryEntry[];
}

export interface CredentialRequirement {
  type: CredentialType;
  label: string;
  blocksNewWork: boolean;
  appliesTo: Discipline[] | 'all';
  reminderDays: number[]; // e.g. [30,14,7,0]
}

export interface CredentialOverride {
  id: string;
  clinicianId: string;
  by: string;
  reason: string;
  at: string;
  expiresOn: string;
}

export interface Region {
  id: string;
  name: string;
  mode: 'zip' | 'polygon';
  zips: string[];
  polygonLabel?: string; // human description of drawn area
  clinicianIds: string[];
}

export type ChannelType = 'intake' | 'hr' | 'billing' | 'medical_records' | 'announcements';

export interface Message {
  id: string;
  authorId: string;
  body: string;
  at: string;
  attachmentName?: string;
}

export interface Conversation {
  id: string;
  kind: 'patient' | 'channel';
  patientId?: string;
  channelType?: ChannelType;
  clinicianId?: string; // per-clinician channel instance
  name: string;
  memberIds: string[];
  messages: Message[];
  lastReadAt: Record<string, string>; // userId -> ISO
}

export interface ActivityEntry {
  id: string;
  at: string;
  actorId: string;
  action: string;
  entity: string;
  detail: string;
}

export interface Notification {
  id: string;
  userId: string;
  at: string;
  text: string;
  link: string;
  read: boolean;
}

export interface AppState {
  version: number;
  users: User[];
  agencies: Agency[];
  visitTypes: VisitType[];
  patients: Patient[];
  requests: VisitRequest[];
  visits: Visit[];
  submissions: BillingSubmission[];
  invoiceBatches: InvoiceBatch[];
  credentials: Credential[];
  credentialRequirements: CredentialRequirement[];
  overrides: CredentialOverride[];
  regions: Region[];
  conversations: Conversation[];
  activity: ActivityEntry[];
  notifications: Notification[];
  // demo session (not "auth")
  session: { role: 'office' | 'clinician' | null; userId: string | null };
  seq: number; // id counter
}
