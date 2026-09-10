import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, Empty, Field, I, Modal, PageHead, Pill, Tabs, Tag, Textarea, useToast } from '../ui';
import { RequestPill } from '../shared/pills';
import { fmtCountdown, fmtDateTime, fmtRelative, hoursUntil } from '../domain/format';
import { distanceMiles, zipMapsUrl } from '../domain/geo';
import { readinessFor } from '../domain/rules';
import type { VisitRequest } from '../domain/types';

export function ClinicianRequests() {
  const { id } = useParams();
  const { state, actions, me } = useStore();
  const L = useLookups();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'open' | 'assigned' | 'closed'>('open');
  const [decline, setDecline] = useState<VisitRequest | null>(null);
  const [comment, setComment] = useState('');
  if (!me) return null;
  const mine = state.requests.filter((r) => r.recipients.some((x) => x.clinicianId === me.id && x.sentAt));
  const open = mine.filter((r) => r.status === 'pending');
  const assigned = mine.filter((r) => r.status === 'assigned' && r.assignedClinicianId === me.id).concat(state.requests.filter((r) => r.status === 'assigned' && r.assignedClinicianId === me.id && !mine.includes(r)));
  const closed = mine.filter((r) => r.status === 'closed' || (r.status === 'assigned' && r.assignedClinicianId !== me.id));
  const list = tab === 'open' ? open : tab === 'assigned' ? assigned : closed;
  const rd = readinessFor(state, me);

  // opening a request marks it read (office sees "Request read")
  useEffect(() => { if (id) { const r = state.requests.find((x) => x.id === id); if (r && r.status === 'pending') actions.markRequestRead(id, me.id); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const respond = (r: VisitRequest, value: 'available' | 'not_available', c?: string) => {
    const res = actions.respond(r.id, me.id, value, c);
    if (!res.ok) { toast(res.reason, 'error'); return; }
    if (value === 'available') toast(res.assigned ? 'You are assigned. The patient and chat are now available.' : 'Response recorded - the office will confirm the assignment.', 'success');
    else toast('Response recorded as Not Available');
    if (res.assigned) nav(`/clinician/patients/${r.patientId}`);
  };

  const Item = ({ r }: { r: VisitRequest }) => {
    const p = L.patient(r.patientId)!;
    const a = L.agency(r.agencyId)!;
    const rc = r.recipients.find((x) => x.clinicianId === me.id);
    const dist = me.homeZip ? distanceMiles(me.homeZip, p.address.zip) : null;
    const isMine = r.assignedClinicianId === me.id;
    const expired = hoursUntil(r.visitBy) <= 0;
    return (
      <Card className={id === r.id ? 'sel' : ''}>
        <div className="row between wrap" style={{ marginBottom: 8 }}>
          <span className="small" style={{ color: 'var(--green-dark)', fontWeight: 700, letterSpacing: '0.06em' }}>{r.assignMode === 'fcfs' ? '✓ FIRST TO RESPOND IS ASSIGNED' : 'OFFICE SELECTS FROM RESPONSES'}</span>
          <span className="small muted">Home Health Compass</span>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <h2 style={{ fontSize: 18 }}>{isMine ? `${p.firstName} ${p.lastName}` : `${r.discipline} ${L.visitType(r.visitTypeCode)?.label}`}</h2>
          <RequestPill req={r} />
        </div>
        <div className="row wrap" style={{ margin: '8px 0' }}><Tag kind="agency">{a.name}</Tag><Tag kind="insurance">{p.insurance}</Tag><Tag kind="emr">{a.emrDomain}</Tag><Tag kind="type">{L.visitType(r.visitTypeCode)?.short}</Tag><Tag kind="discipline">{r.discipline}</Tag></div>
        <div className="stack" style={{ gap: 6, fontSize: 13.5 }}>
          <div className="row"><I.pin size={15} className="muted" /><a href={zipMapsUrl(p.address.zip)} target="_blank" rel="noreferrer">{p.address.city}, CA {p.address.zip}</a>{!isMine && <span className="muted small">· full address after assignment</span>}</div>
          {isMine && <div className="row"><I.navigation size={15} className="muted" /><span>{p.address.street}, {p.address.city} {p.address.zip}</span></div>}
          <div className="row"><I.home size={15} className="muted" /><span>{dist !== null ? `${dist} mi from your home` : 'Distance unavailable'}</span></div>
          <div className="row"><I.clock size={15} className="muted" /><span>Visit by: <b>{fmtDateTime(r.visitBy)}</b>{r.status === 'pending' && <Pill tone={expired ? 'red' : hoursUntil(r.visitBy) < 24 ? 'amber' : 'gray'} sm>{expired ? 'passed' : fmtCountdown(r.visitBy)}</Pill>}</span></div>
          <div className="row" style={{ alignItems: 'flex-start' }}><span style={{ marginTop: 2, display: "inline-flex" }}><I.file size={15} className="muted" /></span><span>{r.notesToClinicians || 'No notes'}</span></div>
          {r.languages.length > 0 && <div className="row"><I.info size={15} className="muted" /><span>Language: {r.languages.join(', ')}</span></div>}
        </div>
        <div className="divider" style={{ margin: '12px 0' }} />
        {r.status === 'pending' && !rc?.response && (
          <>
            {rd.readiness === 'blocked' && !rc?.overrideId && <div style={{ marginBottom: 10 }}><Callout tone="danger">Your credentials block new work ({rd.blockingLabels.join(', ')}). You can respond, but assignment needs office review.</Callout></div>}
            <div className="row" style={{ gap: 10 }}>
              <Button variant="primary" size="lg" className="grow" onClick={() => respond(r, 'available')} disabled={expired}>Available</Button>
              <Button size="lg" className="grow" style={{ background: '#d9822b', color: '#fff', borderColor: 'transparent' }} onClick={() => { setDecline(r); setComment(''); }}>Not Available</Button>
            </div>
            <div className="small muted" style={{ marginTop: 8, textAlign: 'right' }}>Sent {fmtRelative(rc?.sentAt ?? r.createdAt)}</div>
          </>
        )}
        {rc?.response && r.status === 'pending' && <Callout tone={rc.response === 'available' ? 'success' : 'neutral'}>You responded <b>{rc.response === 'available' ? 'Available' : 'Not Available'}</b> {fmtRelative(rc.respondedAt!)}{rc.comment ? ` - "${rc.comment}"` : ''}. {rc.response === 'available' ? 'Waiting for the office to confirm the assignment.' : ''}</Callout>}
        {isMine && <div className="row wrap"><Pill tone="green">Assigned to you {fmtRelative(r.assignedAt!)}</Pill><Link to={`/clinician/patients/${p.id}`} className="btn sm primary">Open patient</Link>{L.patientConversation(p.id) && <Link to={`/clinician/chat/${L.patientConversation(p.id)!.id}`} className="btn sm">Patient chat</Link>}<Link to="/clinician/schedule" className="btn sm">Schedule</Link></div>}
        {r.status === 'assigned' && !isMine && <Callout tone="neutral">Another clinician accepted first. This request has left your open list.</Callout>}
        {r.status === 'closed' && <Callout tone="neutral">Closed by the office{r.closedReason ? ` - ${r.closedReason}` : ''}.</Callout>}
      </Card>
    );
  };

  return (
    <>
      <PageHead title="Requests" lede="Only requests sent to you. Respond Available or Not Available on your phone or laptop; in the default mode the first eligible acceptance is assigned." />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'open', label: 'Open', count: open.length }, { key: 'assigned', label: 'Assigned', count: assigned.length }, { key: 'closed', label: 'Closed', count: closed.length }]} />
      <div className="stack" style={{ maxWidth: 720 }}>
        {list.length === 0 ? <Card><Empty title={tab === 'open' ? 'No open requests' : 'Nothing here'} hint={tab === 'open' ? 'You will be notified in the app and by email when a request is sent to you.' : undefined} icon="layers" /></Card> : list.map((r) => <Item key={r.id} r={r} />)}
      </div>
      {decline && (
        <Modal title="Not available" onClose={() => setDecline(null)} footer={<><Button onClick={() => setDecline(null)}>Back</Button><Button variant="primary" onClick={() => { respond(decline, 'not_available', comment.trim() || undefined); setDecline(null); }}>Confirm Not Available</Button></>}>
          <p className="muted">Declining is fine - you are an independent contractor. An optional comment helps the office plan.</p>
          <Field label="Comment (optional)"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Fully booked this week" /></Field>
        </Modal>
      )}
    </>
  );
}
