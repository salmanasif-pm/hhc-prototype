import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppState, AssignMode, BillingSubmission, ClosedReason, Conversation, Credential, CredentialType, Discipline,
  HistoryEntry, InvoiceBatch, Patient, PayoutStatus, PlotStatus, Referral, Region, ResponseValue, User,
  VisitRequest, VisitTypeCode, CredentialRequirement, Agency,
} from '../domain/types';
import { buildSeed, STATE_VERSION } from '../data/seed';
import { nowIso, todayIso } from '../domain/format';
import { agencyRate, clinicianRate, coversZip, readinessFor } from '../domain/rules';
import { quickBooksCsv } from '../domain/csv';

const KEY = 'hhc-prototype-state';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === STATE_VERSION) return parsed;
    }
  } catch {
    /* fall through to a fresh seed */
  }
  return buildSeed();
}
function save(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: demo still works in memory */
  }
}
const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

// ---------------- helpers on a mutable draft ----------------
function nextId(s: AppState, prefix: string): string {
  s.seq += 1;
  return `${prefix}_${s.seq}`;
}
function actor(s: AppState): string {
  return s.session.userId ?? 'system';
}
function entry(s: AppState, text: string, actorId?: string): HistoryEntry {
  return { at: nowIso(), actorId: actorId ?? actor(s), text };
}
function audit(s: AppState, action: string, entity: string, detail: string, actorId?: string) {
  s.activity.unshift({ id: nextId(s, 'act'), at: nowIso(), actorId: actorId ?? actor(s), action, entity, detail });
}
function notify(s: AppState, userId: string, text: string, link: string) {
  s.notifications.unshift({ id: nextId(s, 'n'), userId, at: nowIso(), text, link, read: false });
}
function officeIds(s: AppState) {
  return s.users.filter((u) => u.role !== 'clinician' && u.status === 'active').map((u) => u.id);
}
function userName(s: AppState, id: string) {
  return s.users.find((u) => u.id === id)?.name ?? (id === 'system' ? 'System' : id);
}
function patientName(p: Patient) {
  return `${p.firstName} ${p.lastName}`;
}
function findReq(s: AppState, id: string) {
  const r = s.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found');
  return r;
}

function doAssign(s: AppState, req: VisitRequest, clinicianId: string, how: string) {
  const patient = s.patients.find((p) => p.id === req.patientId)!;
  const clinician = s.users.find((u) => u.id === clinicianId)!;
  const previous = req.assignedClinicianId;
  req.status = 'assigned';
  req.assignedClinicianId = clinicianId;
  req.assignedAt = nowIso();
  req.closedReason = undefined;
  req.log.push(entry(s, `Assigned to ${clinician.name} (${how})`, 'system'));
  // one visit per request
  let visit = s.visits.find((v) => v.requestId === req.id);
  if (!visit) {
    visit = {
      id: nextId(s, 'v'), requestId: req.id, patientId: req.patientId, clinicianId, agencyId: req.agencyId, visitTypeCode: req.visitTypeCode,
      discipline: req.discipline, plannedDate: null, plotStatus: 'not_plotted', plotUpdatedAt: null, officeNote: '', visitCompletedAt: null, noteCompletedAt: null,
      history: [entry(s, 'Visit created on assignment', 'system')],
    };
    s.visits.push(visit);
  } else if (visit.clinicianId !== clinicianId) {
    visit.clinicianId = clinicianId;
    visit.history.push(entry(s, `Reassigned to ${clinician.name}`));
  }
  // patient conversation
  let conv = s.conversations.find((c) => c.kind === 'patient' && c.patientId === req.patientId);
  const team = s.users.filter((u) => u.role !== 'clinician' && u.status === 'active' && (u.includeInPatientChats || u.role === 'admin')).map((u) => u.id);
  if (!conv) {
    conv = { id: nextId(s, 'conv'), kind: 'patient', patientId: req.patientId, name: patientName(patient), memberIds: [...team, clinicianId], messages: [], lastReadAt: {} };
    s.conversations.push(conv);
    conv.messages.push({ id: nextId(s, 'm'), authorId: 'system', at: nowIso(), body: `${clinician.name} was assigned to ${patientName(patient)}. This conversation is shared with the intake team.` });
  } else {
    if (previous && previous !== clinicianId) conv.memberIds = conv.memberIds.filter((m) => m !== previous);
    if (!conv.memberIds.includes(clinicianId)) conv.memberIds.push(clinicianId);
    conv.messages.push({ id: nextId(s, 'm'), authorId: 'system', at: nowIso(), body: `${clinician.name} joined as the assigned clinician.` });
  }
  notify(s, clinicianId, `You are assigned to ${patientName(patient)} (${req.visitTypeCode}). Open the patient for details.`, `/clinician/patients/${patient.id}`);
  for (const o of officeIds(s)) notify(s, o, `${clinician.name} assigned to ${patientName(patient)} (${how})`, `/office/scheduling/requests/${req.id}`);
  audit(s, 'assignment', `Request ${req.id}`, `${clinician.name} assigned - ${how}`, 'system');
  patient.history.push(entry(s, `Assigned clinician: ${clinician.name}`, 'system'));
}

// ---------------- actions ----------------
export function createActions(update: (fn: (s: AppState) => void) => void, getState: () => AppState) {
  const act = <A extends any[], R>(fn: (s: AppState, ...args: A) => R) => (...args: A): R => {
    let result!: R;
    update((s) => { result = fn(s, ...args); });
    return result;
  };
  return {
    // ---- session / demo ----
    enterDemo: act((s, role: 'office' | 'clinician', userId: string) => { s.session = { role, userId }; }),
    exitDemo: act((s) => { s.session = { role: null, userId: null }; }),
    reset: () => update((s) => { Object.assign(s, buildSeed()); }),
    markNotificationsRead: act((s, userId: string) => { s.notifications.forEach((n) => { if (n.userId === userId) n.read = true; }); }),

    // ---- patients ----
    addPatient: act((s, data: Omit<Patient, 'id' | 'referrals' | 'attachments' | 'createdAt' | 'history'>, referral: Omit<Referral, 'id'>) => {
      const id = nextId(s, 'p');
      const p: Patient = { ...data, id, referrals: [{ ...referral, id: nextId(s, 'ref') }], attachments: [], createdAt: nowIso(), history: [entry(s, 'Patient and referral added')] };
      s.patients.unshift(p);
      audit(s, 'patient.create', patientName(p), `Referral from ${s.agencies.find((a) => a.id === p.agencyId)?.name}`);
      return id;
    }),
    updatePatient: act((s, id: string, patch: Partial<Patient>, note = 'Operational details updated') => {
      const p = s.patients.find((x) => x.id === id)!;
      Object.assign(p, patch);
      p.history.push(entry(s, note));
      audit(s, 'patient.update', patientName(p), note);
    }),
    addReferral: act((s, patientId: string, referral: Omit<Referral, 'id'>) => {
      const p = s.patients.find((x) => x.id === patientId)!;
      const id = nextId(s, 'ref');
      p.referrals.push({ ...referral, id });
      p.history.push(entry(s, `New referral recorded (${referral.discipline} ${referral.visitTypeCode})`));
      return id;
    }),
    addAttachment: act((s, patientId: string, name: string) => {
      const p = s.patients.find((x) => x.id === patientId)!;
      p.attachments.push({ id: nextId(s, 'att'), name, uploadedAt: nowIso(), by: actor(s) });
      p.history.push(entry(s, `Attachment added: ${name}`));
    }),

    // ---- requests ----
    createRequest: act((s, data: { patientId: string; referralId: string; discipline: Discipline; visitTypeCode: VisitTypeCode; visitBy: string; notesToClinicians: string; officeNotes: string; languages: string[] }) => {
      const patient = s.patients.find((p) => p.id === data.patientId)!;
      const id = nextId(s, 'rq');
      s.requests.unshift({
        id, ...data, agencyId: patient.agencyId, assignMode: 'fcfs', groups: [{ no: 1, delayMinutes: 0, releasedAt: null }], recipients: [], status: 'draft',
        createdAt: nowIso(), createdBy: actor(s), log: [entry(s, 'Request created as draft')],
      });
      patient.history.push(entry(s, `Visit request created (${data.discipline} ${data.visitTypeCode})`));
      return id;
    }),
    updateRequest: act((s, id: string, patch: Partial<VisitRequest>) => {
      const r = findReq(s, id);
      Object.assign(r, patch);
      r.log.push(entry(s, 'Request details updated'));
    }),
    sendRequest: act((s, id: string, plan: { assignMode: AssignMode; groups: { clinicianIds: string[]; delayMinutes: number }[]; exceptions: Record<string, { outsideCoverage?: boolean; overrideId?: string }> }) => {
      const r = findReq(s, id);
      const patient = s.patients.find((p) => p.id === r.patientId)!;
      r.assignMode = plan.assignMode;
      r.groups = plan.groups.map((g, i) => ({ no: i + 1, delayMinutes: g.delayMinutes, releasedAt: i === 0 ? nowIso() : null }));
      r.recipients = plan.groups.flatMap((g, i) => g.clinicianIds.map((cid) => ({
        clinicianId: cid, groupNo: i + 1, sentAt: i === 0 ? nowIso() : null, readAt: null, response: null, respondedAt: null, ...(plan.exceptions[cid] ?? {}),
      })));
      r.status = 'pending';
      const g1 = plan.groups[0]?.clinicianIds ?? [];
      const mode = plan.assignMode === 'fcfs' ? 'first-come-first-served' : 'office selection';
      r.log.push(entry(s, `Sent to ${g1.length} clinician(s) in priority group 1 (${mode})${plan.groups.length > 1 ? `; ${plan.groups.length - 1} more group(s) queued` : ''}`));
      const exceptions = Object.entries(plan.exceptions);
      if (exceptions.length) r.log.push(entry(s, `Exceptions recorded: ${exceptions.map(([cid, e]) => `${userName(s, cid)} (${e.overrideId ? 'credential override' : 'outside coverage'})`).join(', ')}`));
      for (const cid of g1) notify(s, cid, `New visit request: ${r.discipline} ${s.visitTypes.find((v) => v.code === r.visitTypeCode)?.label} in ${patient.address.city} ${patient.address.zip}`, '/clinician/requests');
      audit(s, 'request.send', `Request for ${patientName(patient)}`, `Sent to ${g1.length} clinician(s), ${mode}`);
    }),
    releaseNextGroup: act((s, id: string) => {
      const r = findReq(s, id);
      const next = r.groups.find((g) => !g.releasedAt);
      if (!next) return false;
      next.releasedAt = nowIso();
      const patient = s.patients.find((p) => p.id === r.patientId)!;
      let count = 0;
      for (const rc of r.recipients) if (rc.groupNo === next.no && !rc.sentAt) { rc.sentAt = nowIso(); count++; notify(s, rc.clinicianId, `New visit request: ${r.discipline} ${r.visitTypeCode} in ${patient.address.city}`, '/clinician/requests'); }
      r.log.push(entry(s, `Released priority group ${next.no} manually (${count} clinician(s))`));
      return true;
    }),
    markRequestRead: act((s, id: string, clinicianId: string) => {
      const r = findReq(s, id);
      const rc = r.recipients.find((x) => x.clinicianId === clinicianId && x.sentAt);
      if (rc && !rc.readAt) { rc.readAt = nowIso(); r.log.push(entry(s, 'Read the request', clinicianId)); }
    }),
    respond: act((s, id: string, clinicianId: string, response: ResponseValue, comment?: string) => {
      const r = findReq(s, id);
      if (r.status !== 'pending') return { ok: false as const, reason: `This request is already ${r.status}.` };
      const rc = r.recipients.find((x) => x.clinicianId === clinicianId && x.sentAt);
      if (!rc) return { ok: false as const, reason: 'This request was not sent to you.' };
      rc.response = response; rc.respondedAt = nowIso(); rc.comment = comment; rc.readAt = rc.readAt ?? nowIso();
      r.log.push(entry(s, `Responded ${response === 'available' ? 'Available' : 'Not Available'}${comment ? ` - "${comment}"` : ''}`, clinicianId));
      const patient = s.patients.find((p) => p.id === r.patientId)!;
      for (const o of officeIds(s)) notify(s, o, `${userName(s, clinicianId)} responded ${response === 'available' ? 'Available' : 'Not Available'} for ${patientName(patient)}`, `/office/scheduling/requests/${r.id}`);
      if (response === 'available' && r.assignMode === 'fcfs') {
        const clinician = s.users.find((u) => u.id === clinicianId)!;
        const eligible = readinessFor(s, clinician).readiness !== 'blocked' || !!rc.overrideId;
        if (eligible) { doAssign(s, r, clinicianId, 'first eligible acceptance'); return { ok: true as const, assigned: true }; }
        r.log.push(entry(s, `${clinician.name} accepted but is credential-blocked; office review required`, 'system'));
      }
      return { ok: true as const, assigned: false };
    }),
    assign: act((s, id: string, clinicianId: string, reason?: string) => {
      const r = findReq(s, id);
      const how = r.status === 'assigned' ? `reassigned by office${reason ? ': ' + reason : ''}` : `office selection${reason ? ': ' + reason : ''}`;
      if (r.status === 'assigned' && r.assignedClinicianId) r.log.push(entry(s, `Assignment to ${userName(s, r.assignedClinicianId)} closed${reason ? ` - ${reason}` : ''}`));
      doAssign(s, r, clinicianId, how);
    }),
    closeRequest: act((s, id: string, reason: ClosedReason, note?: string) => {
      const r = findReq(s, id);
      r.status = 'closed'; r.closedReason = reason;
      r.log.push(entry(s, `Closed - ${reason}${note ? `: ${note}` : ''}`));
      audit(s, 'request.close', `Request ${id}`, reason);
    }),
    reopenRequest: act((s, id: string) => {
      const r = findReq(s, id);
      r.status = r.recipients.some((x) => x.sentAt) ? 'pending' : 'draft'; r.closedReason = undefined;
      r.log.push(entry(s, `Reopened as ${r.status}`));
    }),

    // ---- visits ----
    setPlannedDate: act((s, visitId: string, date: string | null) => {
      const v = s.visits.find((x) => x.id === visitId)!;
      const old = v.plannedDate; v.plannedDate = date;
      v.history.push(entry(s, `Planned date ${old ? 'changed' : 'set'} to ${date ?? 'unscheduled'}`));
      const p = s.patients.find((x) => x.id === v.patientId)!;
      if (old !== date && date) notify(s, v.clinicianId, `Planned visit date for ${patientName(p)} is now ${date}`, '/clinician/schedule');
    }),
    setPlotStatus: act((s, visitId: string, status: PlotStatus, note?: string) => {
      const v = s.visits.find((x) => x.id === visitId)!;
      v.plotStatus = status; v.plotUpdatedAt = nowIso(); if (note !== undefined) v.officeNote = note;
      const a = s.agencies.find((x) => x.id === v.agencyId)!;
      v.history.push(entry(s, `EMR plot status: ${status.replace('_', ' ')} (${a.emrLabel})${note ? ` - ${note}` : ''}`));
      if (status === 'plotted') {
        const p = s.patients.find((x) => x.id === v.patientId)!;
        notify(s, v.clinicianId, `${patientName(p)} is plotted in ${a.emrLabel}. You are clear to visit.`, '/clinician/schedule');
        const conv = s.conversations.find((c) => c.kind === 'patient' && c.patientId === v.patientId);
        conv?.messages.push({ id: nextId(s, 'm'), authorId: actor(s), at: nowIso(), body: `Visit is plotted in ${a.emrLabel}${v.plannedDate ? ` for ${v.plannedDate}` : ''}. You are good to go.` });
      }
    }),
    confirmVisit: act((s, visitId: string, what: { visitCompleted?: boolean; noteCompleted?: boolean }) => {
      const v = s.visits.find((x) => x.id === visitId)!;
      if (what.visitCompleted !== undefined) v.visitCompletedAt = what.visitCompleted ? nowIso() : null;
      if (what.noteCompleted !== undefined) v.noteCompletedAt = what.noteCompleted ? nowIso() : null;
      const parts = [what.visitCompleted !== undefined ? `visit completed: ${what.visitCompleted ? 'yes' : 'no'}` : null, what.noteCompleted !== undefined ? `note completed in agency EMR: ${what.noteCompleted ? 'yes' : 'no'}` : null].filter(Boolean);
      v.history.push(entry(s, `Clinician confirmation - ${parts.join(', ')}`));
    }),

    // ---- billing ----
    submitBilling: act((s, visitId: string, data: { visitDate: string; memo: string; evidenceFileName?: string }) => {
      const v = s.visits.find((x) => x.id === visitId)!;
      const rate = clinicianRate(s, v.clinicianId, v.visitTypeCode);
      if (rate === null) return { ok: false as const, reason: 'No clinician rate on file for this visit type. Ask the office to update your rate card.' };
      const dup = s.submissions.find((x) => x.clinicianId === v.clinicianId && x.patientId === v.patientId && x.visitDate === data.visitDate && x.visitTypeCode === v.visitTypeCode);
      if (dup) return { ok: false as const, reason: `A submission for this patient, visit type and date already exists (${dup.id}).` };
      const id = nextId(s, 'bs');
      const sub: BillingSubmission = {
        id, visitId, clinicianId: v.clinicianId, patientId: v.patientId, agencyId: v.agencyId, visitDate: data.visitDate, visitTypeCode: v.visitTypeCode,
        clinicianRate: rate, agencyRate: null, memo: data.memo, evidenceFileName: data.evidenceFileName, status: 'submitted', submittedAt: nowIso(), payoutStatus: 'pending',
        history: [entry(s, 'Submitted for billing review')],
      };
      s.submissions.unshift(sub);
      v.billingSubmissionId = id;
      v.history.push(entry(s, 'Billing submitted'));
      const p = s.patients.find((x) => x.id === v.patientId)!;
      for (const o of officeIds(s)) notify(s, o, `${userName(s, v.clinicianId)} submitted billing for ${patientName(p)} (${v.visitTypeCode})`, '/office/billing');
      return { ok: true as const, id };
    }),
    resubmitBilling: act((s, subId: string, data: { visitDate: string; memo: string }) => {
      const sub = s.submissions.find((x) => x.id === subId)!;
      if (sub.status !== 'returned' && sub.status !== 'submitted') return { ok: false as const, reason: 'Only returned or pending submissions can be edited.' };
      const dup = s.submissions.find((x) => x.id !== subId && x.clinicianId === sub.clinicianId && x.patientId === sub.patientId && x.visitDate === data.visitDate && x.visitTypeCode === sub.visitTypeCode);
      if (dup) return { ok: false as const, reason: 'Another submission already exists for that date.' };
      sub.visitDate = data.visitDate; sub.memo = data.memo; sub.status = 'submitted'; sub.returnReason = undefined; sub.submittedAt = nowIso();
      sub.history.push(entry(s, `Corrected and resubmitted (visit date ${data.visitDate})`));
      return { ok: true as const };
    }),
    approveSubmission: act((s, subId: string, override?: { amount: number; reason: string }) => {
      const sub = s.submissions.find((x) => x.id === subId)!;
      const aRate = agencyRate(s, sub.agencyId, sub.visitTypeCode);
      if (aRate === null && !override) return { ok: false as const, reason: 'No agency rate on file for this visit type. Add it under Billing > Rates first.' };
      sub.status = 'approved'; sub.agencyRate = aRate; sub.reviewedAt = nowIso(); sub.reviewedBy = actor(s); sub.returnReason = undefined;
      if (override) sub.agencyAmountOverride = { ...override, by: actor(s), at: nowIso() };
      sub.payoutStatus = sub.payoutStatus === 'pending' ? 'approved' : sub.payoutStatus;
      sub.history.push(entry(s, `Approved. Clinician rate $${sub.clinicianRate.toFixed(2)}, agency rate $${(aRate ?? 0).toFixed(2)} snapshotted${override ? `; agency amount adjusted to $${override.amount.toFixed(2)} (${override.reason})` : ''}.`));
      const p = s.patients.find((x) => x.id === sub.patientId)!;
      notify(s, sub.clinicianId, `Billing approved: ${patientName(p)} ${sub.visitTypeCode} on ${sub.visitDate}`, '/clinician/billing');
      audit(s, 'billing.approve', `Submission ${subId}`, `Clinician $${sub.clinicianRate} / agency $${aRate}`);
      return { ok: true as const };
    }),
    returnSubmission: act((s, subId: string, reason: string) => {
      const sub = s.submissions.find((x) => x.id === subId)!;
      sub.status = 'returned'; sub.returnReason = reason; sub.reviewedAt = nowIso(); sub.reviewedBy = actor(s);
      sub.history.push(entry(s, `Returned: ${reason}`));
      const p = s.patients.find((x) => x.id === sub.patientId)!;
      notify(s, sub.clinicianId, `Billing returned: ${patientName(p)} ${sub.visitTypeCode} - ${reason}`, '/clinician/billing');
      audit(s, 'billing.return', `Submission ${subId}`, reason);
    }),
    createInvoiceBatch: act((s, agencyId: string, from: string, to: string) => {
      const lines = s.submissions.filter((x) => x.agencyId === agencyId && x.status === 'approved' && !x.invoiceBatchId && x.visitDate >= from && x.visitDate <= to);
      if (lines.length === 0) return { ok: false as const, reason: 'No approved, uninvoiced lines in that range.' };
      const agency = s.agencies.find((a) => a.id === agencyId)!;
      const prefix = agency.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 3);
      const count = s.invoiceBatches.filter((b) => b.agencyId === agencyId).length;
      const invoiceNo = `INV-${prefix}-${String(1043 + count).padStart(4, '0')}`;
      const id = nextId(s, 'inv');
      const total = lines.reduce((sum, l) => sum + (l.agencyAmountOverride?.amount ?? l.agencyRate ?? 0), 0);
      const batch: InvoiceBatch = { id, invoiceNo, agencyId, from, to, lineIds: lines.map((l) => l.id), total, status: 'ready', createdAt: nowIso(), createdBy: actor(s) };
      s.invoiceBatches.unshift(batch);
      for (const l of lines) { l.invoiceBatchId = id; l.history.push(entry(s, `Included in invoice ${invoiceNo}`)); }
      audit(s, 'invoice.create', invoiceNo, `${lines.length} line(s), $${total.toFixed(2)} for ${agency.name}`);
      return { ok: true as const, id };
    }),
    exportBatch: act((s, batchId: string) => {
      const b = s.invoiceBatches.find((x) => x.id === batchId)!;
      const agency = s.agencies.find((a) => a.id === b.agencyId)!;
      const csv = quickBooksCsv(s, b);
      const fileName = `quickbooks-${agency.name.split(' ')[0]!.toLowerCase()}-${b.invoiceNo}.csv`;
      const re = b.status === 'exported';
      b.status = 'exported'; b.exportedAt = nowIso(); b.exportedBy = actor(s); b.fileName = fileName;
      for (const id of b.lineIds) { const l = s.submissions.find((x) => x.id === id)!; l.exportedAt = nowIso(); l.history.push(entry(s, `${re ? 'Re-exported' : 'Exported'} for QuickBooks (${fileName})`)); }
      audit(s, 'export', b.invoiceNo, `${re ? 'Re-export' : 'QuickBooks file downloaded'} (${b.lineIds.length} line(s), $${b.total.toFixed(2)})`);
      return { csv, fileName };
    }),
    setPayoutStatus: act((s, subId: string, status: PayoutStatus, detail: { paymentDate?: string; paymentRef?: string; note?: string }) => {
      const sub = s.submissions.find((x) => x.id === subId)!;
      sub.payoutStatus = status; sub.paymentDate = detail.paymentDate; sub.paymentRef = detail.paymentRef;
      sub.history.push(entry(s, `Payout status set to ${status}${detail.paymentRef ? ` - ${detail.paymentRef}` : ''}${detail.paymentDate ? ` on ${detail.paymentDate}` : ''}${detail.note ? ` (${detail.note})` : ''}`));
      const p = s.patients.find((x) => x.id === sub.patientId)!;
      notify(s, sub.clinicianId, `Payout status for ${patientName(p)} ${sub.visitTypeCode}: ${status}`, '/clinician/billing');
      audit(s, 'payout.status', `Submission ${subId}`, status);
    }),
    updateClinicianRate: act((s, clinicianId: string, code: VisitTypeCode, amount: number | null) => {
      const c = s.users.find((u) => u.id === clinicianId)!;
      c.rateCard = { ...(c.rateCard ?? {}) };
      if (amount === null) delete c.rateCard[code]; else c.rateCard[code] = amount;
      audit(s, 'rate.clinician', c.name, `${code}: ${amount === null ? 'removed' : '$' + amount}`);
    }),
    updateAgencyRate: act((s, agencyId: string, code: VisitTypeCode, amount: number | null) => {
      const a = s.agencies.find((x) => x.id === agencyId)!;
      a.rateCard = { ...a.rateCard };
      if (amount === null) delete a.rateCard[code]; else a.rateCard[code] = amount;
      audit(s, 'rate.agency', a.name, `${code}: ${amount === null ? 'removed' : '$' + amount}`);
    }),
    upsertAgency: act((s, data: Partial<Agency> & { name: string }) => {
      if (data.id) { const a = s.agencies.find((x) => x.id === data.id)!; Object.assign(a, data); audit(s, 'agency.update', a.name, 'Updated'); return a.id; }
      const id = nextId(s, 'ag');
      s.agencies.push({ id, name: data.name, emrLabel: data.emrLabel ?? 'Kinnser', emrDomain: data.emrDomain ?? '', billingAddress: data.billingAddress ?? '', contactEmail: data.contactEmail ?? '', active: true, terms: data.terms ?? 'Net 30', rateCard: data.rateCard ?? {} });
      audit(s, 'agency.create', data.name, 'Added');
      return id;
    }),

    // ---- credentials ----
    uploadCredential: act((s, clinicianId: string, type: CredentialType, data: { fileName: string; expiresOn?: string; issuedOn?: string }) => {
      const id = nextId(s, 'cr');
      const c: Credential = { id, clinicianId, type, fileName: data.fileName, expiresOn: data.expiresOn, issuedOn: data.issuedOn, status: 'under_review', uploadedAt: nowIso(), history: [entry(s, 'Uploaded document', clinicianId)] };
      // Remove placeholder "missing" records for the same type
      s.credentials = s.credentials.filter((x) => !(x.clinicianId === clinicianId && x.type === type && x.status === 'missing'));
      s.credentials.unshift(c);
      const u = s.users.find((x) => x.id === clinicianId);
      const item = u?.onboarding?.find((o) => o.key === type || (type === 'drivers_license' && o.key === 'drivers') || (type === 'auto_insurance' && o.key === 'drivers'));
      if (item) item.done = true;
      for (const o of officeIds(s)) notify(s, o, `${userName(s, clinicianId)} uploaded ${type.replace('_', ' ')} for review`, '/office/credentials');
      audit(s, 'credential.upload', userName(s, clinicianId), type, clinicianId);
      return id;
    }),
    reviewCredential: act((s, credId: string, decision: 'approve' | 'return' | 'reject', note?: string) => {
      const c = s.credentials.find((x) => x.id === credId)!;
      c.status = decision === 'approve' ? 'approved' : decision === 'return' ? 'returned' : 'rejected';
      c.reviewNote = note; c.reviewedBy = actor(s); c.reviewedAt = nowIso();
      c.history.push(entry(s, `${decision === 'approve' ? 'Approved' : decision === 'return' ? 'Returned' : 'Rejected'}${note ? `: ${note}` : ''}`));
      if (decision === 'approve') {
        // supersede older approved documents of the same type
        for (const other of s.credentials) if (other.id !== c.id && other.clinicianId === c.clinicianId && other.type === c.type && other.status === 'approved') { other.status = 'rejected'; other.reviewNote = 'Superseded by newer approved document'; other.history.push(entry(s, 'Superseded by newer approved document', 'system')); }
      }
      const clinician = s.users.find((u) => u.id === c.clinicianId)!;
      const ready = readinessFor(s, clinician).readiness;
      notify(s, c.clinicianId, `Credential ${c.type.replace('_', ' ')} ${c.status.replace('_', ' ')}${note ? ` - ${note}` : ''}. Eligibility: ${ready}.`, '/clinician/credentials');
      audit(s, `credential.${decision}`, `${clinician.name} - ${c.type}`, note ?? '');
    }),
    addOverride: act((s, clinicianId: string, reason: string, expiresOn: string) => {
      const id = nextId(s, 'ov');
      s.overrides.push({ id, clinicianId, by: actor(s), reason, at: nowIso(), expiresOn });
      audit(s, 'credential.override', userName(s, clinicianId), `${reason} (until ${expiresOn})`);
      return id;
    }),
    removeOverride: act((s, id: string) => {
      const o = s.overrides.find((x) => x.id === id);
      s.overrides = s.overrides.filter((x) => x.id !== id);
      if (o) audit(s, 'credential.override.remove', userName(s, o.clinicianId), 'Override removed');
    }),
    updateRequirement: act((s, type: CredentialType, patch: Partial<CredentialRequirement>) => {
      const r = s.credentialRequirements.find((x) => x.type === type)!;
      Object.assign(r, patch);
      audit(s, 'requirement.update', r.label, JSON.stringify(patch));
    }),
    sendReminder: act((s, clinicianId: string, type: CredentialType, daysLeft: number | null) => {
      const label = s.credentialRequirements.find((r) => r.type === type)?.label ?? type;
      const text = daysLeft !== null && daysLeft < 0 ? `Reminder: ${label} expired ${-daysLeft} day(s) ago. New requests are blocked until a valid document is approved.` : `Reminder: ${label} expires in ${daysLeft} day(s). Please upload a renewal.`;
      notify(s, clinicianId, text, '/clinician/credentials');
      const hr = s.conversations.find((c) => c.kind === 'channel' && c.channelType === 'hr' && c.clinicianId === clinicianId);
      hr?.messages.push({ id: nextId(s, 'm'), authorId: 'system', at: nowIso(), body: text + ' (Email reminder sent - simulated.)' });
      audit(s, 'credential.reminder', userName(s, clinicianId), label);
    }),
    toggleOnboardingItem: act((s, userId: string, key: string) => {
      const u = s.users.find((x) => x.id === userId)!;
      const item = u.onboarding?.find((o) => o.key === key);
      if (item) item.done = !item.done;
    }),

    // ---- users ----
    inviteUser: act((s, data: Partial<User> & { name: string; email: string; role: User['role'] }) => {
      const id = nextId(s, data.role === 'clinician' ? 'c' : 'u');
      const u: User = { status: 'invited', acceptingWork: true, languages: ['English'], disciplines: [], regionIds: [], rateCard: {}, ...data, id };
      if (u.role === 'clinician') {
        u.onboarding = [
          ['agreement', 'Independent contractor agreement signed', true], ['w9', 'W-9 on file', true], ['license', 'Professional license uploaded', true], ['cpr', 'CPR / BLS certification uploaded', true],
          ['tb', 'TB test uploaded', true], ['physical', 'Annual physical uploaded', true], ['drivers', "Driver's license and auto insurance uploaded", true], ['background', 'Background check completed', true],
          ['emr', 'Agency EMR access requested', false], ['orientation', 'HHC orientation call completed', false],
        ].map(([key, label, required]) => ({ key: key as string, label: label as string, required: required as boolean, done: false }));
        u.startedOn = todayIso();
        for (const type of s.credentialRequirements) s.credentials.push({ id: nextId(s, 'cr'), clinicianId: id, type: type.type, status: 'missing', history: [] });
        for (const type of ['intake', 'hr', 'billing', 'medical_records'] as const) {
          const names = { intake: 'Intake', hr: 'Human Resources', billing: 'Billing', medical_records: 'Medical Records' };
          const members = { intake: ['u_maya', 'u_jordan'], hr: ['u_lena', 'u_jordan'], billing: ['u_sam', 'u_jordan'], medical_records: ['u_maya', 'u_lena'] };
          s.conversations.push({ id: nextId(s, 'ch'), kind: 'channel', channelType: type, clinicianId: id, name: `${names[type]} - ${u.name}${u.disciplines?.[0] ? ' ' + u.disciplines[0] : ''}`, memberIds: [...members[type], id], messages: [], lastReadAt: {} });
        }
        const ann = s.conversations.find((c) => c.id === 'ch_announcements'); ann?.memberIds.push(id);
        for (const rid of u.regionIds ?? []) { const r = s.regions.find((x) => x.id === rid); if (r && !r.clinicianIds.includes(id)) r.clinicianIds.push(id); }
      }
      s.users.push(u);
      audit(s, 'user.invite', u.name, `${u.role} invited (invitation email simulated)`);
      return id;
    }),
    updateUser: act((s, id: string, patch: Partial<User>, note = 'Profile updated') => {
      const u = s.users.find((x) => x.id === id)!;
      Object.assign(u, patch);
      if (patch.regionIds) for (const r of s.regions) { r.clinicianIds = r.clinicianIds.filter((c) => c !== id); if (patch.regionIds.includes(r.id)) r.clinicianIds.push(id); }
      audit(s, 'user.update', u.name, note);
    }),
    setUserStatus: act((s, id: string, status: User['status']) => {
      const u = s.users.find((x) => x.id === id)!;
      u.status = status;
      audit(s, 'user.status', u.name, status === 'inactive' ? 'Deactivated - removed from matching' : `Status: ${status}`);
    }),

    // ---- regions ----
    upsertRegion: act((s, data: Partial<Region> & { name: string; zips: string[]; mode: Region['mode'] }) => {
      let r = data.id ? s.regions.find((x) => x.id === data.id) : undefined;
      if (!r) { r = { id: nextId(s, 'r'), name: data.name, mode: data.mode, zips: data.zips, clinicianIds: [] }; s.regions.push(r); }
      Object.assign(r, data);
      for (const u of s.users) if (u.role === 'clinician') { u.regionIds = (u.regionIds ?? []).filter((x) => x !== r!.id); if (r!.clinicianIds.includes(u.id)) u.regionIds.push(r!.id); }
      audit(s, 'region.save', r.name, `${r.mode === 'zip' ? r.zips.length + ' ZIP codes' : 'polygon'}; ${r.clinicianIds.length} clinician(s)`);
      return r.id;
    }),
    deleteRegion: act((s, id: string) => {
      const r = s.regions.find((x) => x.id === id);
      s.regions = s.regions.filter((x) => x.id !== id);
      for (const u of s.users) u.regionIds = (u.regionIds ?? []).filter((x) => x !== id);
      if (r) audit(s, 'region.delete', r.name, 'Removed');
    }),

    // ---- chat ----
    sendMessage: act((s, convId: string, body: string, attachmentName?: string) => {
      const conv = s.conversations.find((c) => c.id === convId)!;
      const me = actor(s);
      conv.messages.push({ id: nextId(s, 'm'), authorId: me, at: nowIso(), body, attachmentName });
      conv.lastReadAt[me] = nowIso();
      for (const m of conv.memberIds) if (m !== me) notify(s, m, `New message in ${conv.name}: ${body.slice(0, 60)}`, m.startsWith('c_') ? `/clinician/chat/${conv.id}` : `/office/chat/${conv.id}`);
    }),
    markConversationRead: act((s, convId: string, userId: string) => {
      const conv = s.conversations.find((c) => c.id === convId);
      if (conv) conv.lastReadAt[userId] = nowIso();
    }),
    createChannel: act((s, channelType: Conversation['channelType'], clinicianId: string | undefined, name: string, memberIds: string[]) => {
      const id = nextId(s, 'ch');
      s.conversations.push({ id, kind: 'channel', channelType, clinicianId, name, memberIds, messages: [], lastReadAt: {} });
      audit(s, 'channel.create', name, `${memberIds.length} member(s)`);
      return id;
    }),
    // exposes state for imperative reads inside components
    get: getState,
  };
}
export type Actions = ReturnType<typeof createActions>;

// ---------------- React binding ----------------
interface Ctx { state: AppState; actions: Actions }
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const ref = useRef(state);
  ref.current = state;
  useEffect(() => { save(state); }, [state]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY && e.newValue) { try { setState(JSON.parse(e.newValue)); } catch { /* ignore */ } } };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const update = useCallback((fn: (s: AppState) => void) => {
    const draft = clone(ref.current);
    fn(draft);
    ref.current = draft;
    setState(draft);
  }, []);
  const actions = useMemo(() => createActions(update, () => ref.current), [update]);
  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx & { me: User | null; role: 'office' | 'clinician' | null } {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('StoreProvider missing');
  const me = ctx.state.users.find((u) => u.id === ctx.state.session.userId) ?? null;
  return { ...ctx, me, role: ctx.state.session.role };
}

// Convenience lookups
export function useLookups() {
  const { state } = useStore();
  return useMemo(() => ({
    user: (id: string | undefined | null) => state.users.find((u) => u.id === id),
    userName: (id: string | undefined | null) => (id === 'system' ? 'System' : state.users.find((u) => u.id === id)?.name ?? '—'),
    patient: (id: string | undefined | null) => state.patients.find((p) => p.id === id),
    agency: (id: string | undefined | null) => state.agencies.find((a) => a.id === id),
    visitType: (code: string | undefined | null) => state.visitTypes.find((v) => v.code === code),
    request: (id: string | undefined | null) => state.requests.find((r) => r.id === id),
    visit: (id: string | undefined | null) => state.visits.find((v) => v.id === id),
    visitForRequest: (reqId: string) => state.visits.find((v) => v.requestId === reqId),
    submission: (id: string | undefined | null) => state.submissions.find((s) => s.id === id),
    patientConversation: (patientId: string) => state.conversations.find((c) => c.kind === 'patient' && c.patientId === patientId),
    coversZip: (clinicianId: string, zip: string) => coversZip(state, clinicianId, zip),
  }), [state]);
}
