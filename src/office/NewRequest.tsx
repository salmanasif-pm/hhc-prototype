import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, Check, Chips, Field, Input, Modal, PageHead, Pill, SearchBox, Select, Steps, Tag, Textarea, Toggle, useToast } from '../ui';
import { ReadinessPill } from '../shared/pills';
import { candidatesFor, readinessFor, type Candidate } from '../domain/rules';
import { DISCIPLINES, LANGUAGES } from '../domain/labels';
import { daysFromNow, dateFromNow, fmtDateTime } from '../domain/format';
import type { AssignMode, Discipline, VisitTypeCode } from '../domain/types';

interface Plan { selected: Record<string, number>; mode: AssignMode; delays: number[]; overrides: Record<string, string>; showOutside: boolean }

export function NewRequestPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { state, actions, me } = useStore();
  const L = useLookups();
  const nav = useNavigate();
  const toast = useToast();
  const existing = L.request(id);

  const [step, setStep] = useState(existing ? 1 : 0);
  const [patientId, setPatientId] = useState(existing?.patientId ?? sp.get('patient') ?? '');
  const [pq, setPq] = useState('');
  const patient = L.patient(patientId);
  const lastRef = patient?.referrals[patient.referrals.length - 1];
  const [discipline, setDiscipline] = useState<Discipline>(existing?.discipline ?? lastRef?.discipline ?? 'PT');
  const [visitType, setVisitType] = useState<VisitTypeCode>(existing?.visitTypeCode ?? lastRef?.visitTypeCode ?? 'SOC');
  const [visitBy, setVisitBy] = useState(existing ? existing.visitBy.slice(0, 16) : daysFromNow(3, 23, 59).slice(0, 16));
  const [languages, setLanguages] = useState<string[]>(existing?.languages ?? []);
  const [notes, setNotes] = useState(existing?.notesToClinicians ?? patient?.clinicianNotes ?? '');
  const [officeNotes, setOfficeNotes] = useState(existing?.officeNotes ?? patient?.officeNotes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<Plan>({ selected: {}, mode: 'fcfs', delays: [0, 60, 120], overrides: {}, showOutside: false });
  const [overrideFor, setOverrideFor] = useState<Candidate | null>(null);
  const [ovReason, setOvReason] = useState('');
  const [ovUntil, setOvUntil] = useState(dateFromNow(30));

  // when a patient is chosen, prefill from the latest referral
  useEffect(() => {
    if (!existing && patient) {
      const r = patient.referrals[patient.referrals.length - 1];
      if (r) { setDiscipline(r.discipline); setVisitType(r.visitTypeCode); }
      setNotes(patient.clinicianNotes); setOfficeNotes(patient.officeNotes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const candidates = useMemo(() => (patient ? candidatesFor(state, patient, discipline, languages) : []), [state, patient, discipline, languages]);
  // pre-select eligible in-coverage clinicians (CareStitch "send to all" default)
  useEffect(() => {
    if (step === 1 && Object.keys(plan.selected).length === 0) {
      const sel: Record<string, number> = {};
      for (const c of candidates) if (c.eligible) sel[c.clinician.id] = 1;
      setPlan((p) => ({ ...p, selected: sel }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!patientId) e.patient = 'Select or add a patient first.';
    if (!visitBy) e.visitBy = 'A visit-by date and time is required.';
    else if (new Date(visitBy).getTime() < Date.now()) e.visitBy = 'The visit-by time must be in the future.';
    if (!discipline) e.discipline = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const saveDraft = (): string | null => {
    if (!validate()) return null;
    const data = { patientId, referralId: lastRef?.id ?? '', discipline, visitTypeCode: visitType, visitBy: new Date(visitBy).toISOString(), notesToClinicians: notes, officeNotes, languages };
    if (existing) { actions.updateRequest(existing.id, data); return existing.id; }
    const newId = actions.createRequest(data);
    nav(`/office/scheduling/requests/${newId}/send`, { replace: true });
    return newId;
  };
  const groupCount = Math.max(1, ...Object.values(plan.selected));
  const groupsArr = Array.from({ length: Math.max(groupCount, 1) }, (_, i) => i + 1);
  const selectedList = Object.entries(plan.selected).sort((a, b) => a[1] - b[1]);
  const toggle = (c: Candidate) => {
    setPlan((p) => {
      const s = { ...p.selected };
      if (s[c.clinician.id]) delete s[c.clinician.id]; else s[c.clinician.id] = 1;
      return { ...p, selected: s };
    });
  };
  const send = () => {
    const reqId = existing?.id ?? saveDraft();
    if (!reqId) return;
    const groups = groupsArr.map((g, i) => ({ clinicianIds: selectedList.filter(([, no]) => no === g).map(([cid]) => cid), delayMinutes: i === 0 ? 0 : plan.delays[i] ?? 60 })).filter((g, i) => g.clinicianIds.length > 0 || i === 0);
    const exceptions: Record<string, { outsideCoverage?: boolean; overrideId?: string }> = {};
    for (const [cid] of selectedList) {
      const c = candidates.find((x) => x.clinician.id === cid);
      const ex: { outsideCoverage?: boolean; overrideId?: string } = {};
      if (c && !c.inCoverage) ex.outsideCoverage = true;
      if (plan.overrides[cid]) ex.overrideId = plan.overrides[cid];
      if (Object.keys(ex).length) exceptions[cid] = ex;
    }
    actions.sendRequest(reqId, { assignMode: plan.mode, groups, exceptions });
    toast(`Request sent to ${groups[0]?.clinicianIds.length ?? 0} clinician(s)`, 'success');
    nav(`/office/scheduling/requests/${reqId}`);
  };

  const patientResults = state.patients.filter((p) => { const s = `${p.firstName} ${p.lastName} ${p.mrn ?? ''} ${L.agency(p.agencyId)?.name ?? ''} ${p.address.city}`.toLowerCase(); return !pq || s.includes(pq.toLowerCase()); }).slice(0, 8);

  return (
    <>
      <PageHead crumbs={[{ to: '/office/scheduling/requests', label: 'Scheduling' }, { to: '/office/scheduling/requests', label: 'Requests' }, { label: existing ? 'Send request' : 'New request' }]} title={existing ? `Send request - ${patient?.firstName} ${patient?.lastName}` : 'New visit request'} lede="Enter the request once, select eligible clinicians, review and send. Credential status decides who can receive it." />
      <Steps current={step} labels={['Request info', 'Select clinicians', 'Review & send']} />

      {step === 0 && (
        <div className="grid-3" style={{ gridTemplateColumns: '1fr 1.4fr', alignItems: 'start' }}>
          <Card title="Patient">
            {patient ? (
              <div className="stack">
                <div className="row between">
                  <div>
                    <div className="strong" style={{ fontSize: 16 }}>{patient.firstName} {patient.lastName}</div>
                    <div className="small muted">DOB {patient.dob} · MRN {patient.mrn ?? '—'}</div>
                  </div>
                  {!existing && <Button size="sm" variant="ghost" onClick={() => setPatientId('')}>Change</Button>}
                </div>
                <div className="row wrap"><Tag kind="agency">{L.agency(patient.agencyId)?.name}</Tag><Tag kind="insurance">{patient.insurance}</Tag><Tag kind="emr">{L.agency(patient.agencyId)?.emrDomain}</Tag></div>
                <div className="small">{patient.address.street}, {patient.address.city}, CA {patient.address.zip}</div>
                {lastRef && <Callout tone="neutral">Latest referral ({lastRef.receivedOn}): {lastRef.discipline} {lastRef.visitTypeCode}. {lastRef.caseNotes}</Callout>}
                <Link to={`/office/patients/${patient.id}`} className="small">Open patient record</Link>
              </div>
            ) : (
              <div className="stack">
                <SearchBox value={pq} onChange={setPq} placeholder="Search by name, MRN, agency or city" />
                {errors.patient && <span className="error small" style={{ color: 'var(--red)' }}>{errors.patient}</span>}
                <div className="list card" style={{ boxShadow: 'none' }}>
                  {patientResults.map((p) => (
                    <button key={p.id} className="list-item click" style={{ border: 0, background: 'transparent', width: '100%', textAlign: 'left' }} onClick={() => setPatientId(p.id)}>
                      <div className="main"><div className="title">{p.lastName}, {p.firstName}</div><div className="sub">{L.agency(p.agencyId)?.name} · {p.address.city} {p.address.zip} · MRN {p.mrn ?? '—'}</div></div>
                      <Pill tone="outline" sm>{p.referrals[p.referrals.length - 1]?.discipline} {p.referrals[p.referrals.length - 1]?.visitTypeCode}</Pill>
                    </button>
                  ))}
                  {patientResults.length === 0 && <div className="empty small">No patient matches.</div>}
                </div>
                <Link to="/office/patients/new?return=request" className="btn"><span>+ Add patient and referral</span></Link>
              </div>
            )}
          </Card>
          <Card title="Request type & preferences" footer={<><Button onClick={() => { if (saveDraft()) { toast('Draft saved'); nav('/office/scheduling/requests'); } }}>Save draft</Button><Button variant="primary" onClick={() => { if (saveDraft()) setStep(1); }}>Next: select clinicians</Button></>}>
            <div className="form-grid">
              <Field label="Discipline" required error={errors.discipline}><Select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)}>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</Select></Field>
              <Field label="Visit type" required><Select value={visitType} onChange={(e) => setVisitType(e.target.value as VisitTypeCode)}>{state.visitTypes.map((v) => <option key={v.code} value={v.code}>{v.short} - {v.label}</option>)}</Select></Field>
              <Field label="Visit patient by" required error={errors.visitBy} help="Pending requests expire at this time."><Input type="datetime-local" value={visitBy} invalid={!!errors.visitBy} onChange={(e) => setVisitBy(e.target.value)} /></Field>
              <Field label="Language preference" help="Optional. Used to highlight matching clinicians."><Chips options={LANGUAGES} value={languages} onChange={setLanguages} /></Field>
              <Field label="Notes to clinicians" className="span2" help="Visible to clinicians who receive the request. No street address is shown until assignment."><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. PT SOC this week. Spanish speaking." /></Field>
              <Field label="Office notes (internal)" className="span2"><Textarea value={officeNotes} onChange={(e) => setOfficeNotes(e.target.value)} placeholder="Internal only - gate codes, agency contact, etc." /></Field>
            </div>
          </Card>
        </div>
      )}

      {step === 1 && patient && (
        <div className="grid-3" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
          <Card title={<h2>Eligible clinicians <span className="muted small" style={{ fontWeight: 500 }}>· {discipline} · patient ZIP {patient.address.zip} ({patient.address.city})</span></h2>} actions={<Toggle label="Show clinicians outside coverage" checked={plan.showOutside} onChange={(v) => setPlan((p) => ({ ...p, showOutside: v }))} />}>
            <div className="stack">
              {candidates.filter((c) => c.inCoverage || plan.showOutside).length === 0 && <Callout tone="warn">No active {discipline} clinician covers ZIP {patient.address.zip}. Turn on "Show clinicians outside coverage" to add someone as an exception, or close the request as unstaffed.</Callout>}
              {candidates.filter((c) => c.inCoverage || plan.showOutside).map((c) => {
                const sel = plan.selected[c.clinician.id];
                const blocked = c.readiness === 'blocked' && !plan.overrides[c.clinician.id];
                const disabled = blocked || !c.accepting;
                return (
                  <div key={c.clinician.id} className={`cand-row ${c.readiness === 'blocked' ? 'blocked' : ''} ${!c.accepting ? 'off' : ''}`}>
                    <input type="checkbox" checked={!!sel} disabled={disabled} onChange={() => toggle(c)} aria-label={`Select ${c.clinician.name}`} />
                    <div className="who">
                      <span className={`avatar sm ${c.eligible ? 'green' : ''}`}>{c.clinician.name.split(' ').map((x) => x[0]).join('')}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="n row wrap" style={{ gap: 6 }}>
                          <Link to={`/office/users/${c.clinician.id}`}>{c.clinician.name}</Link>
                          <span className="muted small">{c.clinician.disciplines?.join('/')}</span>
                          <ReadinessPill readiness={plan.overrides[c.clinician.id] ? 'override' : c.readiness} />
                          {!c.inCoverage && <Pill tone="outline" sm>Outside coverage</Pill>}
                          {!c.accepting && <Pill tone="gray" sm>Not accepting work</Pill>}
                          {languages.length > 0 && c.languageMatch && <Pill tone="blue" sm>Language match</Pill>}
                        </div>
                        <div className="s">
                          {c.distance !== null ? `${c.distance} mi from ${c.clinician.homeCity}` : 'Distance unavailable'} · {c.clinician.languages?.join(', ')}
                          {c.readiness === 'blocked' && <span style={{ color: 'var(--red)' }}> · Blocked: {c.blockingLabels.join(', ')}</span>}
                          {c.readiness === 'expiring' && <span style={{ color: 'var(--amber)' }}> · A credential expires within 30 days</span>}
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      {c.readiness === 'blocked' && !plan.overrides[c.clinician.id] && (me?.role === 'admin' ? <Button size="sm" onClick={() => { setOverrideFor(c); setOvReason(''); }}>Record override</Button> : <span className="small muted">Admin override needed</span>)}
                      {sel && (
                        <div className="grp">
                          <Select value={sel} onChange={(e) => setPlan((p) => ({ ...p, selected: { ...p.selected, [c.clinician.id]: Number(e.target.value) } }))} aria-label="Priority group">
                            {[1, 2, 3].map((g) => <option key={g} value={g}>Priority {g}</option>)}
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="stack">
            <Card title="Send options">
              <div className="stack">
                <Toggle label="First-come-first-served: first eligible acceptance is assigned" checked={plan.mode === 'fcfs'} onChange={(v) => setPlan((p) => ({ ...p, mode: v ? 'fcfs' : 'office' }))} />
                {plan.mode === 'office' && <Callout tone="info">Office selection: clinicians respond Available or Not Available and an office user chooses who is assigned.</Callout>}
                <div className="divider" />
                <div className="label">Priority groups</div>
                {groupsArr.map((g) => (
                  <div key={g} className="row between">
                    <span>Priority {g} <span className="muted small">({selectedList.filter(([, n]) => n === g).length} clinicians)</span></span>
                    {g === 1 ? <span className="small muted">Immediately</span> : (
                      <label className="row small">wait <Input type="number" min={0} step={15} style={{ width: 80 }} value={plan.delays[g - 1] ?? 60} onChange={(e) => setPlan((p) => { const d = [...p.delays]; d[g - 1] = Number(e.target.value); return { ...p, delays: d }; })} aria-label={`Delay before priority ${g}`} /> min</label>
                    )}
                  </div>
                ))}
                <p className="small muted">Later groups are released only while the request is still unassigned. The office can also release the next group manually.</p>
              </div>
            </Card>
            <Card footer={<><Button onClick={() => setStep(0)}>Back</Button><Button variant="primary" disabled={selectedList.length === 0} onClick={() => setStep(2)}>Next: review</Button></>}>
              <div className="strong">{selectedList.length} clinician(s) selected</div>
              <p className="small muted">Blocked clinicians cannot be selected without an authorized override. Selections outside coverage are recorded as exceptions.</p>
            </Card>
          </div>
        </div>
      )}

      {step === 2 && patient && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <Card title="Request details">
            <p style={{ lineHeight: 1.8 }}>
              Request for <b>{L.visitType(visitType)?.label} ({L.visitType(visitType)?.short})</b> to see patient <b>{patient.firstName} {patient.lastName}</b><br />
              Located in <b>{patient.address.zip} ({patient.address.city})</b> · Agency <b>{L.agency(patient.agencyId)?.name}</b><br />
              Must be seen by <b>{fmtDateTime(new Date(visitBy).toISOString())}</b><br />
              Looking for <b>{discipline}</b>{languages.length ? <> · Language: <b>{languages.join(', ')}</b></> : null}<br />
              Notes to clinicians: <b>{notes || '—'}</b>
            </p>
            <Callout tone="neutral">Clinicians see the city and ZIP, agency, visit type, deadline and notes. The full street address appears only after assignment.</Callout>
          </Card>
          <Card title="Selected clinicians" footer={<><Button onClick={() => setStep(1)}>Back</Button><Button variant="primary" icon="send" onClick={send}>Send request</Button></>}>
            <div className="stack">
              {groupsArr.map((g, i) => {
                const list = selectedList.filter(([, n]) => n === g);
                return (
                  <div key={g}>
                    <div className="row between"><span className="strong">Priority {g}</span><span className="small muted">{i === 0 ? 'Immediately' : `${plan.delays[i] ?? 60} min after the previous group if unassigned`}</span></div>
                    <div className="row wrap" style={{ marginTop: 6 }}>
                      {list.length === 0 && <span className="small muted">Nobody in this group</span>}
                      {list.map(([cid]) => { const c = candidates.find((x) => x.clinician.id === cid)!; return <Pill key={cid} tone={c.eligible ? 'green' : 'amber'}>{c.clinician.name}{!c.inCoverage ? ' · outside coverage' : ''}{plan.overrides[cid] ? ' · override' : ''}</Pill>; })}
                    </div>
                  </div>
                );
              })}
              <div className="divider" />
              <div className="small">Mode: <b>{plan.mode === 'fcfs' ? 'First-come-first-served' : 'Office selection'}</b>. Recipients, send time and read time are recorded on the request.</div>
            </div>
          </Card>
        </div>
      )}

      {overrideFor && (
        <Modal title={`Record credential override - ${overrideFor.clinician.name}`} onClose={() => setOverrideFor(null)} footer={<><Button onClick={() => setOverrideFor(null)}>Cancel</Button><Button variant="primary" disabled={!ovReason.trim()} onClick={() => { const ovId = actions.addOverride(overrideFor.clinician.id, ovReason.trim(), ovUntil); setPlan((p) => ({ ...p, overrides: { ...p.overrides, [overrideFor.clinician.id]: ovId }, selected: { ...p.selected, [overrideFor.clinician.id]: 1 } })); setOverrideFor(null); toast('Override recorded', 'success'); }}>Record override</Button></>}>
          <Callout tone="danger">Blocked: {overrideFor.blockingLabels.join(', ')}. An override lets this clinician receive new requests until the date below. It is recorded with your name, reason and time.</Callout>
          <Field label="Reason" required><Textarea value={ovReason} onChange={(e) => setOvReason(e.target.value)} placeholder="e.g. Renewal card received by email; upload pending" /></Field>
          <Field label="Override expires on" required><Input type="date" value={ovUntil} onChange={(e) => setOvUntil(e.target.value)} /></Field>
          <Check label="I confirm this exception is authorized (Admin)" checked={true} onChange={() => {}} disabled />
          <span className="small muted">Readiness for {overrideFor.clinician.name}: {readinessFor(state, overrideFor.clinician).readiness}</span>
        </Modal>
      )}
    </>
  );
}
