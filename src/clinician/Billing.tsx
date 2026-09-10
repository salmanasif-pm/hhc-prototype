import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, Empty, Field, Input, Modal, PageHead, Select, Stat, Tag, Textarea, Timeline, useToast } from '../ui';
import { PayoutPill, SubmissionPill } from '../shared/pills';
import { fmtDate, fmtMonth, fmtShortDate, money, monthKey, todayIso } from '../domain/format';
import { visitReadyToSubmit } from '../domain/rules';
import type { BillingSubmission } from '../domain/types';

export function ClinicianBilling() {
  const { state, actions, me } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [month, setMonth] = useState('all');
  const [fix, setFix] = useState<BillingSubmission | null>(null);
  const [date, setDate] = useState('');
  const [memo, setMemo] = useState('');
  const [hist, setHist] = useState<BillingSubmission | null>(null);
  if (!me) return null;
  const all = state.submissions.filter((s) => s.clinicianId === me.id).sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  const months = [...new Set(all.map((s) => monthKey(s.visitDate)))].sort().reverse();
  const subs = all.filter((s) => month === 'all' || monthKey(s.visitDate) === month);
  const ready = state.visits.filter((v) => v.clinicianId === me.id && visitReadyToSubmit(v) && L.request(v.requestId)?.status === 'assigned');
  const totals = useMemo(() => ({
    approved: subs.filter((s) => s.status === 'approved').reduce((a, s) => a + s.clinicianRate, 0),
    paid: subs.filter((s) => s.payoutStatus === 'paid').reduce((a, s) => a + s.clinicianRate, 0),
    pending: subs.filter((s) => s.status === 'approved' && s.payoutStatus !== 'paid').reduce((a, s) => a + s.clinicianRate, 0),
    awaiting: subs.filter((s) => s.status === 'submitted').reduce((a, s) => a + s.clinicianRate, 0),
  }), [subs]);
  return (
    <>
      <PageHead title="Billing" lede="Your submitted visits, their review status and payout status. Rates are pre-filled from your agreed rate card. Payments are made outside the platform; the status here is maintained by the office." />
      {ready.length > 0 && <div style={{ marginBottom: 14 }}><Callout tone="info">{ready.length} confirmed visit(s) ready to submit: {ready.map((v) => <Link key={v.id} to={`/clinician/schedule/${v.id}`} style={{ marginRight: 8 }}>{L.patient(v.patientId)?.firstName} {L.patient(v.patientId)?.lastName} ({v.visitTypeCode})</Link>)}</Callout></div>}
      <div className="row between wrap" style={{ marginBottom: 12 }}>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 'auto' }} aria-label="Month"><option value="all">All months</option>{months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</Select>
        <span className="small muted">{subs.length} submission(s)</span>
      </div>
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat label="Approved" value={money(totals.approved)} tone="ok" />
        <Stat label="Paid" value={money(totals.paid)} />
        <Stat label="Approved, not yet paid" value={money(totals.pending)} />
        <Stat label="Awaiting review" value={money(totals.awaiting)} hint={`${subs.filter((s) => s.status === 'returned').length} returned`} />
      </div>
      <Card pad={false}>
        {subs.length === 0 ? <Empty title="No submissions" hint="Submit billing from a confirmed visit in My schedule." icon="dollar" /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Visit</th><th>Patient / agency</th><th className="num">Your rate</th><th>Review</th><th>Payout</th><th /></tr></thead><tbody>
            {subs.map((s) => { const p = L.patient(s.patientId)!; return (
              <tr key={s.id} className={s.status === 'returned' ? 'hl' : ''}>
                <td><div className="cell-main">{fmtShortDate(s.visitDate)}</div><div className="cell-sub"><Tag kind="type">{L.visitType(s.visitTypeCode)?.short}</Tag></div></td>
                <td><div className="cell-main">{p.firstName} {p.lastName}</div><div className="cell-sub">{L.agency(s.agencyId)?.name}</div></td>
                <td className="num">{money(s.clinicianRate)}</td>
                <td><SubmissionPill status={s.status} />{s.returnReason && <div className="cell-sub" style={{ whiteSpace: 'normal', maxWidth: 260 }}>{s.returnReason}</div>}</td>
                <td>{s.status === 'approved' ? <><PayoutPill status={s.payoutStatus} />{s.paymentDate && <div className="cell-sub">{fmtDate(s.paymentDate)} · {s.paymentRef}</div>}{s.payoutStatus === 'exception' && <div className="cell-sub">{s.history[s.history.length - 1]?.text}</div>}</> : <span className="muted small">—</span>}</td>
                <td className="right"><div className="row" style={{ justifyContent: 'flex-end' }}>{(s.status === 'returned' || s.status === 'submitted') && <Button size="sm" variant={s.status === 'returned' ? 'primary' : 'default'} onClick={() => { setFix(s); setDate(s.visitDate); setMemo(s.memo); }}>{s.status === 'returned' ? 'Correct & resubmit' : 'Edit'}</Button>}<Button size="sm" variant="ghost" onClick={() => setHist(s)}>History</Button></div></td>
              </tr>
            ); })}
          </tbody></table></div>
        )}
      </Card>
      {fix && (
        <Modal title="Correct submission" onClose={() => setFix(null)} footer={<><Button onClick={() => setFix(null)}>Cancel</Button><Button variant="primary" onClick={() => { const r = actions.resubmitBilling(fix.id, { visitDate: date, memo: memo.trim() }); if (!r.ok) { toast(r.reason, 'error'); return; } toast('Resubmitted for review', 'success'); setFix(null); }}>Resubmit</Button></>}>
          {fix.returnReason && <Callout tone="warn"><b>Office note:</b> {fix.returnReason}</Callout>}
          <Field label="Visit date" required><Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Memo"><Textarea value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
          <p className="small muted">Rate ({money(fix.clinicianRate)}), patient, agency and visit type cannot be changed here.</p>
        </Modal>
      )}
      {hist && <Modal title="Submission history" onClose={() => setHist(null)}><Timeline items={hist.history.map((h) => ({ at: h.at, who: L.userName(h.actorId), text: h.text }))} /></Modal>}
    </>
  );
}
