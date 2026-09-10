import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, DefGrid, Empty, Field, FilePick, I, Input, LinkButton, Modal, PageHead, Pill, SearchBox, Select, Tabs, Tag, Textarea, Timeline, useToast } from '../ui';
import { PlotPill, RequestPill, SubmissionPill } from '../shared/pills';
import { DISCIPLINES } from '../domain/labels';
import { ZIPS, cityForZip } from '../domain/geo';
import { possibleDuplicates } from '../domain/rules';
import { fmtDate, fmtDateTime, todayIso } from '../domain/format';
import type { Discipline, VisitTypeCode } from '../domain/types';
import { RequestCard } from './Requests';

export function PatientsPage() {
  const { state } = useStore();
  const L = useLookups();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [agency, setAgency] = useState('');
  const rows = useMemo(() => state.patients
    .filter((p) => !agency || p.agencyId === agency)
    .filter((p) => { const s = `${p.firstName} ${p.lastName} ${p.lastName}, ${p.firstName} ${p.mrn ?? ''} ${L.agency(p.agencyId)?.name} ${p.address.city} ${p.address.zip}`.toLowerCase(); return !q || s.includes(q.toLowerCase()); })
    .map((p) => ({ p, active: state.requests.find((r) => r.patientId === p.id && (r.status === 'pending' || r.status === 'assigned')), last: state.requests.filter((r) => r.patientId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] }))
    .sort((a, b) => a.p.lastName.localeCompare(b.p.lastName)), [state.patients, state.requests, q, agency, L]);
  return (
    <>
      <PageHead title="Patients" lede="One patient record feeds Scheduling, Chat and Billing. Search by name, record number or agency; request status filters live in Scheduling > Requests." actions={<LinkButton to="/office/patients/new" variant="primary" icon="plus">Add patient & referral</LinkButton>} />
      <div className="filters">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, MRN, agency, city or ZIP" />
        <Select value={agency} onChange={(e) => setAgency(e.target.value)} aria-label="Agency"><option value="">All agencies</option>{state.agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <span className="small muted">{rows.length} patient(s)</span>
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty title="No patients match" icon="user" action={<LinkButton to="/office/patients/new" variant="primary">Add patient & referral</LinkButton>} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Patient</th><th>DOB / MRN</th><th>Agency</th><th>Location</th><th>Insurance</th><th>Latest referral</th><th>Active request</th></tr></thead>
            <tbody>{rows.map(({ p, active, last }) => (
              <tr key={p.id} className="click" onClick={() => nav(`/office/patients/${p.id}`)}>
                <td><div className="cell-main">{p.lastName}, {p.firstName}</div><div className="cell-sub">{p.phone}</div></td>
                <td><div>{fmtDate(p.dob)}</div><div className="cell-sub">MRN {p.mrn ?? '—'}</div></td>
                <td><Tag kind="agency">{L.agency(p.agencyId)?.name}</Tag></td>
                <td>{p.address.city} {p.address.zip}</td>
                <td><Tag kind="insurance">{p.insurance}</Tag></td>
                <td>{p.referrals[p.referrals.length - 1] ? <span><Tag kind="discipline">{p.referrals[p.referrals.length - 1]!.discipline}</Tag> <Tag kind="type">{p.referrals[p.referrals.length - 1]!.visitTypeCode}</Tag> <span className="cell-sub">{fmtDate(p.referrals[p.referrals.length - 1]!.receivedOn)}</span></span> : '—'}</td>
                <td>{active ? <span className="row wrap"><RequestPill req={active} />{active.assignedClinicianId && <span className="small">{L.userName(active.assignedClinicianId)}</span>}</span> : last ? <RequestPill req={last} /> : <Pill tone="outline">No request yet</Pill>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}

const blank = { firstName: '', lastName: '', dob: '', mrn: '', phone: '', street: '', zip: '', agencyId: '', insurance: 'Medicare', officeNotes: '', clinicianNotes: '', discipline: 'PT' as Discipline, visitType: 'SOC' as VisitTypeCode, receivedOn: todayIso(), caseNotes: '', source: 'Agency email' };

export function NewPatientPage() {
  const { state, actions } = useStore();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ ...blank, agencyId: state.agencies[0]?.id ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dupAck, setDupAck] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const dups = useMemo(() => (f.firstName && f.lastName ? possibleDuplicates(state.patients, f.firstName, f.lastName, f.dob, f.mrn || undefined) : []), [state.patients, f.firstName, f.lastName, f.dob, f.mrn]);
  const zipKnown = ZIPS.some((z) => z.zip === f.zip);

  const submit = (thenRequest: boolean) => {
    const e: Record<string, string> = {};
    if (!f.firstName.trim()) e.firstName = 'Required';
    if (!f.lastName.trim()) e.lastName = 'Required';
    if (!f.dob) e.dob = 'Required';
    if (!f.phone.trim()) e.phone = 'Required';
    if (!f.street.trim()) e.street = 'Required';
    if (!/^\d{5}$/.test(f.zip)) e.zip = 'Enter a 5-digit ZIP';
    if (!f.agencyId) e.agencyId = 'Required';
    if (dups.length && !dupAck) e.dup = 'Possible duplicate - confirm this is a different patient or open the existing record.';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please fix the highlighted fields', 'error'); return; }
    const agency = state.agencies.find((a) => a.id === f.agencyId)!;
    const id = actions.addPatient({
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), dob: f.dob, mrn: f.mrn.trim() || undefined, phone: f.phone.trim(),
      address: { street: f.street.trim(), state: 'CA', zip: f.zip, city: zipKnown ? cityForZip(f.zip) : 'Unknown' },
      agencyId: f.agencyId, emrRef: `${agency.emrLabel}: ${agency.name.split(' ')[0]}`, insurance: f.insurance, officeNotes: f.officeNotes, clinicianNotes: f.clinicianNotes,
    }, { receivedOn: f.receivedOn, discipline: f.discipline, visitTypeCode: f.visitType, caseNotes: f.caseNotes, source: f.source });
    toast('Patient and referral saved', 'success');
    nav(thenRequest || sp.get('return') === 'request' ? `/office/scheduling/requests/new?patient=${id}` : `/office/patients/${id}`);
  };

  return (
    <>
      <PageHead crumbs={[{ to: '/office/patients', label: 'Patient' }, { label: 'Add patient & referral' }]} title="Add patient and referral" lede="Enter the referral details once. The record is reused when creating the visit request, in the patient chat and in billing." />
      <div className="grid-3" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
        <Card title="Patient" footer={<><Button onClick={() => nav(-1)}>Cancel</Button><Button onClick={() => submit(false)}>Save patient</Button><Button variant="primary" icon="chevronRight" onClick={() => submit(true)}>Save and create visit request</Button></>}>
          <div className="form-grid">
            <Field label="First name" required error={errors.firstName}><Input value={f.firstName} onChange={set('firstName')} invalid={!!errors.firstName} /></Field>
            <Field label="Last name" required error={errors.lastName}><Input value={f.lastName} onChange={set('lastName')} invalid={!!errors.lastName} /></Field>
            <Field label="Date of birth" required error={errors.dob}><Input type="date" value={f.dob} onChange={set('dob')} invalid={!!errors.dob} max={todayIso()} /></Field>
            <Field label="MRN / record number" help="Optional. Agency record number."><Input value={f.mrn} onChange={set('mrn')} /></Field>
            <Field label="Phone" required error={errors.phone}><Input value={f.phone} onChange={set('phone')} placeholder="(510) 555-0100" invalid={!!errors.phone} /></Field>
            <Field label="Insurance (context only)" help="HHC bills the agency, not insurance."><Select value={f.insurance} onChange={set('insurance')}>{['Medicare', 'Medicare Advantage', 'Medi-Cal', 'Commercial', 'Private pay'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Street address" required error={errors.street} className="span2"><Input value={f.street} onChange={set('street')} placeholder="Street and apartment" invalid={!!errors.street} /></Field>
            <Field label="ZIP" required error={errors.zip} help={f.zip.length === 5 ? (zipKnown ? `City: ${cityForZip(f.zip)} (resolved from ZIP)` : 'ZIP outside the demo reference set - matching will find no coverage') : 'City is resolved from the ZIP code.'}><Input value={f.zip} onChange={set('zip')} maxLength={5} invalid={!!errors.zip} list="zips" /><datalist id="zips">{ZIPS.map((z) => <option key={z.zip} value={z.zip}>{z.city}</option>)}</datalist></Field>
            <Field label="Agency" required error={errors.agencyId}><Select value={f.agencyId} onChange={set('agencyId')} invalid={!!errors.agencyId}>{state.agencies.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.emrLabel})</option>)}</Select></Field>
            <Field label="Notes to clinicians" className="span2" help="Shown to clinicians on the request and the assigned patient."><Textarea value={f.clinicianNotes} onChange={set('clinicianNotes')} placeholder="e.g. Spanish speaking. Walker in home. Call before arrival." /></Field>
            <Field label="Office notes (internal)" className="span2"><Textarea value={f.officeNotes} onChange={set('officeNotes')} placeholder="Gate codes, agency case manager, scheduling constraints" /></Field>
          </div>
          {dups.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <Callout tone="warn">
                <div><b>Possible duplicate:</b> {dups.map((d) => <span key={d.id}><Link to={`/office/patients/${d.id}`}>{d.firstName} {d.lastName}</Link> (DOB {d.dob}, {state.agencies.find((a) => a.id === d.agencyId)?.name}) </span>)}</div>
                <label className="check" style={{ marginTop: 6 }}><input type="checkbox" checked={dupAck} onChange={(e) => setDupAck(e.target.checked)} /> This is a different patient - continue</label>
                {errors.dup && <div className="small" style={{ color: 'var(--red)' }}>{errors.dup}</div>}
              </Callout>
            </div>
          )}
        </Card>
        <Card title="Referral">
          <div className="stack">
            <Field label="Received on" required><Input type="date" value={f.receivedOn} onChange={set('receivedOn')} max={todayIso()} /></Field>
            <Field label="Source"><Select value={f.source} onChange={set('source')}>{['Agency email', 'Agency phone call', 'Agency portal', 'Fax'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <div className="grid-2">
              <Field label="Discipline" required><Select value={f.discipline} onChange={set('discipline')}>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</Select></Field>
              <Field label="Visit type" required><Select value={f.visitType} onChange={set('visitType')}>{state.visitTypes.map((v) => <option key={v.code} value={v.code}>{v.short} - {v.label}</option>)}</Select></Field>
            </div>
            <Field label="Case-management notes"><Textarea value={f.caseNotes} onChange={set('caseNotes')} placeholder="e.g. PT SOC after hip replacement. Frequency per eval." /></Field>
            <Callout tone="neutral">Agencies keep sending referrals as they do today (email, phone). There is no separate referral portal in Phase 1.</Callout>
          </div>
        </Card>
      </div>
    </>
  );
}

export function PatientDetailPage() {
  const { id } = useParams();
  const { state, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const p = L.patient(id);
  const [tab, setTab] = useState<'overview' | 'requests' | 'visits' | 'attachments' | 'history'>('overview');
  const [edit, setEdit] = useState(false);
  const [ef, setEf] = useState({ phone: '', street: '', zip: '', insurance: '', officeNotes: '', clinicianNotes: '', mrn: '' });
  const [addRef, setAddRef] = useState(false);
  const [rf, setRf] = useState({ discipline: 'PT' as Discipline, visitType: 'SOC' as VisitTypeCode, caseNotes: '', receivedOn: todayIso() });
  const [file, setFile] = useState<string | undefined>();
  if (!p) return <Callout tone="danger">Patient not found. <Link to="/office/patients">Back to patients</Link></Callout>;
  const a = L.agency(p.agencyId)!;
  const reqs = state.requests.filter((r) => r.patientId === p.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const active = reqs.find((r) => r.status === 'pending' || r.status === 'assigned');
  const visits = state.visits.filter((v) => v.patientId === p.id);
  const conv = L.patientConversation(p.id);
  const openEdit = () => { setEf({ phone: p.phone, street: p.address.street, zip: p.address.zip, insurance: p.insurance, officeNotes: p.officeNotes, clinicianNotes: p.clinicianNotes, mrn: p.mrn ?? '' }); setEdit(true); };

  return (
    <>
      <PageHead crumbs={[{ to: '/office/patients', label: 'Patient' }, { label: `${p.firstName} ${p.lastName}` }]} title={<span className="row wrap">{p.firstName} {p.lastName}{active && <RequestPill req={active} />}</span>}
        actions={<>
          {conv && <LinkButton to={`/office/chat/${conv.id}`} icon="chat">Patient chat</LinkButton>}
          <Button icon="edit" onClick={openEdit}>Edit details</Button>
          <LinkButton to={`/office/scheduling/requests/new?patient=${p.id}`} variant="primary" icon="plus">New visit request</LinkButton>
        </>}>
        <div className="row wrap" style={{ marginTop: 4 }}><Tag kind="agency">{a.name}</Tag><Tag kind="insurance">{p.insurance}</Tag><Tag kind="emr">{a.emrDomain}</Tag><span className="tag">{p.emrRef}</span></div>
      </PageHead>
      <Tabs value={tab} onChange={setTab} items={[{ key: 'overview', label: 'Patient info' }, { key: 'requests', label: 'Requests', count: reqs.length }, { key: 'visits', label: 'Visits', count: visits.length }, { key: 'attachments', label: 'Attachments', count: p.attachments.length }, { key: 'history', label: 'History' }]} />
      {tab === 'overview' && (
        <div className="grid-3" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
          <Card title="Patient info">
            <DefGrid items={[['Name', `${p.firstName} ${p.lastName}`], ['Date of birth', fmtDate(p.dob)], ['MRN', p.mrn ?? '—'], ['Phone', p.phone], ['Address', `${p.address.street}, ${p.address.city}, ${p.address.state} ${p.address.zip}`], ['Agency', a.name], ['EMR', `${a.emrLabel} · ${a.emrDomain}`], ['Insurance', p.insurance], ['Added', fmtDateTime(p.createdAt)]]} />
            <div className="divider" style={{ margin: '14px 0' }} />
            <div className="grid-2">
              <div><div className="label">Notes to clinicians</div><p>{p.clinicianNotes || <span className="muted">None</span>}</p></div>
              <div><div className="label">Office notes (internal)</div><p>{p.officeNotes || <span className="muted">None</span>}</p></div>
            </div>
          </Card>
          <div className="stack">
            <Card title="Active assignment">
              {active ? (
                <div className="stack">
                  <div className="row wrap"><Tag kind="discipline">{active.discipline}</Tag><Tag kind="type">{L.visitType(active.visitTypeCode)?.short}</Tag><RequestPill req={active} /></div>
                  {active.assignedClinicianId ? <div>Assigned to <Link to={`/office/users/${active.assignedClinicianId}`}><b>{L.userName(active.assignedClinicianId)}</b></Link></div> : <div className="muted">Waiting for clinician responses</div>}
                  {(() => { const v = L.visitForRequest(active.id); return v ? <div className="row wrap"><span className="small">Planned {v.plannedDate ?? 'not set'}</span><PlotPill status={v.plotStatus} /></div> : null; })()}
                  <Link to={`/office/scheduling/requests/${active.id}`} className="btn sm">Open request</Link>
                </div>
              ) : <Empty title="No active request" hint="Create a visit request from the latest referral." icon="layers" action={<LinkButton to={`/office/scheduling/requests/new?patient=${p.id}`} variant="primary" size="sm">New visit request</LinkButton>} />}
            </Card>
            <Card title="Referrals" actions={<Button size="sm" icon="plus" onClick={() => setAddRef(true)}>Add referral</Button>}>
              <div className="list">
                {[...p.referrals].reverse().map((r) => (
                  <div key={r.id} className="list-item" style={{ padding: '10px 0' }}>
                    <div className="main"><div className="title row wrap"><Tag kind="discipline">{r.discipline}</Tag><Tag kind="type">{r.visitTypeCode}</Tag><span className="small muted">received {fmtDate(r.receivedOn)} · {r.source}</span></div><div className="sub" style={{ whiteSpace: 'normal' }}>{r.caseNotes}</div></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
      {tab === 'requests' && <Card pad={false}>{reqs.length ? reqs.map((r) => <RequestCard key={r.id} req={r} />) : <Empty title="No requests yet" icon="layers" />}</Card>}
      {tab === 'visits' && (
        <Card pad={false}>
          {visits.length === 0 ? <Empty title="No visits yet" hint="A visit record is created when a clinician is assigned." icon="calendar" /> : (
            <div className="table-wrap"><table className="table"><thead><tr><th>Planned date</th><th>Clinician</th><th>Visit</th><th>EMR plot</th><th>Confirmation</th><th>Billing</th></tr></thead><tbody>
              {visits.map((v) => { const s = L.submission(v.billingSubmissionId); return (
                <tr key={v.id}><td>{v.plannedDate ?? '—'}</td><td>{L.userName(v.clinicianId)}</td><td><Tag kind="discipline">{v.discipline}</Tag> <Tag kind="type">{L.visitType(v.visitTypeCode)?.short}</Tag></td><td><PlotPill status={v.plotStatus} /></td><td>{v.visitCompletedAt ? `Visit ✓${v.noteCompletedAt ? ' · Note ✓' : ''}` : <span className="muted">Pending</span>}</td><td>{s ? <Link to="/office/billing"><SubmissionPill status={s.status} /></Link> : <span className="muted">—</span>}</td></tr>
              ); })}
            </tbody></table></div>
          )}
        </Card>
      )}
      {tab === 'attachments' && (
        <Card title="Attachments" actions={<div className="row"><div style={{ minWidth: 260 }}><FilePick value={file} onChange={setFile} hint="Choose a face sheet or referral PDF" /></div><Button variant="primary" disabled={!file} onClick={() => { actions.addAttachment(p.id, file!); setFile(undefined); toast('Attachment added', 'success'); }}>Add</Button></div>}>
          {p.attachments.length === 0 ? <Empty title="No attachments" hint="Referral face sheets and coordination documents can be attached here (PDF or image, 10 MB)." icon="file" /> : (
            <div className="list">{p.attachments.map((at) => <div key={at.id} className="list-item"><I.file size={18} className="muted" /><div className="main"><div className="title">{at.name}</div><div className="sub">Added {fmtDateTime(at.uploadedAt)} by {L.userName(at.by)}</div></div><Button size="sm" onClick={() => toast('Download simulated - documents are not stored in this prototype')}>Download</Button></div>)}</div>
          )}
        </Card>
      )}
      {tab === 'history' && <Card title="History"><Timeline items={p.history.map((h) => ({ at: h.at, who: L.userName(h.actorId), text: h.text }))} /></Card>}

      {edit && (
        <Modal title="Edit patient details" onClose={() => setEdit(false)} footer={<><Button onClick={() => setEdit(false)}>Cancel</Button><Button variant="primary" onClick={() => { if (!/^\d{5}$/.test(ef.zip) || !ef.phone.trim() || !ef.street.trim()) { toast('Phone, street and a 5-digit ZIP are required', 'error'); return; } actions.updatePatient(p.id, { phone: ef.phone, mrn: ef.mrn || undefined, insurance: ef.insurance, officeNotes: ef.officeNotes, clinicianNotes: ef.clinicianNotes, address: { ...p.address, street: ef.street, zip: ef.zip, city: cityForZip(ef.zip) } }); setEdit(false); toast('Patient updated', 'success'); }}>Save</Button></>}>
          <div className="form-grid">
            <Field label="Phone" required><Input value={ef.phone} onChange={(e) => setEf({ ...ef, phone: e.target.value })} /></Field>
            <Field label="MRN"><Input value={ef.mrn} onChange={(e) => setEf({ ...ef, mrn: e.target.value })} /></Field>
            <Field label="Street" required className="span2"><Input value={ef.street} onChange={(e) => setEf({ ...ef, street: e.target.value })} /></Field>
            <Field label="ZIP" required><Input value={ef.zip} maxLength={5} onChange={(e) => setEf({ ...ef, zip: e.target.value })} /></Field>
            <Field label="Insurance"><Select value={ef.insurance} onChange={(e) => setEf({ ...ef, insurance: e.target.value })}>{['Medicare', 'Medicare Advantage', 'Medi-Cal', 'Commercial', 'Private pay'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Notes to clinicians" className="span2"><Textarea value={ef.clinicianNotes} onChange={(e) => setEf({ ...ef, clinicianNotes: e.target.value })} /></Field>
            <Field label="Office notes" className="span2"><Textarea value={ef.officeNotes} onChange={(e) => setEf({ ...ef, officeNotes: e.target.value })} /></Field>
          </div>
          <p className="small muted">Changes are recorded in the patient history.</p>
        </Modal>
      )}
      {addRef && (
        <Modal title="Add referral" onClose={() => setAddRef(false)} footer={<><Button onClick={() => setAddRef(false)}>Cancel</Button><Button variant="primary" onClick={() => { actions.addReferral(p.id, { receivedOn: rf.receivedOn, discipline: rf.discipline, visitTypeCode: rf.visitType, caseNotes: rf.caseNotes, source: 'Agency email' }); setAddRef(false); toast('Referral added', 'success'); }}>Add referral</Button></>}>
          <div className="grid-2">
            <Field label="Discipline"><Select value={rf.discipline} onChange={(e) => setRf({ ...rf, discipline: e.target.value as Discipline })}>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</Select></Field>
            <Field label="Visit type"><Select value={rf.visitType} onChange={(e) => setRf({ ...rf, visitType: e.target.value as VisitTypeCode })}>{state.visitTypes.map((v) => <option key={v.code} value={v.code}>{v.short} - {v.label}</option>)}</Select></Field>
          </div>
          <Field label="Received on"><Input type="date" value={rf.receivedOn} onChange={(e) => setRf({ ...rf, receivedOn: e.target.value })} /></Field>
          <Field label="Case-management notes"><Textarea value={rf.caseNotes} onChange={(e) => setRf({ ...rf, caseNotes: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
