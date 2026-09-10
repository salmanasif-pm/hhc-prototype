import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { candidatesFor, readinessFor, duplicateSubmission, billedAmount, plotException, dueReminders } from './rules';
import { quickBooksCsv, toCsv } from './csv';
import { createActions } from '../store/store';
import type { AppState } from './types';

function harness() {
  let state: AppState = buildSeed();
  const actions = createActions((fn) => { const draft = structuredClone(state); fn(draft); state = draft; }, () => state);
  return { actions, get: () => state };
}
const u = (s: AppState, id: string) => s.users.find((x) => x.id === id)!;

describe('credential readiness', () => {
  it('flags an expired blocking credential as blocked and an expiring one as expiring', () => {
    const s = buildSeed();
    expect(readinessFor(s, u(s, 'c_daniel')).readiness).toBe('blocked');
    expect(readinessFor(s, u(s, 'c_daniel')).blockingLabels[0]).toMatch(/CPR/);
    expect(readinessFor(s, u(s, 'c_elena')).readiness).toBe('expiring');
    expect(readinessFor(s, u(s, 'c_priya')).readiness).toBe('ready');
  });
  it('a blocked clinician becomes ready once a renewal is uploaded and approved', () => {
    const { actions, get } = harness();
    actions.enterDemo('clinician', 'c_daniel');
    const id = actions.uploadCredential('c_daniel', 'cpr', { fileName: 'cpr.pdf', expiresOn: '2028-01-01' });
    expect(readinessFor(get(), u(get(), 'c_daniel')).readiness).toBe('blocked'); // under review does not unblock
    actions.enterDemo('office', 'u_lena');
    actions.reviewCredential(id, 'approve');
    expect(readinessFor(get(), u(get(), 'c_daniel')).readiness).toBe('ready');
  });
  it('an admin override makes a blocked clinician eligible until it expires', () => {
    const { actions, get } = harness();
    actions.enterDemo('office', 'u_jordan');
    actions.addOverride('c_daniel', 'Renewal card seen by email', '2099-01-01');
    expect(readinessFor(get(), u(get(), 'c_daniel')).readiness).toBe('override');
  });
  it('reminders include expiring and expired items sorted by urgency', () => {
    const r = dueReminders(buildSeed());
    expect(r[0]!.clinician.id).toBe('c_daniel');
    expect(r.some((x) => x.clinician.id === 'c_elena')).toBe(true);
  });
});

describe('clinician matching', () => {
  it('uses discipline, coverage, accepting-work and credentials to decide eligibility', () => {
    const s = buildSeed();
    const patient = s.patients.find((p) => p.id === 'p_whitfield')!; // Fremont 94536, PT
    const c = candidatesFor(s, patient, 'PT');
    const byId = Object.fromEntries(c.map((x) => [x.clinician.id, x]));
    expect(byId.c_priya!.eligible).toBe(true);
    expect(byId.c_daniel!.eligible).toBe(false); // blocked
    expect(byId.c_grace!.inCoverage).toBe(false); // Peninsula/South Bay
    expect(byId.c_marcus).toBeUndefined(); // PTA, not PT
    const sj = s.patients.find((p) => p.id === 'p_espinoza')!; // San Jose PT
    const c2 = candidatesFor(s, sj, 'PT');
    expect(c2.find((x) => x.clinician.id === 'c_grace')!.accepting).toBe(false);
    expect(c2.some((x) => x.eligible)).toBe(false);
  });
});

describe('request lifecycle', () => {
  it('first eligible acceptance assigns, creates a visit and a patient chat; later acceptances are rejected', () => {
    const { actions, get } = harness();
    actions.enterDemo('office', 'u_maya');
    const patient = get().patients.find((p) => p.id === 'p_nakamura')!;
    const id = actions.createRequest({ patientId: patient.id, referralId: patient.referrals[0]!.id, discipline: 'PT', visitTypeCode: 'EVAL', visitBy: '2099-01-01T12:00:00.000Z', notesToClinicians: '', officeNotes: '', languages: [] });
    actions.sendRequest(id, { assignMode: 'fcfs', groups: [{ clinicianIds: ['c_priya', 'c_daniel'], delayMinutes: 0 }], exceptions: {} });
    expect(get().requests.find((r) => r.id === id)!.status).toBe('pending');
    const r1 = actions.respond(id, 'c_daniel', 'available'); // blocked -> not auto-assigned
    expect(r1.ok && !r1.assigned).toBe(true);
    const r2 = actions.respond(id, 'c_priya', 'available');
    expect(r2.ok && r2.assigned).toBe(true);
    const req = get().requests.find((r) => r.id === id)!;
    expect(req.status).toBe('assigned');
    expect(req.assignedClinicianId).toBe('c_priya');
    expect(get().visits.filter((v) => v.requestId === id)).toHaveLength(1);
    const conv = get().conversations.find((c) => c.kind === 'patient' && c.patientId === patient.id)!;
    expect(conv.memberIds).toContain('c_priya');
    const r3 = actions.respond(id, 'c_daniel', 'available');
    expect(r3.ok).toBe(false);
  });
  it('reassignment swaps chat membership and keeps one active assignment', () => {
    const { actions, get } = harness();
    actions.enterDemo('office', 'u_jordan');
    actions.assign('rq_chao', 'c_daniel', 'Elena unavailable');
    const req = get().requests.find((r) => r.id === 'rq_chao')!;
    expect(req.assignedClinicianId).toBe('c_daniel');
    const conv = get().conversations.find((c) => c.kind === 'patient' && c.patientId === 'p_chao')!;
    expect(conv.memberIds).toContain('c_daniel');
    expect(conv.memberIds).not.toContain('c_elena');
    expect(get().visits.filter((v) => v.requestId === 'rq_chao')).toHaveLength(1);
  });
});

describe('billing', () => {
  it('uses separate clinician and agency rates, snapshots on approval, and exports a QuickBooks CSV', () => {
    const { actions, get } = harness();
    actions.enterDemo('clinician', 'c_elena');
    const visit = get().visits.find((v) => v.id === 'v_chao')!;
    actions.confirmVisit(visit.id, { visitCompleted: true, noteCompleted: true });
    const r = actions.submitBilling(visit.id, { visitDate: '2026-09-01', memo: 'OT eval done' });
    expect(r.ok).toBe(true);
    const subId = (r as { id: string }).id;
    const sub = get().submissions.find((s) => s.id === subId)!;
    expect(sub.clinicianRate).toBe(110); // Elena OT EVAL
    expect(sub.agencyRate).toBeNull();
    const dup = actions.submitBilling(visit.id, { visitDate: '2026-09-01', memo: '' });
    expect(dup.ok).toBe(false);
    actions.enterDemo('office', 'u_sam');
    actions.approveSubmission(subId);
    const approved = get().submissions.find((s) => s.id === subId)!;
    expect(approved.agencyRate).toBe(145); // Redwood EVAL
    expect(billedAmount(approved)).toBe(145);
    const batch = actions.createInvoiceBatch('ag_redwood', '2026-08-01', '2026-12-31');
    expect(batch.ok).toBe(true);
    const b = get().invoiceBatches.find((x) => x.id === (batch as { id: string }).id)!;
    expect(b.total).toBe(145);
    const csv = quickBooksCsv(get(), b);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('InvoiceNo,Customer,InvoiceDate,DueDate,Terms,Item(Product/Service),ItemDescription,ItemQuantity,ItemRate,ItemAmount,Memo,ServiceDate');
    expect(lines[1]).toContain('Redwood Home Health Services');
    expect(lines[1]).toContain('145.00');
    expect(lines[1]).not.toContain('110'); // clinician rate never exported
    const again = actions.createInvoiceBatch('ag_redwood', '2026-08-01', '2026-12-31');
    expect(again.ok).toBe(false); // no double invoicing
    actions.setPayoutStatus(subId, 'paid', { paymentDate: '2026-09-15', paymentRef: 'ACH 1' });
    expect(get().submissions.find((s) => s.id === subId)!.payoutStatus).toBe('paid');
  });
  it('detects duplicate submissions and plot exceptions', () => {
    const s = buildSeed();
    expect(duplicateSubmission(s, { clinicianId: 'c_priya', patientId: 'p_whitfield', visitDate: s.submissions[0]!.visitDate, visitTypeCode: 'SOC' })).toBeDefined();
    const chao = s.visits.find((v) => v.id === 'v_chao')!;
    expect(plotException(chao, s.requests.find((r) => r.id === 'rq_chao')!.assignedAt)).toBe(true);
  });
  it('escapes CSV fields', () => {
    expect(toCsv([['a,b', 'c"d', 'e']])).toBe('"a,b","c""d",e\r\n');
  });
});
