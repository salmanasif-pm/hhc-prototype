import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Card, Empty, Field, Input, PageHead, Pill, Select, Stat, Tabs, useToast } from '../ui';
import { RequestPill, SubmissionPill, PayoutPill } from '../shared/pills';
import { dateFromNow, fmtDate, money, todayIso } from '../domain/format';
import { DISCIPLINES } from '../domain/labels';
import { billedAmount } from '../domain/rules';
import { downloadText, toCsv } from '../domain/csv';

export function ReportsPage() {
  const { state } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<'requests' | 'billing'>('requests');
  const [from, setFrom] = useState(dateFromNow(-45));
  const [to, setTo] = useState(todayIso());
  const [agency, setAgency] = useState('');
  const [disc, setDisc] = useState('');
  const [status, setStatus] = useState('');
  const [region, setRegion] = useState('');
  const [groupBy, setGroupBy] = useState<'city' | 'agency'>('city');

  const reqs = useMemo(() => state.requests.filter((r) => r.status !== 'draft').filter((r) => { const d = r.createdAt.slice(0, 10); return d >= from && d <= to; })
    .filter((r) => !agency || r.agencyId === agency).filter((r) => !disc || r.discipline === disc)
    .filter((r) => !status || (status === 'staffed' ? r.status === 'assigned' || r.closedReason === 'completed' : status === 'unstaffed' ? r.status === 'closed' && r.closedReason !== 'completed' && r.closedReason !== 'cancelled' : r.status === 'pending'))
    .filter((r) => !region || state.regions.find((x) => x.id === region)?.zips.includes(L.patient(r.patientId)?.address.zip ?? '')), [state, from, to, agency, disc, status, region, L]);

  const classify = (r: typeof reqs[number]) => (r.status === 'assigned' || r.closedReason === 'completed' ? 'staffed' : r.status === 'pending' ? 'open' : r.closedReason === 'cancelled' ? 'cancelled' : 'unstaffed');
  const timeToStaffH = (r: typeof reqs[number]) => (r.assignedAt ? (new Date(r.assignedAt).getTime() - new Date(r.createdAt).getTime()) / 3600000 : null);
  const groups = useMemo(() => {
    const m = new Map<string, { received: number; staffed: number; unstaffed: number; open: number; cancelled: number; tts: number[] }>();
    for (const r of reqs) {
      const key = groupBy === 'city' ? L.patient(r.patientId)?.address.city ?? 'Unknown' : L.agency(r.agencyId)?.name ?? 'Unknown';
      const g = m.get(key) ?? { received: 0, staffed: 0, unstaffed: 0, open: 0, cancelled: 0, tts: [] };
      g.received++; g[classify(r)]++; const t = timeToStaffH(r); if (t !== null) g.tts.push(t);
      m.set(key, g);
    }
    return [...m.entries()].sort((a, b) => b[1].received - a[1].received);
  }, [reqs, groupBy, L]);
  const totals = { received: reqs.length, staffed: reqs.filter((r) => classify(r) === 'staffed').length, unstaffed: reqs.filter((r) => classify(r) === 'unstaffed').length, open: reqs.filter((r) => classify(r) === 'open').length };
  const avgTts = (() => { const arr = reqs.map(timeToStaffH).filter((x): x is number => x !== null); return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; })();

  const subs = useMemo(() => state.submissions.filter((s) => s.visitDate >= from && s.visitDate <= to).filter((s) => !agency || s.agencyId === agency), [state.submissions, from, to, agency]);
  const bucket = (s: typeof subs[number]) => (s.status === 'returned' ? 'returned' : s.status === 'submitted' ? 'awaiting' : s.exportedAt ? (s.payoutStatus === 'paid' ? 'paid' : 'exported') : 'ready');
  const byAgency = useMemo(() => {
    const m = new Map<string, Record<string, number> & { billed: number; pay: number }>();
    for (const s of subs) { const k = L.agency(s.agencyId)?.name ?? '—'; const g = m.get(k) ?? { awaiting: 0, returned: 0, ready: 0, exported: 0, paid: 0, billed: 0, pay: 0 }; g[bucket(s)]!++; if (s.status === 'approved') { g.billed += billedAmount(s); g.pay += s.clinicianRate; } m.set(k, g); }
    return [...m.entries()];
  }, [subs, L]);
  const byClinician = useMemo(() => {
    const m = new Map<string, { visits: number; pay: number; paid: number; pending: number }>();
    for (const s of subs) { const k = L.userName(s.clinicianId); const g = m.get(k) ?? { visits: 0, pay: 0, paid: 0, pending: 0 }; g.visits++; if (s.status === 'approved') { g.pay += s.clinicianRate; if (s.payoutStatus === 'paid') g.paid += s.clinicianRate; else g.pending += s.clinicianRate; } m.set(k, g); }
    return [...m.entries()];
  }, [subs, L]);

  const exportRequests = () => {
    const rows: (string | number)[][] = [['Created', 'Patient', 'City', 'ZIP', 'Agency', 'Discipline', 'Visit type', 'Outcome', 'Assigned clinician', 'Time to staff (h)', 'Available responses', 'Declined']];
    for (const r of reqs) { const p = L.patient(r.patientId)!; rows.push([r.createdAt.slice(0, 10), `${p.lastName}, ${p.firstName}`, p.address.city, p.address.zip, L.agency(r.agencyId)!.name, r.discipline, r.visitTypeCode, classify(r), L.userName(r.assignedClinicianId), timeToStaffH(r)?.toFixed(1) ?? '', r.recipients.filter((x) => x.response === 'available').length, r.recipients.filter((x) => x.response === 'not_available').length]); }
    downloadText(`visit-request-report-${from}-to-${to}.csv`, toCsv(rows)); toast('Report exported', 'success');
  };
  const exportBilling = () => {
    const rows: (string | number)[][] = [['Visit date', 'Patient', 'Clinician', 'Agency', 'Visit type', 'Status', 'Clinician pay', 'Agency bill', 'Invoice', 'Exported', 'Payout status', 'Payment ref']];
    for (const s of subs) { const p = L.patient(s.patientId)!; rows.push([s.visitDate, `${p.lastName}, ${p.firstName}`, L.userName(s.clinicianId), L.agency(s.agencyId)!.name, s.visitTypeCode, s.status, s.clinicianRate.toFixed(2), s.status === 'approved' ? billedAmount(s).toFixed(2) : '', state.invoiceBatches.find((b) => b.id === s.invoiceBatchId)?.invoiceNo ?? '', s.exportedAt?.slice(0, 10) ?? '', s.payoutStatus, s.paymentRef ?? '']); }
    downloadText(`billing-payout-report-${from}-to-${to}.csv`, toCsv(rows)); toast('Report exported', 'success');
  };

  return (
    <>
      <PageHead title="Reports" lede="Operational reporting only. The Visit Request Report answers what happened to every referral: received, staffed or unstaffed, by city and agency." actions={<Button icon="download" onClick={tab === 'requests' ? exportRequests : exportBilling}>Export CSV</Button>} />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'requests', label: 'Visit Request Report' }, { key: 'billing', label: 'Billing & Payout Report' }]} />
      <div className="filters">
        <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Agency"><Select value={agency} onChange={(e) => setAgency(e.target.value)}><option value="">All agencies</option>{state.agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        {tab === 'requests' && <>
          <Field label="Discipline"><Select value={disc} onChange={(e) => setDisc(e.target.value)}><option value="">All</option>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Region"><Select value={region} onChange={(e) => setRegion(e.target.value)}><option value="">All regions</option>{state.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
          <Field label="Outcome"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="staffed">Staffed</option><option value="unstaffed">Unstaffed</option><option value="open">Still open</option></Select></Field>
        </>}
      </div>
      {tab === 'requests' && (
        <div className="stack">
          <div className="grid-4">
            <Stat label="Requests received" value={totals.received} />
            <Stat label="Staffed" value={totals.staffed} tone="ok" hint={totals.received ? `${Math.round((totals.staffed / totals.received) * 100)}% fill rate` : undefined} />
            <Stat label="Unstaffed" value={totals.unstaffed} tone={totals.unstaffed ? 'danger' : undefined} />
            <Stat label="Avg time to staff" value={avgTts !== null ? `${avgTts < 1 ? Math.round(avgTts * 60) + ' min' : avgTts.toFixed(1) + ' h'}` : '—'} hint={`${totals.open} still open`} />
          </div>
          <Card title={<h2>Requests by {groupBy}</h2>} actions={<div className="seg"><button className={groupBy === 'city' ? 'active' : ''} onClick={() => setGroupBy('city')}>By city</button><button className={groupBy === 'agency' ? 'active' : ''} onClick={() => setGroupBy('agency')}>By agency</button></div>} pad={false}>
            <div className="table-wrap"><table className="table"><thead><tr><th>{groupBy === 'city' ? 'City (resolved from address)' : 'Agency'}</th><th className="num">Received</th><th className="num">Staffed</th><th className="num">Unstaffed</th><th className="num">Open</th><th className="num">Fill rate</th><th className="num">Avg time to staff</th></tr></thead><tbody>
              {groups.map(([k, g]) => <tr key={k}><td className="cell-main">{k}</td><td className="num">{g.received}</td><td className="num" style={{ color: 'var(--green-dark)' }}>{g.staffed}</td><td className="num" style={{ color: g.unstaffed ? 'var(--red)' : undefined }}>{g.unstaffed}</td><td className="num">{g.open}</td><td className="num">{g.received ? Math.round((g.staffed / g.received) * 100) + '%' : '—'}</td><td className="num">{g.tts.length ? (g.tts.reduce((a, b) => a + b, 0) / g.tts.length).toFixed(1) + ' h' : '—'}</td></tr>)}
              {groups.length === 0 && <tr><td colSpan={7}><Empty title="No requests in this range" icon="chart" /></td></tr>}
            </tbody></table></div>
          </Card>
          <Card title="Request detail" pad={false}>
            <div className="table-wrap"><table className="table"><thead><tr><th>Created</th><th>Patient</th><th>City</th><th>Agency</th><th>Visit</th><th>Outcome</th><th>Who accepted / declined</th><th className="num">Time to staff</th></tr></thead><tbody>
              {reqs.map((r) => { const p = L.patient(r.patientId)!; const acc = r.recipients.filter((x) => x.response === 'available').map((x) => L.userName(x.clinicianId)); const dec = r.recipients.filter((x) => x.response === 'not_available').map((x) => L.userName(x.clinicianId)); const t = timeToStaffH(r); return (
                <tr key={r.id}><td>{fmtDate(r.createdAt)}</td><td><Link to={`/office/scheduling/requests/${r.id}`}>{p.lastName}, {p.firstName}</Link></td><td>{p.address.city}</td><td>{L.agency(r.agencyId)?.name}</td><td>{r.discipline} {r.visitTypeCode}</td><td><RequestPill req={r} /></td><td className="small">{acc.length ? <span style={{ color: 'var(--green-dark)' }}>✓ {acc.join(', ')}</span> : null}{dec.length ? <span style={{ color: 'var(--red)' }}> ✗ {dec.join(', ')}</span> : null}{!acc.length && !dec.length && <span className="muted">No responses</span>}</td><td className="num">{t !== null ? (t < 1 ? `${Math.round(t * 60)} min` : `${t.toFixed(1)} h`) : '—'}</td></tr>
              ); })}
            </tbody></table></div>
          </Card>
        </div>
      )}
      {tab === 'billing' && (
        <div className="stack">
          <div className="grid-4">
            <Stat label="Awaiting review" value={subs.filter((s) => bucket(s) === 'awaiting').length} to="/office/billing" />
            <Stat label="Returned" value={subs.filter((s) => bucket(s) === 'returned').length} tone={subs.some((s) => bucket(s) === 'returned') ? 'warn' : undefined} to="/office/billing" />
            <Stat label="Approved, not yet invoiced" value={subs.filter((s) => bucket(s) === 'ready').length} to="/office/billing/agency" />
            <Stat label="Outstanding clinician pay" value={money(subs.filter((s) => s.status === 'approved' && s.payoutStatus !== 'paid').reduce((a, s) => a + s.clinicianRate, 0))} to="/office/billing/payments" />
          </div>
          <Card title="By agency" pad={false}><div className="table-wrap"><table className="table"><thead><tr><th>Agency</th><th className="num">Awaiting</th><th className="num">Returned</th><th className="num">Ready to invoice</th><th className="num">Exported</th><th className="num">Paid out</th><th className="num">Agency billed</th><th className="num">Clinician pay</th><th className="num">Margin</th></tr></thead><tbody>
            {byAgency.map(([k, g]) => <tr key={k}><td className="cell-main">{k}</td><td className="num">{g.awaiting}</td><td className="num">{g.returned}</td><td className="num">{g.ready}</td><td className="num">{g.exported}</td><td className="num">{g.paid}</td><td className="num">{money(g.billed)}</td><td className="num">{money(g.pay)}</td><td className="num">{money(g.billed - g.pay)}</td></tr>)}
            {byAgency.length === 0 && <tr><td colSpan={9}><Empty title="No billing in this range" icon="dollar" /></td></tr>}
          </tbody></table></div></Card>
          <Card title="By clinician" pad={false}><div className="table-wrap"><table className="table"><thead><tr><th>Clinician</th><th className="num">Submitted visits</th><th className="num">Approved pay</th><th className="num">Paid</th><th className="num">Pending payout</th></tr></thead><tbody>
            {byClinician.map(([k, g]) => <tr key={k}><td className="cell-main">{k}</td><td className="num">{g.visits}</td><td className="num">{money(g.pay)}</td><td className="num">{money(g.paid)}</td><td className="num">{money(g.pending)}</td></tr>)}
          </tbody></table></div></Card>
          <Card title="Exceptions and open items" pad={false}><div className="table-wrap"><table className="table"><thead><tr><th>Visit</th><th>Patient</th><th>Clinician</th><th>Agency</th><th>Submission</th><th>Payout</th><th /></tr></thead><tbody>
            {subs.filter((s) => s.status !== 'approved' || s.payoutStatus === 'exception').map((s) => { const p = L.patient(s.patientId)!; return <tr key={s.id}><td>{fmtDate(s.visitDate)} · {s.visitTypeCode}</td><td>{p.lastName}, {p.firstName}</td><td>{L.userName(s.clinicianId)}</td><td>{L.agency(s.agencyId)?.name}</td><td><SubmissionPill status={s.status} />{s.returnReason && <div className="cell-sub">{s.returnReason}</div>}</td><td><PayoutPill status={s.payoutStatus} /></td><td className="right"><Link to="/office/billing" className="btn sm">Open</Link></td></tr>; })}
            {subs.filter((s) => s.status !== 'approved' || s.payoutStatus === 'exception').length === 0 && <tr><td colSpan={7}><div className="empty small">No exceptions <Pill tone="green">All clear</Pill></div></td></tr>}
          </tbody></table></div></Card>
          <p className="small muted">This is operational finance visibility. It does not replace QuickBooks accounts receivable or a general ledger.</p>
        </div>
      )}
    </>
  );
}
