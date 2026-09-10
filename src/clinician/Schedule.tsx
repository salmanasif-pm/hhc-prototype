import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, Check, DefGrid, Drawer, Empty, Field, FilePick, I, Input, PageHead, Pill, Tag, Textarea, useToast } from '../ui';
import { PlotPill, SubmissionPill } from '../shared/pills';
import { visitReadyToSubmit } from '../domain/rules';
import { fmtShortDate, money, todayIso } from '../domain/format';
import { mapsUrl } from '../domain/geo';

export function ClinicianSchedule() {
  const { id } = useParams();
  const { state, actions, me } = useStore();
  const L = useLookups();
  const nav = useNavigate();
  const toast = useToast();
  const [memo, setMemo] = useState('');
  const [visitDate, setVisitDate] = useState(todayIso());
  const [file, setFile] = useState<string | undefined>();
  const [billing, setBilling] = useState(false);
  if (!me) return null;
  const visits = state.visits.filter((v) => v.clinicianId === me.id && (L.request(v.requestId)?.status === 'assigned' || v.billingSubmissionId)).sort((a, b) => (a.plannedDate ?? '9999').localeCompare(b.plannedDate ?? '9999'));
  const upcoming = visits.filter((v) => !v.visitCompletedAt);
  const done = visits.filter((v) => v.visitCompletedAt);
  const v = id ? visits.find((x) => x.id === id) : undefined;
  const p = v ? L.patient(v.patientId) : undefined;
  const a = v ? L.agency(v.agencyId) : undefined;
  const sub = v ? L.submission(v.billingSubmissionId) : undefined;
  const rate = v ? me.rateCard?.[v.visitTypeCode] ?? null : null;
  const close = () => { nav('/clinician/schedule'); setBilling(false); };

  const Row = ({ x }: { x: typeof visits[number] }) => { const pt = L.patient(x.patientId)!; const ready = visitReadyToSubmit(x); return (
    <Link to={`/clinician/schedule/${x.id}`} className="list-item click">
      <div style={{ textAlign: 'center', minWidth: 54 }}><div className="small muted" style={{ textTransform: 'uppercase' }}>{x.plannedDate ? new Date(x.plannedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }) : 'TBC'}</div><div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--navy)' }}>{x.plannedDate ? new Date(x.plannedDate + 'T12:00:00').getDate() : '—'}</div></div>
      <div className="main"><div className="title">{pt.firstName} {pt.lastName} <span className="muted" style={{ fontWeight: 500 }}>· {L.visitType(x.visitTypeCode)?.short}</span></div><div className="sub">{L.agency(x.agencyId)?.name} · {pt.address.city}{x.plannedDate === todayIso() ? ' · Today' : ''}</div></div>
      {x.billingSubmissionId ? <Pill tone="green" sm>Billed</Pill> : ready ? <Pill tone="blue" sm>Ready to bill</Pill> : x.visitCompletedAt ? <Pill tone="amber" sm>Note pending</Pill> : <PlotPill status={x.plotStatus} />}
      <I.chevronRight size={16} className="muted" />
    </Link>
  ); };

  return (
    <>
      <PageHead title="My schedule" lede="Planned visits by date, set by the office. Open a visit for directions, to confirm completion, and to submit billing from the same record." />
      <div className="stack" style={{ maxWidth: 820 }}>
        <Card pad={false} title={`Upcoming (${upcoming.length})`}>{upcoming.length ? upcoming.map((x) => <Row key={x.id} x={x} />) : <Empty title="No upcoming visits" icon="calendar" />}</Card>
        <Card pad={false} title={`Completed (${done.length})`}>{done.length ? done.map((x) => <Row key={x.id} x={x} />) : <Empty title="No completed visits yet" icon="check" />}</Card>
      </div>
      {v && p && a && (
        <Drawer title={`${p.firstName} ${p.lastName} · ${L.visitType(v.visitTypeCode)?.label}`} sub={`${a.name} · ${v.plannedDate ? fmtShortDate(v.plannedDate) : 'date to be confirmed'}`} onClose={close}>
          <div className="row wrap"><a className="btn sm" href={mapsUrl(p.address)} target="_blank" rel="noreferrer"><I.navigation size={14} /> Directions</a><Link to={`/clinician/patients/${p.id}`} className="btn sm">Patient</Link>{L.patientConversation(p.id) && <Link to={`/clinician/chat/${L.patientConversation(p.id)!.id}`} className="btn sm">Chat</Link>}</div>
          <DefGrid items={[['Address', `${p.address.street}, ${p.address.city} ${p.address.zip}`], ['Planned date', v.plannedDate ? fmtShortDate(v.plannedDate) : 'To be confirmed'], ['Plotted in ' + a.emrLabel, <PlotPill status={v.plotStatus} />], ['Notes', p.clinicianNotes || '—']]} />
          {v.plotStatus !== 'plotted' && !v.visitCompletedAt && <Callout tone="warn">Wait until the office marks this visit plotted in {a.emrLabel} before seeing the patient.</Callout>}
          <Card title="Confirm completed work" pad>
            <div className="stack" style={{ gap: 10 }}>
              <Check label={<span><b>Visit completed</b>{v.visitCompletedAt ? <span className="muted small"> · confirmed {fmtShortDate(v.visitCompletedAt)}</span> : null}</span>} checked={!!v.visitCompletedAt} disabled={!!v.billingSubmissionId} onChange={(c) => { actions.confirmVisit(v.id, { visitCompleted: c }); toast(c ? 'Visit marked completed' : 'Visit confirmation removed'); }} />
              <Check label={<span><b>Note completed in {a.emrLabel}</b>{v.noteCompletedAt ? <span className="muted small"> · confirmed {fmtShortDate(v.noteCompletedAt)}</span> : null}</span>} checked={!!v.noteCompletedAt} disabled={!!v.billingSubmissionId} onChange={(c) => { actions.confirmVisit(v.id, { noteCompleted: c }); toast(c ? 'Note completion recorded' : 'Note confirmation removed'); }} />
              <p className="small muted">This is your declaration for office review. Clinical notes stay in the agency EMR.</p>
            </div>
          </Card>
          {sub ? (
            <Card title="Billing" pad>
              <DefGrid items={[['Status', <SubmissionPill status={sub.status} />], ['Visit date submitted', fmtShortDate(sub.visitDate)], ['Your rate', money(sub.clinicianRate)], ['Payout', sub.payoutStatus]]} />
              {sub.returnReason && <div style={{ marginTop: 10 }}><Callout tone="warn"><b>Returned:</b> {sub.returnReason} <Link to="/clinician/billing">Correct in Billing</Link></Callout></div>}
            </Card>
          ) : visitReadyToSubmit(v) ? (
            <Card title="Submit this visit for billing" pad>
              {!billing ? <><p className="small muted" style={{ marginBottom: 10 }}>Patient, agency, visit type and your agreed rate are already here. Add the date and an optional memo.</p><Button variant="primary" icon="dollar" onClick={() => { setBilling(true); setVisitDate(v.plannedDate ?? todayIso()); }}>Submit for billing</Button></> : (
                <div className="stack">
                  <DefGrid items={[['Patient', `${p.firstName} ${p.lastName}`], ['Agency', a.name], ['Visit type', `${L.visitType(v.visitTypeCode)?.label} (${v.visitTypeCode})`], ['Your rate (pre-filled)', rate !== null ? money(rate) : 'Not on file - contact the office']]} />
                  <Field label="Visit date" required><Input type="date" value={visitDate} max={todayIso()} onChange={(e) => setVisitDate(e.target.value)} /></Field>
                  <Field label="Memo (optional)"><Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. Frequency 2w4 effective this week" /></Field>
                  <Field label="Evidence file (optional)"><FilePick value={file} onChange={setFile} hint="Attach a visit verification if your agency requires one" /></Field>
                  <div className="row" style={{ justifyContent: 'flex-end' }}><Button onClick={() => setBilling(false)}>Cancel</Button><Button variant="primary" disabled={rate === null || !visitDate} onClick={() => { const r = actions.submitBilling(v.id, { visitDate, memo: memo.trim(), evidenceFileName: file }); if (!r.ok) { toast(r.reason, 'error'); return; } toast('Submitted for billing review', 'success'); setBilling(false); setMemo(''); setFile(undefined); nav('/clinician/billing'); }}>Submit</Button></div>
                </div>
              )}
            </Card>
          ) : <Callout tone="neutral">Confirm both the visit and the note to submit billing.</Callout>}
          <span style={{ display: 'none' }}><Tag>{v.id}</Tag></span>
        </Drawer>
      )}
    </>
  );
}
