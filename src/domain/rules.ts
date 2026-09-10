import type {
  AppState, BillingSubmission, Credential, CredentialRequirement, CredentialOverride, Discipline,
  Patient, User, VisitRequest, VisitTypeCode, Visit, Region,
} from './types';
import { daysUntil, hoursUntil } from './format';
import { distanceMiles } from './geo';

// ---------- Credential readiness ----------
export type Readiness = 'ready' | 'expiring' | 'blocked' | 'override' | 'under_review';

export interface CredentialLine {
  requirement: CredentialRequirement;
  credential: Credential | undefined;
  state: 'ok' | 'expiring' | 'expired' | 'missing' | 'under_review' | 'returned' | 'rejected';
  daysLeft: number | null;
  nextAction: string;
}

export function requirementsFor(reqs: CredentialRequirement[], disciplines: Discipline[] = []): CredentialRequirement[] {
  return reqs.filter((r) => r.appliesTo === 'all' || r.appliesTo.some((d) => disciplines.includes(d)));
}

export function credentialLines(state: AppState, clinician: User): CredentialLine[] {
  const reqs = requirementsFor(state.credentialRequirements, clinician.disciplines ?? []);
  return reqs.map((requirement) => {
    const creds = state.credentials.filter((c) => c.clinicianId === clinician.id && c.type === requirement.type);
    // Prefer a currently approved doc; then anything under review; else latest.
    const approved = creds.filter((c) => c.status === 'approved').sort((a, b) => (b.expiresOn ?? '').localeCompare(a.expiresOn ?? ''))[0];
    const pending = creds.find((c) => c.status === 'under_review');
    const other = creds.sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''))[0];
    const credential = approved ?? pending ?? other;
    if (!credential || credential.status === 'missing') {
      return { requirement, credential, state: 'missing', daysLeft: null, nextAction: 'Upload document' };
    }
    if (credential.status === 'under_review') {
      return { requirement, credential, state: 'under_review', daysLeft: daysUntil(credential.expiresOn), nextAction: 'Awaiting office review' };
    }
    if (credential.status === 'returned') {
      return { requirement, credential, state: 'returned', daysLeft: null, nextAction: 'Fix and re-upload' };
    }
    if (credential.status === 'rejected') {
      return { requirement, credential, state: 'rejected', daysLeft: null, nextAction: 'Upload a valid document' };
    }
    const daysLeft = daysUntil(credential.expiresOn);
    if (daysLeft !== null && daysLeft < 0) {
      return { requirement, credential, state: 'expired', daysLeft, nextAction: 'Renew now - expired' };
    }
    if (daysLeft !== null && daysLeft <= 30) {
      return { requirement, credential, state: 'expiring', daysLeft, nextAction: `Renew before ${credential.expiresOn}` };
    }
    return { requirement, credential, state: 'ok', daysLeft, nextAction: 'No action' };
  });
}

export function activeOverride(state: AppState, clinicianId: string): CredentialOverride | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return state.overrides.find((o) => o.clinicianId === clinicianId && o.expiresOn >= today);
}

export function readinessFor(state: AppState, clinician: User): { readiness: Readiness; lines: CredentialLine[]; blockingLabels: string[] } {
  const lines = credentialLines(state, clinician);
  const blocking = lines.filter((l) => l.requirement.blocksNewWork && (l.state === 'expired' || l.state === 'missing' || l.state === 'rejected' || l.state === 'returned'));
  const blockingLabels = blocking.map((l) => `${l.requirement.label} (${l.state})`);
  if (blocking.length > 0) {
    if (activeOverride(state, clinician.id)) return { readiness: 'override', lines, blockingLabels };
    return { readiness: 'blocked', lines, blockingLabels };
  }
  if (lines.some((l) => l.state === 'under_review' && l.requirement.blocksNewWork)) return { readiness: 'under_review', lines, blockingLabels };
  if (lines.some((l) => l.state === 'expiring')) return { readiness: 'expiring', lines, blockingLabels };
  return { readiness: 'ready', lines, blockingLabels };
}

export const READINESS_LABEL: Record<Readiness, string> = {
  ready: 'Ready',
  expiring: 'Expiring soon',
  blocked: 'Blocked',
  override: 'Override active',
  under_review: 'Under review',
};

// ---------- Matching ----------
export interface Candidate {
  clinician: User;
  inCoverage: boolean;
  distance: number | null;
  readiness: Readiness;
  blockingLabels: string[];
  accepting: boolean;
  languageMatch: boolean;
  eligible: boolean; // can be sent a request without an exception
}

export function regionsFor(state: AppState, clinicianId: string): Region[] {
  return state.regions.filter((r) => r.clinicianIds.includes(clinicianId));
}

export function coversZip(state: AppState, clinicianId: string, zip: string): boolean {
  return regionsFor(state, clinicianId).some((r) => r.zips.includes(zip));
}

export function candidatesFor(state: AppState, patient: Patient, discipline: Discipline, languages: string[] = []): Candidate[] {
  const clinicians = state.users.filter((u) => u.role === 'clinician' && u.status === 'active');
  return clinicians
    .map((clinician) => {
      const { readiness, blockingLabels } = readinessFor(state, clinician);
      const inCoverage = coversZip(state, clinician.id, patient.address.zip);
      const disciplineMatch = (clinician.disciplines ?? []).includes(discipline);
      const distance = clinician.homeZip ? distanceMiles(clinician.homeZip, patient.address.zip) : null;
      const accepting = clinician.acceptingWork !== false;
      const languageMatch = languages.length === 0 || languages.some((l) => (clinician.languages ?? []).includes(l));
      const eligible = disciplineMatch && inCoverage && accepting && readiness !== 'blocked';
      return { clinician, inCoverage, distance, readiness, blockingLabels, accepting, languageMatch, eligible, disciplineMatch };
    })
    .filter((c) => c.disciplineMatch)
    .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
    .map(({ disciplineMatch: _d, ...rest }) => rest);
}

// ---------- Requests ----------
export function isExpiringSoon(req: VisitRequest): boolean {
  return req.status === 'pending' && hoursUntil(req.visitBy) < 24;
}
export function recipientsSent(req: VisitRequest) {
  return req.recipients.filter((r) => r.sentAt);
}
export function responseSummary(req: VisitRequest) {
  const sent = recipientsSent(req);
  return {
    available: sent.filter((r) => r.response === 'available').length,
    notAvailable: sent.filter((r) => r.response === 'not_available').length,
    read: sent.filter((r) => !r.response && r.readAt).length,
    waiting: sent.filter((r) => !r.response && !r.readAt).length,
    sent: sent.length,
    queued: req.recipients.length - sent.length,
  };
}

// ---------- Visits & billing ----------
export function plotException(visit: Visit, assignedAt: string | undefined): boolean {
  if (visit.plotStatus === 'plotted') return false;
  if (!assignedAt) return false;
  return -hoursUntil(assignedAt) > 24;
}
export function visitReadyToSubmit(visit: Visit): boolean {
  return !!visit.visitCompletedAt && !!visit.noteCompletedAt && !visit.billingSubmissionId;
}
export function clinicianRate(state: AppState, clinicianId: string, code: VisitTypeCode): number | null {
  const c = state.users.find((u) => u.id === clinicianId);
  return c?.rateCard?.[code] ?? null;
}
export function agencyRate(state: AppState, agencyId: string, code: VisitTypeCode): number | null {
  const a = state.agencies.find((x) => x.id === agencyId);
  return a?.rateCard?.[code] ?? null;
}
export function billedAmount(s: BillingSubmission): number {
  return s.agencyAmountOverride?.amount ?? s.agencyRate ?? 0;
}
export function duplicateSubmission(state: AppState, s: Pick<BillingSubmission, 'clinicianId' | 'patientId' | 'visitDate' | 'visitTypeCode'>, excludeId?: string): BillingSubmission | undefined {
  return state.submissions.find(
    (x) => x.id !== excludeId && x.clinicianId === s.clinicianId && x.patientId === s.patientId && x.visitDate === s.visitDate && x.visitTypeCode === s.visitTypeCode,
  );
}

// ---------- Reminders ----------
export interface Reminder { clinician: User; line: CredentialLine; milestone: number }
export function dueReminders(state: AppState): Reminder[] {
  const out: Reminder[] = [];
  for (const c of state.users.filter((u) => u.role === 'clinician' && u.status === 'active')) {
    for (const line of credentialLines(state, c)) {
      if (line.daysLeft === null) continue;
      if (line.state !== 'expiring' && line.state !== 'expired') continue;
      const milestones = line.requirement.reminderDays;
      const next = milestones.find((m) => line.daysLeft! <= m) ?? milestones[milestones.length - 1]!;
      out.push({ clinician: c, line, milestone: next });
    }
  }
  return out.sort((a, b) => (a.line.daysLeft ?? 0) - (b.line.daysLeft ?? 0));
}

// ---------- Duplicate patient detection ----------
export function possibleDuplicates(patients: Patient[], first: string, last: string, dob: string, mrn?: string): Patient[] {
  const f = first.trim().toLowerCase();
  const l = last.trim().toLowerCase();
  return patients.filter((p) => {
    if (mrn && p.mrn && p.mrn === mrn) return true;
    const sameName = p.firstName.toLowerCase() === f && p.lastName.toLowerCase() === l;
    return sameName && (!dob || !p.dob || p.dob === dob || true);
  });
}
