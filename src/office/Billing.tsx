import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, DefGrid, Drawer, Empty, Field, I, Input, Modal, PageHead, Pill, Select, Stat, Tabs, Tag, Textarea, Timeline, useToast } from '../ui';
import { Confirmation, PayoutPill, PlotPill, SubmissionPill } from '../shared/pills';
import { agencyRate, billedAmount, duplicateSubmission } from '../domain/rules';
import { dateFromNow, fmtDate, fmtDateTime, money, todayIso } from '../domain/format';
import { downloadText, quickBooksCsv } from '../domain/csv';
import type { BillingSubmission, PayoutStatus } from '../domain/types';
import { RateEditor } from './Users';

type Tab = 'review' | 'agency' | 'payments' | 'rates';

export function BillingPage() {
  const { tab: tabParam } = useParams();
  const nav = useNavigate();
  const tab = ((tabParam as Tab) || 'review') as Tab;
  const setTab = (t: Tab) => nav(`/office/billing/${t}`);
  const { state } = useStore();
  const queue = state.submissions.filter((s) => s.status === 'submitted').length;
  const ready = state.submissions.filter((s) => s.status === 'approved' && !s.invoiceBatchId).length;
  const payouts = state.submissions.filter((s) => s.status === 'approved' && s.payoutStatus !== 'paid').length;
  return (
    <>
      <PageHead title="Billing" lede="Clinician submissions arrive with visit confirmation and both rates already attached. Review once, prepare agency billing, export for QuickBooks, and track payout status. This platform does not execute payments." />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'review', label: 'Awaiting review', count: queue }, { key: 'agency', label: 'Prepare agency billing', count: ready }, { key: 'payments', label: 'Clinician payment status', count: payouts }, { key: 'rates', label: 'Rates' }]} />
      {tab === 'review' && <ReviewTab />}
      {tab === 'agency' && <AgencyTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'rates' && <RatesTab />}
    </>
  );
}

function SubmissionRow({ s, onOpen }: { s: BillingSubmission; onOpen: () => void }) {
  const { state } = useStore();
  const L = useLookups();
  const p = L.patient(s.patientId)!;
  const v = L.visit(s.visitId);
  const dup = duplicateSubmission(state, s, s.id);
  return (
    <tr className={`click ${dup ? 'hl' : ''}`} onClick={onOpen}>
      <td><div className="cell-main">{L.userName(s.clinicianId)}</div><div className="cell-sub">{fmtDateTime(s.submittedAt)}</div></td>
      <td><div className="cell-main">{p.lastName}, {p.firstName}</div><div className="cell-sub">{L.agency(s.agencyId)?.name}</div></td>
      <td>{fmtDate(s.visitDate)}</td>
      <td><Tag kind="type">{L.visitType(s.visitTypeCode)?.short}</Tag></td>
      <td><div className="row wrap" style={{ gap: 4 }}>{v && <Confirmation at={v.visitCompletedAt} label="Visit" />}{v && <Confirmation at={v.noteCompletedAt} label="Note" />}{v && <PlotPill status={v.plotStatus} />}{s.evidenceFileName && <Pill tone="outline" sm>File</Pill>}{dup && <Pill tone="red" sm>Possible duplicate</Pill>}</div></td>
      <td className="num">{money(s.clinicianRate)}</td>
      <td className="num">{s.status === 'approved' ? money(billedAmount(s)) : <span className="muted">{money(agencyRate(state, s.agencyId, s.visitTypeCode))}</span>}</td>
      <td><SubmissionPill status={s.status} />{s.returnReason && <div className="cell-sub">{s.returnReason.slice(0, 40)}…</div>}</td>
      <td className="right"><Button size="sm" variant={s.status === 'submitted' ? 'primary' : 'default'}>{s.status === 'submitted' ? 'Review' : 'Open'}</Button></td>
    </tr>
  );
}

function ReviewTab() {
  const { state, actions, me } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [filter, setFilter] = useState<'submitted' | 'returned' | 'approved' | 'all'>('submitted');
  const [agency, setAgency] = useState('');
  const [clin, setClin] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [ret, setRet] = useState(false);
  const [reason, setReason] = useState('');
  const [ovr, setOvr] = useState(false);
  const [ovAmt, setOvAmt] = useState('');
  const [ovReason, setOvReason] = useState('');
  const rows = useMemo(() => state.submissions.filter((s) => filter === 'all' || s.status === filter).filter((s) => !agency || s.agencyId === agency).filter((s) => !clin || s.clinicianId === clin).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [state.submissions, filter, agency, clin]);
  const s = openId ? L.submission(openId) : undefined;
  const v = s ? L.visit(s.visitId) : undefined;
  const p = s ? L.patient(s.patientId) : undefined;
  const a = s ? L.agency(s.agencyId) : undefined;
  const aRate = s ? agencyRate(state, s.agencyId, s.visitTypeCode) : null;
  const dup = s ? duplicateSubmission(state, s, s.id) : undefined;
  const plottedOnly = state.visits.filter((x) => x.plotStatus === 'plotted' && !x.billingSubmissionId && L.request(x.requestId)?.status === 'assigned');

  return (
    <div className="stack">
      <div className="grid-4">
        <Stat label="Awaiting review" value={state.submissions.filter((x) => x.status === 'submitted').length} />
        <Stat label="Returned to clinician" value={state.submissions.filter((x) => x.status === 'returned').length} tone={state.submissions.some((x) => x.status === 'returned') ? 'warn' : undefined} />
        <Stat label="Approved, not invoiced" value={state.submissions.filter((x) => x.status === 'approved' && !x.invoiceBatchId).length} to="/office/billing/agency" />
        <Stat label="Plotted, not yet submitted" value={plottedOnly.length} hint="Not billing-ready until the clinician submits" to="/office/scheduling/schedule" />
      </div>
      <div className="filters">
        <div className="seg">{(['submitted', 'returned', 'approved', 'all'] as const).map((f) => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f === 'submitted' ? 'Awaiting review' : f === 'all' ? 'All' : f[0]!.toUpperCase() + f.slice(1)}</button>)}</div>
        <Select value={agency} onChange={(e) => setAgency(e.target.value)} aria-label="Agency"><option value="">All agencies</option>{state.agencies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        <Select value={clin} onChange={(e) => setClin(e.target.value)} aria-label="Clinician"><option value="">All clinicians</option>{state.users.filter((u) => u.role === 'clinician').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty title="Nothing here" hint={filter === 'submitted' ? 'Clinician submissions appear here as soon as they confirm a visit and submit billing.' : undefined} icon="dollar" /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Clinician</th><th>Patient / agency</th><th>Visit date</th><th>Type</th><th>Readiness evidence</th><th className="num">Clinician pay</th><th className="num">Agency bill</th><th>Status</th><th /></tr></thead><tbody>
            {rows.map((r) => <SubmissionRow key={r.id} s={r} onOpen={() => { setOpenId(r.id); setRet(false); setOvr(false); }} />)}
          </tbody></table></div>
        )}
      </Card>

      {s && v && p && a && (
        <Drawer title={`${p.firstName} ${p.lastName} · ${L.visitType(s.visitTypeCode)?.label}`} sub={`Submitted by ${L.userName(s.clinicianId)} · ${fmtDateTime(s.submittedAt)}`} onClose={() => setOpenId(null)} footer={
          s.status === 'submitted' ? <><Button variant="danger" onClick={() => { setRet(true); setReason(''); }}>Return with reason</Button>{me?.role === 'admin' && <Button onClick={() => { setOvr(true); setOvAmt(String(aRate ?? '')); setOvReason(''); }}>Approve with adjusted amount</Button>}<Button variant="success" icon="check" disabled={aRate === null} onClick={() => { const r = actions.approveSubmission(s.id); if (!r.ok) { toast(r.reason, 'error'); return; } toast('Approved - both rates snapshotted onto the line', 'success'); setOpenId(null); }}>Approve</Button></> : <Button onClick={() => setOpenId(null)}>Close</Button>
        }>
          {dup && <Callout tone="danger"><b>Possible duplicate:</b> another submission exists for this clinician, patient, visit type and date ({dup.id}, {dup.status}). Return one of them.</Callout>}
          {aRate === null && s.status === 'submitted' && <Callout tone="warn">No agency rate on file for {a.name} / {s.visitTypeCode}. Add it under Rates before approving.</Callout>}
          <div className="grid-2">
            <Card title="Visit" className="card" pad>
              <DefGrid items={[['Visit date', fmtDate(s.visitDate)], ['Visit type', `${L.visitType(s.visitTypeCode)?.label} (${s.visitTypeCode})`], ['Planned date', v.plannedDate ?? '—'], ['Plot status', <PlotPill status={v.plotStatus} />], ['Clinician confirmed', <span className="row wrap" style={{ gap: 4 }}><Confirmation at={v.visitCompletedAt} label="Visit" /><Confirmation at={v.noteCompletedAt} label="Note in EMR" /></span>], ['Evidence file', s.evidenceFileName ?? 'None']]} />
              {v.plannedDate && v.plannedDate !== s.visitDate && <div style={{ marginTop: 10 }}><Callout tone="warn">Submitted visit date differs from the planned/plotted date ({fmtDate(v.plannedDate)}).</Callout></div>}
            </Card>
            <Card title="Rates" pad>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row between"><span>Clinician pay rate <span className="muted small">(from clinician rate card, pre-filled)</span></span><b>{money(s.clinicianRate)}</b></div>
                <div className="row between"><span>Agency bill rate <span className="muted small">({a.name} rate card)</span></span><b>{money(s.status === 'approved' ? s.agencyRate : aRate)}</b></div>
                {s.agencyAmountOverride && <div className="row between" style={{ color: 'var(--amber)' }}><span>Adjusted agency amount <span className="small">({s.agencyAmountOverride.reason})</span></span><b>{money(s.agencyAmountOverride.amount)}</b></div>}
                <div className="divider" />
                <div className="row between"><span className="muted">Margin on this visit</span><b>{money((s.status === 'approved' ? billedAmount(s) : aRate ?? 0) - s.clinicianRate)}</b></div>
                <p className="small muted">Approval snapshots both rates onto the line so later contract changes do not rewrite history.</p>
              </div>
            </Card>
          </div>
          <div><div className="label">Clinician memo</div><p>{s.memo || <span className="muted">None</span>}</p></div>
          {s.returnReason && <Callout tone="warn"><b>Returned:</b> {s.returnReason}</Callout>}
          <div className="row wrap"><Link to={`/office/patients/${p.id}`} className="btn sm">Patient</Link><Link to={`/office/scheduling/requests/${v.requestId}`} className="btn sm">Request</Link>{L.patientConversation(p.id) && <Link to={`/office/chat/${L.patientConversation(p.id)!.id}`} className="btn sm">Patient chat</Link>}</div>
          {ret && (
            <div className="panel stack">
              <Field label="Reason for return (shown to the clinician)" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Visit date does not match the date plotted in the agency EMR" /></Field>
              <div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setRet(false)}>Cancel</Button><Button size="sm" variant="danger" solid disabled={!reason.trim()} onClick={() => { actions.returnSubmission(s.id, reason.trim()); toast('Returned to clinician', 'success'); setOpenId(null); }}>Return submission</Button></div>
            </div>
          )}
          {ovr && (
            <div className="panel stack">
              <Callout tone="info">Admin-only: adjust the agency amount for this line (e.g. an agreed staffing bonus). The standard rate card is not changed and the reason is recorded.</Callout>
              <div className="grid-2"><Field label="Agency amount" required><Input type="number" step={5} value={ovAmt} onChange={(e) => setOvAmt(e.target.value)} /></Field><Field label="Reason" required><Input value={ovReason} onChange={(e) => setOvReason(e.target.value)} placeholder="e.g. +$50 rush staffing bonus agreed with agency" /></Field></div>
              <div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setOvr(false)}>Cancel</Button><Button size="sm" variant="success" disabled={!ovReason.trim() || !ovAmt} onClick={() => { const r = actions.approveSubmission(s.id, { amount: parseFloat(ovAmt), reason: ovReason.trim() }); if (!r.ok) { toast(r.reason, 'error'); return; } toast('Approved with adjusted amount', 'success'); setOpenId(null); }}>Approve with adjustment</Button></div>
            </div>
          )}
          <div><div className="label" style={{ marginBottom: 6 }}>History</div><Timeline items={s.history.map((h) => ({ at: h.at, who: L.userName(h.actorId), text: h.text }))} /></div>
        </Drawer>
      )}
    </div>
  );
}

function AgencyTab() {
  const { state, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [agency, setAgency] = useState(state.agencies[0]?.id ?? '');
  const [from, setFrom] = useState(dateFromNow(-30));
  const [to, setTo] = useState(todayIso());
  const [preview, setPreview] = useState<string | null>(null);
  const lines = useMemo(() => state.submissions.filter((s) => s.agencyId === agency && s.status === 'approved' && !s.invoiceBatchId && s.visitDate >= from && s.visitDate <= to), [state.submissions, agency, from, to]);
  const total = lines.reduce((sum, l) => sum + billedAmount(l), 0);
  const batches = state.invoiceBatches.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const exportIt = (id: string) => { const { csv, fileName } = actions.exportBatch(id); downloadText(fileName, csv); toast(`${fileName} downloaded`, 'success'); };
  const readyByAgency = state.agencies.map((a) => ({ a, n: state.submissions.filter((s) => s.agencyId === a.id && s.status === 'approved' && !s.invoiceBatchId).length })).filter((x) => x.n > 0);

  return (
    <div className="stack">
      {readyByAgency.length > 0 && <Callout tone="info">Approved, uninvoiced lines: {readyByAgency.map((x) => `${x.a.name} (${x.n})`).join(' · ')}</Callout>}
      <div className="grid-3" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
        <Card title="Prepare an agency invoice batch" footer={<Button variant="primary" icon="file" disabled={lines.length === 0} onClick={() => { const r = actions.createInvoiceBatch(agency, from, to); if (!r.ok) { toast(r.reason, 'error'); return; } toast('Invoice batch created - ready to export', 'success'); }}>Create invoice batch ({lines.length} lines, {money(total)})</Button>}>
          <div className="form-grid">
            <Field label="Agency" className="span2"><Select value={agency} onChange={(e) => setAgency(e.target.value)}>{state.agencies.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.terms}</option>)}</Select></Field>
            <Field label="Visit dates from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="to"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <div style={{ marginTop: 14 }}>
            {lines.length === 0 ? <Callout tone="neutral">No approved, uninvoiced lines for this agency in the date range. Only approved lines that are not already in a batch can be included.</Callout> : (
              <div className="table-wrap"><table className="table"><thead><tr><th>Visit date</th><th>Patient</th><th>Clinician</th><th>Item</th><th className="num">Amount</th></tr></thead><tbody>
                {lines.map((l) => { const p = L.patient(l.patientId)!; return <tr key={l.id}><td>{fmtDate(l.visitDate)}</td><td>{p.lastName}, {p.firstName}</td><td>{L.userName(l.clinicianId)}</td><td>{L.visitType(l.visitTypeCode)?.short}{l.agencyAmountOverride && <Pill tone="amber" sm> adjusted</Pill>}</td><td className="num">{money(billedAmount(l))}</td></tr>; })}
                <tr><td colSpan={4} className="right strong">Total</td><td className="num strong">{money(total)}</td></tr>
              </tbody></table></div>
            )}
          </div>
        </Card>
        <Card title="How the export works">
          <ol className="small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
            <li>Approved lines are grouped by agency and date range into a numbered invoice batch.</li>
            <li><b>Export file for QuickBooks</b> downloads a CSV using the agreed mapping: customer (agency), item (visit type), service date, amount (agency rate), terms, invoice number and memo.</li>
            <li>Exported lines are marked, the export is recorded with user and time, and a re-export warns.</li>
            <li>QuickBooks creates and sends the invoices after import. Nothing is sent from here.</li>
          </ol>
        </Card>
      </div>
      <Card title="Invoice batches" pad={false}>
        {batches.length === 0 ? <Empty title="No invoice batches yet" icon="file" /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Invoice</th><th>Agency</th><th>Visit dates</th><th className="num">Lines</th><th className="num">Total</th><th>Status</th><th>Export</th><th /></tr></thead><tbody>
            {batches.map((b) => <tr key={b.id}><td className="cell-main">{b.invoiceNo}</td><td>{L.agency(b.agencyId)?.name}</td><td>{fmtDate(b.from)} – {fmtDate(b.to)}</td><td className="num">{b.lineIds.length}</td><td className="num">{money(b.total)}</td><td>{b.status === 'exported' ? <Pill tone="green">Exported</Pill> : <Pill tone="blue">Ready</Pill>}</td><td className="small">{b.exportedAt ? <>{fmtDateTime(b.exportedAt)} by {L.userName(b.exportedBy)}<div className="cell-sub">{b.fileName}</div></> : <span className="muted">Not exported</span>}</td>
              <td className="right"><div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" variant="ghost" onClick={() => setPreview(b.id)}>Preview</Button><Button size="sm" variant={b.status === 'exported' ? 'default' : 'primary'} icon="download" onClick={() => exportIt(b.id)}>{b.status === 'exported' ? 'Re-export' : 'Export file for QuickBooks'}</Button></div></td></tr>)}
          </tbody></table></div>
        )}
      </Card>
      {preview && (() => { const b = state.invoiceBatches.find((x) => x.id === preview)!; const csv = quickBooksCsv(state, b); const rows = csv.trim().split('\r\n').map((r) => r.split(',')); return (
        <Modal wide title={`QuickBooks import preview - ${b.invoiceNo}`} onClose={() => setPreview(null)} footer={<><Button onClick={() => setPreview(null)}>Close</Button><Button variant="primary" icon="download" onClick={() => { exportIt(b.id); setPreview(null); }}>Download CSV</Button></>}>
          {b.status === 'exported' && <Callout tone="warn">This batch was already exported on {fmtDateTime(b.exportedAt)}. Re-exporting is recorded; import it into QuickBooks only once.</Callout>}
          <div className="table-wrap"><table className="table small"><thead><tr>{rows[0]!.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="nowrap">{c.replace(/^"|"$/g, '')}</td>)}</tr>)}</tbody></table></div>
          <p className="small muted">Sample layout for QuickBooks Online invoice import. Final column mapping is confirmed with the client's QuickBooks edition during the mapping workshop.</p>
        </Modal>
      ); })()}
    </div>
  );
}

function PaymentsTab() {
  const { state, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [clin, setClin] = useState('');
  const [filter, setFilter] = useState<'open' | 'paid' | 'all'>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<PayoutStatus>('paid');
  const [date, setDate] = useState(todayIso());
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const rows = state.submissions.filter((s) => s.status === 'approved').filter((s) => !clin || s.clinicianId === clin).filter((s) => filter === 'all' || (filter === 'paid' ? s.payoutStatus === 'paid' : s.payoutStatus !== 'paid')).sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  const s = openId ? L.submission(openId) : undefined;
  const totals = { pending: state.submissions.filter((x) => x.status === 'approved' && x.payoutStatus !== 'paid').reduce((a, x) => a + x.clinicianRate, 0), paid: state.submissions.filter((x) => x.payoutStatus === 'paid').reduce((a, x) => a + x.clinicianRate, 0) };
  return (
    <div className="stack">
      <Callout tone="neutral">Payments to contractors run outside the platform (as today). This is where the office records the status so clinicians see pending, approved, exception or paid with the payment reference.</Callout>
      <div className="grid-4"><Stat label="Outstanding clinician pay" value={money(totals.pending)} /><Stat label="Paid (all time in demo)" value={money(totals.paid)} tone="ok" /><Stat label="Exceptions" value={state.submissions.filter((x) => x.payoutStatus === 'exception').length} tone={state.submissions.some((x) => x.payoutStatus === 'exception') ? 'danger' : undefined} /><Stat label="Approved lines" value={state.submissions.filter((x) => x.status === 'approved').length} /></div>
      <div className="filters">
        <div className="seg">{(['open', 'paid', 'all'] as const).map((f) => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f === 'open' ? 'Not yet paid' : f === 'paid' ? 'Paid' : 'All'}</button>)}</div>
        <Select value={clin} onChange={(e) => setClin(e.target.value)} aria-label="Clinician"><option value="">All clinicians</option>{state.users.filter((u) => u.role === 'clinician').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty title="No lines" icon="dollar" /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Clinician</th><th>Patient</th><th>Visit</th><th>Invoice</th><th className="num">Clinician pay</th><th>Payout status</th><th>Payment</th><th /></tr></thead><tbody>
            {rows.map((r) => { const p = L.patient(r.patientId)!; const b = state.invoiceBatches.find((x) => x.id === r.invoiceBatchId); return (
              <tr key={r.id} className="click" onClick={() => { setOpenId(r.id); setStatus(r.payoutStatus === 'pending' || r.payoutStatus === 'approved' ? 'paid' : r.payoutStatus); setDate(r.paymentDate ?? todayIso()); setRef(r.paymentRef ?? ''); setNote(''); }}>
                <td className="cell-main">{L.userName(r.clinicianId)}</td><td>{p.lastName}, {p.firstName}</td><td>{fmtDate(r.visitDate)} · {r.visitTypeCode}</td><td>{b ? <span>{b.invoiceNo} {b.status === 'exported' ? <Pill tone="green" sm>exported</Pill> : <Pill tone="blue" sm>ready</Pill>}</span> : <span className="muted small">not invoiced</span>}</td><td className="num">{money(r.clinicianRate)}</td><td><PayoutPill status={r.payoutStatus} /></td><td className="small">{r.paymentDate ? `${fmtDate(r.paymentDate)} · ${r.paymentRef ?? ''}` : <span className="muted">—</span>}</td><td className="right"><Button size="sm">Update</Button></td>
              </tr>
            ); })}
          </tbody></table></div>
        )}
      </Card>
      {s && (
        <Modal title={`Payment status - ${L.userName(s.clinicianId)}`} onClose={() => setOpenId(null)} footer={<><Button onClick={() => setOpenId(null)}>Cancel</Button><Button variant="primary" onClick={() => { actions.setPayoutStatus(s.id, status, { paymentDate: status === 'paid' ? date : undefined, paymentRef: status === 'paid' ? ref : undefined, note: note || undefined }); toast('Payout status updated - clinician sees the same status', 'success'); setOpenId(null); }}>Save status</Button></>}>
          <DefGrid items={[['Patient', `${L.patient(s.patientId)?.firstName} ${L.patient(s.patientId)?.lastName}`], ['Visit', `${fmtDate(s.visitDate)} · ${s.visitTypeCode}`], ['Clinician pay', money(s.clinicianRate)], ['Current status', <PayoutPill status={s.payoutStatus} />]]} />
          <Field label="New status"><Select value={status} onChange={(e) => setStatus(e.target.value as PayoutStatus)}><option value="pending">Pending</option><option value="approved">Approved for payment</option><option value="exception">Exception (hold)</option><option value="paid">Paid</option></Select></Field>
          {status === 'paid' && <div className="grid-2"><Field label="Payment date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Payment reference"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. ACH 88231" /></Field></div>}
          {status === 'exception' && <Field label="Reason (shown to clinician)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Waiting for agency confirmation of visit" /></Field>}
        </Modal>
      )}
    </div>
  );
}

function RatesTab() {
  const { state, actions, me } = useStore();
  const toast = useToast();
  const [side, setSide] = useState<'agency' | 'clinician'>('agency');
  const isAdmin = me?.role === 'admin';
  return (
    <div className="stack">
      <Callout tone="neutral">Two separate rate cards are the whole point: what HHC pays the clinician and what HHC bills the agency, by visit type. Approval snapshots both. Clinicians never type a rate. {!isAdmin && <b>Editing rates needs the Admin / Manager access level.</b>}</Callout>
      <div className="seg" style={{ alignSelf: 'flex-start' }}><button className={side === 'agency' ? 'active' : ''} onClick={() => setSide('agency')}>Agency bill rates</button><button className={side === 'clinician' ? 'active' : ''} onClick={() => setSide('clinician')}>Clinician pay rates</button></div>
      <Card pad={false} title={side === 'agency' ? 'Agency bill rates by visit type' : 'Clinician pay rates by visit type'}>
        <div className="table-wrap"><table className="table"><thead><tr><th>{side === 'agency' ? 'Agency' : 'Clinician'}</th>{state.visitTypes.map((v) => <th key={v.code} className="num">{v.short}</th>)}</tr></thead><tbody>
          {(side === 'agency' ? state.agencies : state.users.filter((u) => u.role === 'clinician' && u.status !== 'inactive')).map((row) => (
            <tr key={row.id}><td><div className="cell-main">{row.name}</div><div className="cell-sub">{'terms' in row ? `${row.emrLabel} · ${row.terms}` : (row as { disciplines?: string[] }).disciplines?.join('/')}</div></td>
              {state.visitTypes.map((v) => { const val = row.rateCard?.[v.code]; return <td key={v.code} className="num"><div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><span>{val !== undefined ? money(val) : <span className="muted">—</span>}</span><RateEditor value={val} disabled={!isAdmin} onSave={(n) => { if (side === 'agency') actions.updateAgencyRate(row.id, v.code, n); else actions.updateClinicianRate(row.id, v.code, n); toast('Rate updated - applies to future approvals only', 'success'); }} /></div></td>; })}
            </tr>
          ))}
        </tbody></table></div>
      </Card>
      <span style={{ display: 'none' }}><I.info /></span>
    </div>
  );
}
