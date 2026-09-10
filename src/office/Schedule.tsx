import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, Drawer, Empty, Field, Input, PageHead, Pill, Select, Tag, Textarea, Timeline, useToast } from '../ui';
import { Confirmation, PlotPill } from '../shared/pills';
import { fmtShortDate, todayIso } from '../domain/format';
import { plotException } from '../domain/rules';
import type { PlotStatus, Visit } from '../domain/types';

export function SchedulePage() {
  const { state, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'exceptions' | 'upcoming' | 'completed'>('all');
  const [agency, setAgency] = useState('');
  const [clin, setClin] = useState('');
  const [date, setDate] = useState('');
  const [plot, setPlot] = useState<PlotStatus>('not_plotted');
  const [note, setNote] = useState('');

  const rows = useMemo(() => state.visits
    .map((v) => ({ v, req: L.request(v.requestId)!, p: L.patient(v.patientId)!, a: L.agency(v.agencyId)!, exception: plotException(v, L.request(v.requestId)?.assignedAt) }))
    .filter((r) => r.req.status === 'assigned' || r.v.billingSubmissionId)
    .filter((r) => !agency || r.a.id === agency)
    .filter((r) => !clin || r.v.clinicianId === clin)
    .filter((r) => filter === 'all' || (filter === 'exceptions' && r.exception) || (filter === 'upcoming' && !r.v.visitCompletedAt) || (filter === 'completed' && r.v.visitCompletedAt))
    .sort((x, y) => (x.v.plannedDate ?? '9999').localeCompare(y.v.plannedDate ?? '9999')), [state.visits, agency, clin, filter, L]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) { const k = r.v.plannedDate ?? 'unscheduled'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
    return [...m.entries()].sort((a, b) => (a[0] === 'unscheduled' ? -1 : b[0] === 'unscheduled' ? 1 : a[0].localeCompare(b[0])));
  }, [rows]);
  const open = openId ? state.visits.find((v) => v.id === openId) : undefined;
  const openRow = open ? { req: L.request(open.requestId)!, p: L.patient(open.patientId)!, a: L.agency(open.agencyId)! } : undefined;
  const exceptions = state.visits.filter((v) => L.request(v.requestId)?.status === 'assigned' && plotException(v, L.request(v.requestId)?.assignedAt)).length;

  const openVisit = (v: Visit) => { setOpenId(v.id); setDate(v.plannedDate ?? ''); setPlot(v.plotStatus); setNote(v.officeNote); };
  const save = () => {
    if (!open) return;
    if ((date || null) !== open.plannedDate) actions.setPlannedDate(open.id, date || null);
    if (plot !== open.plotStatus || note !== open.officeNote) actions.setPlotStatus(open.id, plot, note);
    toast('Schedule updated', 'success');
    setOpenId(null);
  };

  return (
    <>
      <PageHead title="Schedule" lede="Assigned visits by planned date. The office records whether each visit is plotted in the agency EMR; clinicians confirm completion. Agency EMRs stay external." />
      {exceptions > 0 && <div style={{ marginBottom: 14 }}><Callout tone="warn"><b>{exceptions} exception(s):</b> assigned more than 24 hours ago and still not plotted in the agency EMR. Clinicians are asked to wait until the visit is plotted.</Callout></div>}
      <div className="filters">
        <div className="seg">
          {(['all', 'exceptions', 'upcoming', 'completed'] as const).map((f) => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'exceptions' ? `Plot exceptions (${exceptions})` : f === 'upcoming' ? 'Not yet completed' : 'Completed'}</button>)}
        </div>
        <Select value={agency} onChange={(e) => setAgency(e.target.value)} aria-label="Agency"><option value="">All agencies</option>{state.agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <Select value={clin} onChange={(e) => setClin(e.target.value)} aria-label="Clinician"><option value="">All clinicians</option>{state.users.filter((u) => u.role === 'clinician').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
      </div>
      {groups.length === 0 && <Card><Empty title="No visits match" icon="calendar" /></Card>}
      <div className="stack">
        {groups.map(([k, list]) => (
          <Card key={k} pad={false} title={<h2>{k === 'unscheduled' ? 'Planned date not set' : `${fmtShortDate(k)}${k === todayIso() ? ' · Today' : ''}`} <span className="muted small" style={{ fontWeight: 500 }}>· {list.length} visit(s)</span></h2>}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Patient</th><th>Clinician</th><th>Visit</th><th>Agency / EMR</th><th>EMR plot status</th><th>Clinician confirmation</th><th>Billing</th><th /></tr></thead>
                <tbody>
                  {list.map(({ v, p, a, exception }) => (
                    <tr key={v.id} className={`click ${exception ? 'hl' : ''}`} onClick={() => openVisit(v)}>
                      <td><div className="cell-main">{p.lastName}, {p.firstName}</div><div className="cell-sub">{p.address.city} {p.address.zip}</div></td>
                      <td>{L.userName(v.clinicianId)}</td>
                      <td><Tag kind="discipline">{v.discipline}</Tag> <Tag kind="type">{L.visitType(v.visitTypeCode)?.short}</Tag></td>
                      <td><div>{a.name}</div><div className="cell-sub">{a.emrLabel} · {p.emrRef}</div></td>
                      <td><div className="row wrap"><PlotPill status={v.plotStatus} />{exception && <Pill tone="red" sm>Exception &gt; 24h</Pill>}</div></td>
                      <td><div className="row wrap"><Confirmation at={v.visitCompletedAt} label="Visit" /><Confirmation at={v.noteCompletedAt} label="Note" /></div></td>
                      <td>{v.billingSubmissionId ? <Link to="/office/billing" onClick={(e) => e.stopPropagation()}>Submitted</Link> : <span className="muted small">—</span>}</td>
                      <td className="right"><Button size="sm">Update</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      {open && openRow && (
        <Drawer title={`${openRow.p.firstName} ${openRow.p.lastName} · ${L.visitType(open.visitTypeCode)?.short}`} sub={`${L.userName(open.clinicianId)} · ${openRow.a.name} (${openRow.a.emrLabel})`} onClose={() => setOpenId(null)} footer={<><Button onClick={() => setOpenId(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
          <div className="row wrap"><Link to={`/office/scheduling/requests/${open.requestId}`} className="btn sm">Request</Link><Link to={`/office/patients/${open.patientId}`} className="btn sm">Patient</Link>{L.patientConversation(open.patientId) && <Link to={`/office/chat/${L.patientConversation(open.patientId)!.id}`} className="btn sm">Patient chat</Link>}</div>
          <Field label="Planned visit date" help="The clinician sees this in My Schedule and gets a change banner when it moves."><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={`Plotted in ${openRow.a.emrLabel}?`} help="Office records plotting. No write-back to the agency EMR in Phase 1.">
            <Select value={plot} onChange={(e) => setPlot(e.target.value as PlotStatus)}>
              <option value="not_plotted">Not plotted yet</option>
              <option value="plotted">Plotted in agency EMR</option>
              <option value="delayed">Plot delayed (agency issue)</option>
            </Select>
          </Field>
          <Field label="Office note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Agency CM confirmed plot for Thursday" /></Field>
          <div className="panel">
            <div className="label" style={{ marginBottom: 6 }}>Clinician confirmation (declaration, not verification)</div>
            <div className="row wrap"><Confirmation at={open.visitCompletedAt} label="Visit completed" /><Confirmation at={open.noteCompletedAt} label="Note completed in agency EMR" /></div>
            <p className="small muted" style={{ marginTop: 6 }}>Billing readiness needs the clinician's submission. A plotted visit alone is not billing-ready.</p>
          </div>
          <div><div className="label" style={{ marginBottom: 6 }}>History</div><Timeline items={open.history.map((h) => ({ at: h.at, who: L.userName(h.actorId), text: h.text }))} /></div>
        </Drawer>
      )}
    </>
  );
}
