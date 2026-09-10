import { Link, useParams } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Callout, Card, DefGrid, Empty, I, LinkButton, PageHead, Pill, Tag } from '../ui';
import { PlotPill, SubmissionPill } from '../shared/pills';
import { mapsUrl } from '../domain/geo';
import { fmtDate, fmtRelative, fmtShortDate } from '../domain/format';

export function ClinicianPatients() {
  const { state, me } = useStore();
  const L = useLookups();
  if (!me) return null;
  const active = state.requests.filter((r) => r.status === 'assigned' && r.assignedClinicianId === me.id);
  const past = state.requests.filter((r) => r.status === 'closed' && r.assignedClinicianId === me.id);
  const Row = ({ r }: { r: typeof active[number] }) => { const p = L.patient(r.patientId)!; const v = L.visitForRequest(r.id); return (
    <Link to={`/clinician/patients/${p.id}`} className="list-item click">
      <span className="avatar navy">{p.firstName[0]}{p.lastName[0]}</span>
      <div className="main"><div className="title">{p.firstName} {p.lastName}</div><div className="sub">{L.agency(r.agencyId)?.name} · {r.discipline} {L.visitType(r.visitTypeCode)?.short} · {p.address.city}</div></div>
      {v && (v.billingSubmissionId ? <Pill tone="green" sm>Billed</Pill> : v.visitCompletedAt ? <Pill tone="blue" sm>Visit done</Pill> : <PlotPill status={v.plotStatus} />)}
      <I.chevronRight size={16} className="muted" />
    </Link>
  ); };
  return (
    <>
      <PageHead title="My patients" lede="Patients assigned to you. Access starts at assignment and follows the active service relationship; only the information needed for the visit is shown." />
      <div className="stack" style={{ maxWidth: 820 }}>
        <Card pad={false} title={`Active (${active.length})`}>{active.length ? active.map((r) => <Row key={r.id} r={r} />) : <Empty title="No assigned patients" hint="Accept a request to see the patient here." icon="user" />}</Card>
        {past.length > 0 && <Card pad={false} title={`Past (${past.length})`}>{past.map((r) => <Row key={r.id} r={r} />)}</Card>}
      </div>
    </>
  );
}

export function ClinicianPatientDetail() {
  const { id } = useParams();
  const { state, me } = useStore();
  const L = useLookups();
  const p = L.patient(id);
  const req = state.requests.find((r) => r.patientId === id && r.assignedClinicianId === me?.id && (r.status === 'assigned' || r.status === 'closed'));
  if (!p || !req) return <Callout tone="danger">You do not have access to this patient. Only assigned patients are visible. <Link to="/clinician/patients">Back</Link></Callout>;
  const a = L.agency(p.agencyId)!;
  const v = L.visitForRequest(req.id);
  const conv = L.patientConversation(p.id);
  const sub = v ? L.submission(v.billingSubmissionId) : undefined;
  return (
    <>
      <PageHead crumbs={[{ to: '/clinician/patients', label: 'My patients' }, { label: `${p.firstName} ${p.lastName}` }]} title={`${p.firstName} ${p.lastName}`} lede={`${req.discipline} ${L.visitType(req.visitTypeCode)?.label} · assigned ${fmtRelative(req.assignedAt!)}`} actions={<>{conv && <LinkButton to={`/clinician/chat/${conv.id}`} variant="primary" icon="chat">Patient chat</LinkButton>}<a className="btn" href={mapsUrl(p.address)} target="_blank" rel="noreferrer"><I.navigation size={16} /> Directions</a>{v && <LinkButton to={`/clinician/schedule/${v.id}`} icon="calendar">Visit</LinkButton>}</>}>
        <div className="row wrap" style={{ marginTop: 4 }}><Tag kind="agency">{a.name}</Tag><Tag kind="insurance">{p.insurance}</Tag><Tag kind="emr">{a.emrDomain}</Tag></div>
      </PageHead>
      {v && v.plotStatus !== 'plotted' && req.status === 'assigned' && <div style={{ marginBottom: 14 }}><Callout tone="warn">Not yet plotted in {a.emrLabel}. Please wait until the office confirms the visit is plotted before seeing the patient.</Callout></div>}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Patient info">
          <DefGrid items={[['Name', `${p.firstName} ${p.lastName}`], ['Date of birth', fmtDate(p.dob)], ['Phone', <a href={`tel:${p.phone}`}>{p.phone}</a>], ['Address', <a href={mapsUrl(p.address)} target="_blank" rel="noreferrer">{p.address.street}, {p.address.city}, {p.address.state} {p.address.zip}</a>], ['Agency', a.name], ['Agency EMR', `${a.emrLabel} (${a.emrDomain})`], ['EMR reference', p.emrRef], ['Insurance', p.insurance]]} />
          <div className="divider" style={{ margin: '14px 0' }} />
          <div className="label">Notes for you</div><p>{p.clinicianNotes || <span className="muted">None</span>}</p>
          {req.notesToClinicians && req.notesToClinicians !== p.clinicianNotes && <p style={{ marginTop: 6 }}>{req.notesToClinicians}</p>}
        </Card>
        <div className="stack">
          <Card title="Visit">
            {v ? <DefGrid items={[['Visit type', `${L.visitType(v.visitTypeCode)?.label} (${v.visitTypeCode})`], ['Planned date', v.plannedDate ? fmtShortDate(v.plannedDate) : 'To be confirmed by office'], ['Plotted in agency EMR', <PlotPill status={v.plotStatus} />], ['Your confirmation', v.visitCompletedAt ? `Visit ✓${v.noteCompletedAt ? ' · Note ✓' : ' · Note pending'}` : 'Not yet confirmed'], ['Billing', sub ? <SubmissionPill status={sub.status} /> : 'Not submitted']]} /> : <span className="muted">No visit record.</span>}
            {v && <div style={{ marginTop: 12 }}><Link to={`/clinician/schedule/${v.id}`} className="btn primary sm">Open visit to confirm or bill</Link></div>}
          </Card>
          <Callout tone="neutral">Clinical documentation stays in {a.emrLabel}. Here you confirm the visit and note completion so the office can review billing.</Callout>
        </div>
      </div>
    </>
  );
}
