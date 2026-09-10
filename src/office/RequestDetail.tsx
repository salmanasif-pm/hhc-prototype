import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, DefGrid, Field, I, Input, LinkButton, Modal, PageHead, Pill, Select, Tag, Textarea, Timeline, useToast } from '../ui';
import { PlotPill, ReadinessPill, RequestPill } from '../shared/pills';
import { fmtCountdown, fmtDateTime, fmtRelative, hoursUntil } from '../domain/format';
import { readinessFor, responseSummary } from '../domain/rules';
import { distanceMiles } from '../domain/geo';
import type { Recipient } from '../domain/types';

export function RequestDetailPage() {
  const { id } = useParams();
  const { state, actions, me } = useStore();
  const L = useLookups();
  const toast = useToast();
  const req = L.request(id);
  const [modal, setModal] = useState<null | 'cancel' | 'unstaffed' | 'assign' | 'reassign' | 'edit'>(null);
  const [reason, setReason] = useState('');
  const [pick, setPick] = useState('');
  const [notes, setNotes] = useState('');
  const [officeNotes, setOfficeNotes] = useState('');
  const [visitBy, setVisitBy] = useState('');

  if (!req) return <Callout tone="danger">Request not found. <Link to="/office/scheduling/requests">Back to requests</Link></Callout>;
  const p = L.patient(req.patientId)!;
  const a = L.agency(req.agencyId)!;
  const vt = L.visitType(req.visitTypeCode)!;
  const visit = L.visitForRequest(req.id);
  const conv = L.patientConversation(p.id);
  const sum = responseSummary(req);
  const sent = req.recipients.filter((r) => r.sentAt);
  const groupsQueued = req.groups.filter((g) => !g.releasedAt);
  const sections: { key: string; label: string; items: Recipient[]; cls?: string }[] = [
    { key: 'available', label: 'Available', items: sent.filter((r) => r.response === 'available'), cls: 'avail' },
    { key: 'read', label: 'Request read', items: sent.filter((r) => !r.response && r.readAt) },
    { key: 'sent', label: 'Request sent', items: sent.filter((r) => !r.response && !r.readAt) },
    { key: 'queued', label: 'Queued in later groups', items: req.recipients.filter((r) => !r.sentAt) },
    { key: 'na', label: 'Not available', items: sent.filter((r) => r.response === 'not_available') },
  ];
  const availableClinicians = sent.filter((r) => r.response === 'available');
  const otherClinicians = state.users.filter((u) => u.role === 'clinician' && u.status === 'active' && u.disciplines?.includes(req.discipline) && u.id !== req.assignedClinicianId);

  const doAssign = () => {
    const cid = pick || availableClinicians[0]?.clinicianId;
    if (!cid) return;
    const ready = readinessFor(state, L.user(cid)!).readiness;
    const responded = availableClinicians.some((r) => r.clinicianId === cid);
    if ((ready === 'blocked' || !responded) && !reason.trim()) { toast('An authorized exception needs a reason', 'error'); return; }
    actions.assign(req.id, cid, reason.trim() || undefined);
    setModal(null); setReason(''); setPick('');
    toast(`Assigned to ${L.userName(cid)}`, 'success');
  };

  return (
    <>
      <PageHead
        crumbs={[{ to: '/office/scheduling/requests', label: 'Scheduling' }, { to: '/office/scheduling/requests', label: 'Requests' }, { label: `${p.firstName} ${p.lastName}` }]}
        title={<span className="row wrap"><Tag kind="discipline">{req.discipline}</Tag><Tag kind="type">{vt.short}</Tag>{p.firstName} {p.lastName}<RequestPill req={req} /></span>}
        actions={
          <>
            <LinkButton to={`/office/patients/${p.id}`} icon="user">Patient</LinkButton>
            {conv && <LinkButton to={`/office/chat/${conv.id}`} icon="chat">Patient chat</LinkButton>}
            {visit && <LinkButton to="/office/scheduling/schedule" icon="calendar">Schedule</LinkButton>}
            {req.status === 'draft' && <LinkButton to={`/office/scheduling/requests/${req.id}/send`} variant="primary" icon="send">Select clinicians & send</LinkButton>}
            {req.status === 'pending' && groupsQueued.length > 0 && <Button icon="send" onClick={() => { actions.releaseNextGroup(req.id); toast(`Priority group ${groupsQueued[0]!.no} released`, 'success'); }}>Release next group now</Button>}
            {req.status === 'pending' && <Button variant="primary" icon="check" onClick={() => { setPick(availableClinicians[0]?.clinicianId ?? ''); setModal('assign'); }}>Assign clinician</Button>}
            {req.status === 'assigned' && <Button icon="swap" onClick={() => { setPick(''); setModal('reassign'); }}>Reassign</Button>}
            {(req.status === 'pending' || req.status === 'draft') && <Button icon="edit" onClick={() => { setNotes(req.notesToClinicians); setOfficeNotes(req.officeNotes); setVisitBy(req.visitBy.slice(0, 16)); setModal('edit'); }}>Edit</Button>}
            {req.status === 'pending' && <Button variant="danger" onClick={() => setModal('unstaffed')}>Close unstaffed</Button>}
            {(req.status === 'pending' || req.status === 'draft') && <Button variant="danger" onClick={() => setModal('cancel')}>Cancel</Button>}
            {req.status === 'assigned' && <Button onClick={() => { actions.closeRequest(req.id, 'completed'); toast('Request closed as completed'); }}>Close as completed</Button>}
            {req.status === 'closed' && <Button icon="refresh" onClick={() => { actions.reopenRequest(req.id); toast('Request reopened', 'success'); }}>Reopen</Button>}
          </>
        }
      />
      {req.status === 'pending' && hoursUntil(req.visitBy) < 24 && <div style={{ marginBottom: 14 }}><Callout tone="warn">{hoursUntil(req.visitBy) <= 0 ? 'The visit-by time has passed. Assign a clinician, release another group, or close the request as unstaffed.' : `Expiring in ${fmtCountdown(req.visitBy)}. ${sum.available === 0 ? 'No acceptance yet - consider releasing the next priority group or widening the selection.' : ''}`}</Callout></div>}
      {req.status === 'assigned' && visit && visit.plotStatus !== 'plotted' && <div style={{ marginBottom: 14 }}><Callout tone="info">Assigned, but not yet plotted in {a.emrLabel}. Record the planned date and plot status under <Link to="/office/scheduling/schedule">Scheduling &gt; Schedule</Link>.</Callout></div>}

      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
        <div className="stack">
          <Card title="Request details">
            <DefGrid items={[
              ['Patient', <Link to={`/office/patients/${p.id}`}>{p.firstName} {p.lastName}</Link>],
              ['Location', `${p.address.street}, ${p.address.city} ${p.address.zip}`],
              ['Agency', a.name], ['EMR', `${a.emrLabel} (${a.emrDomain})`], ['Insurance', p.insurance],
              ['Visit type', `${vt.label} (${vt.short})`], ['Discipline', req.discipline],
              ['Visit by', fmtDateTime(req.visitBy)], ['Mode', req.assignMode === 'fcfs' ? 'First-come-first-served' : 'Office selection'],
              ['Languages', req.languages.join(', ') || 'Not specified'], ['Created', `${fmtDateTime(req.createdAt)} by ${L.userName(req.createdBy)}`],
            ]} />
            <div className="divider" style={{ margin: '14px 0' }} />
            <div className="grid-2">
              <div><div className="label">Notes to clinicians</div><p>{req.notesToClinicians || <span className="muted">None</span>}</p></div>
              <div><div className="label">Office notes (internal)</div><p>{req.officeNotes || <span className="muted">None</span>}</p></div>
            </div>
          </Card>

          {req.status !== 'draft' && (
            <Card title={<h2>Responses <span className="muted small" style={{ fontWeight: 500 }}>· {sum.sent} sent, {sum.available} available, {sum.notAvailable} not available</span></h2>} actions={
              <div className="groups" style={{ gap: 10 }}>
                {req.groups.map((g) => (
                  <span key={g.no} className="small row" style={{ gap: 6 }}>
                    <span className={`g ${g.releasedAt ? 'on' : ''}`} /> Priority {g.no}
                    <span className="muted">{g.releasedAt ? `sent ${fmtDateTime(g.releasedAt)}` : g.delayMinutes ? `after ${g.delayMinutes} min` : 'queued'}</span>
                  </span>
                ))}
              </div>
            }>
              {req.recipients.length === 0 && <Callout tone="neutral">No clinicians were sent this request{req.log.find((l) => l.actorId === 'system') ? `: ${req.log.find((l) => l.actorId === 'system')!.text}` : '.'}</Callout>}
              {sections.map((s) => (
                <div key={s.key} className="board-section">
                  <h3>{s.label} ({s.items.length})</h3>
                  {s.items.length === 0 ? <div className="muted small">No clinician in this category</div> : (
                    <div className="clin-cards">
                      {s.items.map((r) => {
                        const c = L.user(r.clinicianId)!;
                        const dist = c.homeZip ? distanceMiles(c.homeZip, p.address.zip) : null;
                        const rd = readinessFor(state, c).readiness;
                        const isAssigned = req.assignedClinicianId === r.clinicianId;
                        return (
                          <div key={r.clinicianId} className={`clin-card ${s.cls ?? ''} ${isAssigned ? 'sel' : ''}`}>
                            <div className="nm"><Link to={`/office/users/${c.id}`}>{c.name}</Link><span className="muted">{c.disciplines?.join('/')}</span></div>
                            <div className="row between"><span className="dist">{dist !== null ? `${dist} mi` : '—'}</span><span className="small muted">Priority {r.groupNo}</span></div>
                            <div className="sub">{r.response ? `Responded ${fmtRelative(r.respondedAt!)}` : r.readAt ? `Read ${fmtRelative(r.readAt)}` : r.sentAt ? `Sent ${fmtRelative(r.sentAt)}` : 'Not sent yet'}</div>
                            {r.comment && <div className="sub">“{r.comment}”</div>}
                            <div className="row wrap" style={{ gap: 4 }}>
                              <ReadinessPill readiness={rd} />
                              {r.outsideCoverage && <Pill tone="outline" sm>Outside coverage</Pill>}
                              {r.overrideId && <Pill tone="periwinkle" sm>Override</Pill>}
                              {isAssigned && <Pill tone="green" sm>Assigned</Pill>}
                            </div>
                            {req.status === 'pending' && r.response === 'available' && (
                              <Button size="sm" variant="primary" onClick={() => { setPick(r.clinicianId); setModal('assign'); }}>Assign</Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>

        <div className="stack">
          {visit && (
            <Card title="Visit & EMR plot status" actions={<LinkButton to="/office/scheduling/schedule" size="sm">Open schedule</LinkButton>}>
              <DefGrid items={[
                ['Assigned clinician', <Link to={`/office/users/${visit.clinicianId}`}>{L.userName(visit.clinicianId)}</Link>],
                ['Planned date', visit.plannedDate ?? 'Not set'],
                ['Plot status', <PlotPill status={visit.plotStatus} />],
                ['Clinician confirmation', visit.visitCompletedAt ? `Visit ✓ ${visit.noteCompletedAt ? '· Note ✓' : '· Note pending'}` : 'Pending'],
                ['Billing', visit.billingSubmissionId ? <Link to="/office/billing">Submitted</Link> : 'Not submitted'],
              ]} />
            </Card>
          )}
          <Card title="Request log">
            <Timeline items={req.log.map((l) => ({ at: l.at, who: L.userName(l.actorId), text: l.text }))} />
          </Card>
        </div>
      </div>

      {(modal === 'cancel' || modal === 'unstaffed') && (
        <Modal title={modal === 'cancel' ? 'Cancel request' : 'Close as unstaffed'} onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Back</Button><Button variant="danger" solid onClick={() => { actions.closeRequest(req.id, modal === 'cancel' ? 'cancelled' : 'unstaffed', reason.trim() || undefined); setModal(null); setReason(''); toast('Request closed'); }}>{modal === 'cancel' ? 'Cancel request' : 'Close unstaffed'}</Button></>}>
          <p className="muted">The request leaves the pending list. Clinicians who were sent it will see it as closed. You can reopen it later.</p>
          <Field label="Note (optional)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={modal === 'cancel' ? 'e.g. Agency cancelled the referral' : 'e.g. No PT covers this ZIP; agency notified'} /></Field>
        </Modal>
      )}
      {(modal === 'assign' || modal === 'reassign') && (
        <Modal title={modal === 'assign' ? 'Assign clinician' : 'Reassign clinician'} onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Back</Button><Button variant="primary" onClick={doAssign} disabled={!pick && availableClinicians.length === 0}>{modal === 'assign' ? 'Assign' : 'Reassign'}</Button></>}>
          {modal === 'assign' && availableClinicians.length > 0 && <Callout tone="success">{availableClinicians.length} clinician(s) responded Available. In first-come-first-served mode the first eligible acceptance is assigned automatically; office selection is available when needed.</Callout>}
          {modal === 'assign' && availableClinicians.length === 0 && <Callout tone="warn">Nobody has responded Available yet. Assigning a clinician who has not responded is an exception and is recorded with your reason.</Callout>}
          {modal === 'reassign' && <Callout tone="info">The current assignment to <b>{L.userName(req.assignedClinicianId)}</b> is closed, the patient chat membership is swapped, and history is kept.</Callout>}
          <Field label="Clinician" required>
            <Select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a clinician…</option>
              {availableClinicians.length > 0 && <optgroup label="Responded Available">{availableClinicians.map((r) => <option key={r.clinicianId} value={r.clinicianId}>{L.userName(r.clinicianId)}</option>)}</optgroup>}
              <optgroup label={`Other ${req.discipline} clinicians (exception)`}>{otherClinicians.filter((c) => !availableClinicians.some((r) => r.clinicianId === c.id)).map((c) => { const rd = readinessFor(state, c).readiness; return <option key={c.id} value={c.id}>{c.name}{rd === 'blocked' ? ' - credential blocked' : ''}{c.acceptingWork === false ? ' - not accepting work' : ''}</option>; })}</optgroup>
            </Select>
          </Field>
          {pick && (() => { const c = L.user(pick)!; const rd = readinessFor(state, c); return rd.readiness === 'blocked' ? <Callout tone="danger">{c.name} is credential-blocked: {rd.blockingLabels.join(', ')}. {me?.role === 'admin' ? 'As Admin you may record an authorized exception with a reason.' : 'Only an Admin can record an override exception.'}</Callout> : null; })()}
          <Field label="Reason (required for exceptions)" help="Recorded in the request log and activity history."><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Agency requested this clinician; office selection" disabled={!!pick && me?.role !== 'admin' && readinessFor(state, L.user(pick)!).readiness === 'blocked'} /></Field>
        </Modal>
      )}
      {modal === 'edit' && (
        <Modal title="Edit request" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Cancel</Button><Button variant="primary" onClick={() => { actions.updateRequest(req.id, { notesToClinicians: notes, officeNotes, visitBy: new Date(visitBy).toISOString() }); setModal(null); toast('Request updated', 'success'); }}>Save</Button></>}>
          <Field label="Visit patient by" required><Input type="datetime-local" value={visitBy} onChange={(e) => setVisitBy(e.target.value)} /></Field>
          <Field label="Notes to clinicians"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Field label="Office notes (internal)"><Textarea value={officeNotes} onChange={(e) => setOfficeNotes(e.target.value)} /></Field>
        </Modal>
      )}
      <span style={{ display: 'none' }}><I.info /></span>
    </>
  );
}
