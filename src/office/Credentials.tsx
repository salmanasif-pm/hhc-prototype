import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, Check, Empty, Field, FilePick, I, Input, Modal, PageHead, Pill, SearchBox, Select, Stat, Tabs, Tag, Textarea, Timeline, Toggle, useToast } from '../ui';
import { CredStatusPill, LineStatePill, ReadinessPill } from '../shared/pills';
import { credentialLines, dueReminders, readinessFor, activeOverride, type Readiness } from '../domain/rules';
import { CREDENTIAL_TYPE_LABEL, DISCIPLINES } from '../domain/labels';
import { dateFromNow, fmtDate, fmtDateTime } from '../domain/format';
import type { CredentialType, User } from '../domain/types';

export function CredentialsPage() {
  const { id } = useParams();
  const { state, actions, me } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'status' | 'reviews' | 'reminders' | 'onboarding' | 'requirements'>('status');
  const [q, setQ] = useState('');
  const [disc, setDisc] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState<'' | Readiness>('');
  const clinicians = state.users.filter((u) => u.role === 'clinician' && u.status !== 'inactive');
  const selected = id ? state.users.find((u) => u.id === id) : undefined;

  const rows = useMemo(() => clinicians.map((c) => ({ c, ...readinessFor(state, c) }))
    .filter((r) => !q || r.c.name.toLowerCase().includes(q.toLowerCase()))
    .filter((r) => !disc || r.c.disciplines?.includes(disc as never))
    .filter((r) => !type || r.lines.some((l) => l.requirement.type === type && l.state !== 'ok'))
    .filter((r) => !status || r.readiness === status)
    .sort((a, b) => ['blocked', 'override', 'under_review', 'expiring', 'ready'].indexOf(a.readiness) - ['blocked', 'override', 'under_review', 'expiring', 'ready'].indexOf(b.readiness)), [state, clinicians, q, disc, type, status]);
  const pendingReviews = state.credentials.filter((c) => c.status === 'under_review' && clinicians.some((u) => u.id === c.clinicianId));
  const reminders = dueReminders(state);
  const onboarding = clinicians.filter((c) => c.onboarding?.some((o) => o.required && !o.done));

  if (selected) return <CredentialClinicianPage clinician={selected} />;

  return (
    <>
      <PageHead title="Onboarding & Credentials" lede="Credential readiness feeds clinician selection directly: an expired required document blocks new requests until it is renewed and approved, or an Admin records an override." />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'status', label: 'Credential status', count: clinicians.length }, { key: 'reviews', label: 'Awaiting review', count: pendingReviews.length }, { key: 'reminders', label: 'Renewal reminders', count: reminders.length }, { key: 'onboarding', label: 'Onboarding', count: onboarding.length }, { key: 'requirements', label: 'Requirements' }]} />
      {tab === 'status' && (
        <div className="stack">
          <div className="grid-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
            {(['ready', 'expiring', 'under_review', 'blocked', 'override'] as Readiness[]).map((r) => <button key={r} className="stat" style={{ cursor: 'pointer', textAlign: 'left', borderColor: status === r ? 'var(--accent)' : undefined }} onClick={() => setStatus(status === r ? '' : r)}><span className="label">{r === 'under_review' ? 'Under review' : r[0]!.toUpperCase() + r.slice(1)}</span><span className={`value ${r === 'blocked' ? 'danger' : r === 'expiring' ? 'warn' : r === 'ready' ? 'ok' : ''}`}>{clinicians.map((c) => readinessFor(state, c).readiness).filter((x) => x === r).length}</span></button>)}
          </div>
          <div className="filters">
            <SearchBox value={q} onChange={setQ} placeholder="Search clinician" />
            <Select value={disc} onChange={(e) => setDisc(e.target.value)} aria-label="Discipline"><option value="">All disciplines</option>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</Select>
            <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Credential type"><option value="">Any credential with an issue</option>{state.credentialRequirements.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}</Select>
            <span className="small muted">{rows.length} clinician(s) · counts match the filtered list</span>
          </div>
          <Card pad={false}>
            <div className="table-wrap"><table className="table"><thead><tr><th>Clinician</th><th>Discipline</th><th>Readiness</th><th>Items needing attention</th><th>Next expiry</th><th /></tr></thead><tbody>
              {rows.map(({ c, readiness, lines }) => { const issues = lines.filter((l) => l.state !== 'ok'); const next = lines.filter((l) => l.daysLeft !== null && l.daysLeft >= 0).sort((a, b) => a.daysLeft! - b.daysLeft!)[0]; return (
                <tr key={c.id} className="click" onClick={() => nav(`/office/credentials/${c.id}`)}>
                  <td><div className="row"><span className="avatar sm green">{c.name.split(' ').map((x) => x[0]).join('')}</span><div><div className="cell-main">{c.name}</div><div className="cell-sub">{c.status === 'invited' ? 'Onboarding' : c.homeCity}</div></div></div></td>
                  <td>{c.disciplines?.map((d) => <Tag key={d} kind="discipline">{d}</Tag>)}</td>
                  <td><ReadinessPill readiness={readiness} /></td>
                  <td>{issues.length ? <div className="row wrap" style={{ gap: 4 }}>{issues.slice(0, 3).map((l) => <Pill key={l.requirement.type} tone={l.state === 'expired' || l.state === 'missing' ? 'red' : l.state === 'expiring' ? 'amber' : 'periwinkle'} sm>{l.requirement.label}: {l.state.replace('_', ' ')}</Pill>)}{issues.length > 3 && <Pill tone="gray" sm>+{issues.length - 3}</Pill>}</div> : <span className="muted small">All current</span>}</td>
                  <td>{next ? `${next.requirement.label} · ${fmtDate(next.credential?.expiresOn)}` : '—'}</td>
                  <td className="right"><Button size="sm">Open</Button></td>
                </tr>
              ); })}
              {rows.length === 0 && <tr><td colSpan={6}><Empty title="No clinicians match" icon="badge" /></td></tr>}
            </tbody></table></div>
          </Card>
        </div>
      )}
      {tab === 'reviews' && (
        <Card pad={false} title="Documents awaiting review">
          {pendingReviews.length === 0 ? <Empty title="Nothing to review" hint="New uploads from clinicians appear here." icon="badge" /> : (
            <div className="table-wrap"><table className="table"><thead><tr><th>Clinician</th><th>Credential</th><th>Document</th><th>Expires</th><th>Uploaded</th><th /></tr></thead><tbody>
              {pendingReviews.map((c) => <tr key={c.id}><td>{state.users.find((u) => u.id === c.clinicianId)?.name}</td><td>{CREDENTIAL_TYPE_LABEL[c.type]}</td><td><span className="row"><I.file size={14} /> {c.fileName}</span></td><td>{fmtDate(c.expiresOn)}</td><td>{fmtDateTime(c.uploadedAt)}</td><td className="right"><Link to={`/office/credentials/${c.clinicianId}`} className="btn sm primary">Review</Link></td></tr>)}
            </tbody></table></div>
          )}
        </Card>
      )}
      {tab === 'reminders' && (
        <Card pad={false} title={<h2>Renewal reminders <span className="muted small" style={{ fontWeight: 500 }}>· milestones 30 / 14 / 7 / 0 days, sent by email and in-app (simulated)</span></h2>}>
          {reminders.length === 0 ? <Empty title="No renewals due" icon="bell" /> : (
            <div className="table-wrap"><table className="table"><thead><tr><th>Clinician</th><th>Credential</th><th>Status</th><th>Expires</th><th>Milestone</th><th /></tr></thead><tbody>
              {reminders.map((r) => <tr key={r.clinician.id + r.line.requirement.type} className={r.line.state === 'expired' ? 'hl' : ''}><td><Link to={`/office/credentials/${r.clinician.id}`}>{r.clinician.name}</Link></td><td>{r.line.requirement.label}</td><td><LineStatePill line={r.line} /></td><td>{fmtDate(r.line.credential?.expiresOn)}</td><td>{r.line.daysLeft! < 0 ? 'Expired - blocking' : `${r.milestone}-day reminder`}</td><td className="right"><Button size="sm" icon="send" onClick={() => { actions.sendReminder(r.clinician.id, r.line.requirement.type, r.line.daysLeft); toast(`Reminder sent to ${r.clinician.name}`, 'success'); }}>Send reminder now</Button></td></tr>)}
            </tbody></table></div>
          )}
        </Card>
      )}
      {tab === 'onboarding' && (
        <div className="grid-2">
          {clinicians.filter((c) => c.onboarding).map((c) => { const done = c.onboarding!.filter((o) => o.done).length; const open = c.onboarding!.filter((o) => o.required && !o.done); return (
            <Card key={c.id} title={<h2 className="row"><span className="avatar sm green">{c.name.split(' ').map((x) => x[0]).join('')}</span>{c.name} <span className="muted small" style={{ fontWeight: 500 }}>· {c.disciplines?.join('/')} · started {fmtDate(c.startedOn)}</span></h2>} actions={<Pill tone={open.length ? 'amber' : 'green'}>{done}/{c.onboarding!.length} complete</Pill>}>
              {open.length === 0 ? <span className="muted small">All required items complete.</span> : <div className="stack" style={{ gap: 6 }}>{open.map((o) => <Check key={o.key} label={o.label} checked={false} onChange={() => actions.toggleOnboardingItem(c.id, o.key)} />)}</div>}
              <div className="row" style={{ marginTop: 10 }}><Link to={`/office/users/${c.id}`} className="btn sm">Profile</Link><Link to={`/office/credentials/${c.id}`} className="btn sm">Credentials</Link>{c.status === 'invited' && <Button size="sm" onClick={() => toast(`Invitation re-sent to ${c.email} (simulated)`, 'success')}>Re-send invite</Button>}</div>
            </Card>
          ); })}
        </div>
      )}
      {tab === 'requirements' && (
        <Card title="Credential requirements" actions={<span className="small muted">Admin / Manager can change these. Readiness is recalculated without losing document history.</span>} pad={false}>
          <div className="table-wrap"><table className="table"><thead><tr><th>Credential type</th><th>Applies to</th><th>Blocks new work when missing / expired</th><th>Reminder milestones (days before expiry)</th></tr></thead><tbody>
            {state.credentialRequirements.map((r) => <tr key={r.type}><td className="cell-main">{r.label}</td><td>{r.appliesTo === 'all' ? 'All clinicians' : r.appliesTo.join(', ')}</td><td><Toggle label={r.blocksNewWork ? 'Blocks' : 'Warning only'} checked={r.blocksNewWork} disabled={me?.role !== 'admin'} onChange={(v) => { actions.updateRequirement(r.type, { blocksNewWork: v }); toast('Requirement updated - readiness recalculated', 'success'); }} /></td><td>{r.reminderDays.join(' / ')}</td></tr>)}
          </tbody></table></div>
        </Card>
      )}
    </>
  );
}

export function CredentialClinicianPage({ clinician }: { clinician: User }) {
  return (
    <>
      <PageHead crumbs={[{ to: '/office/credentials', label: 'Onboarding & Credentials' }, { label: clinician.name }]} title={<span className="row wrap"><span className="avatar lg green">{clinician.name.split(' ').map((x) => x[0]).join('')}</span>{clinician.name}</span>} lede={`${clinician.disciplines?.join(', ')} · ${clinician.homeCity} · ${clinician.email}`} actions={<Link to={`/office/users/${clinician.id}`} className="btn">Open profile</Link>} />
      <CredentialReviewPanel clinician={clinician} />
    </>
  );
}

export function CredentialReviewPanel({ clinician }: { clinician: User }) {
  const { state, actions, me } = useStore();
  const L = useLookups();
  const toast = useToast();
  const rd = readinessFor(state, clinician);
  const lines = credentialLines(state, clinician);
  const ov = activeOverride(state, clinician.id);
  const [review, setReview] = useState<{ credId: string; decision: 'approve' | 'return' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [ovModal, setOvModal] = useState(false);
  const [ovReason, setOvReason] = useState('');
  const [ovUntil, setOvUntil] = useState(dateFromNow(30));
  const [upload, setUpload] = useState<CredentialType | null>(null);
  const [file, setFile] = useState<string | undefined>();
  const [exp, setExp] = useState(dateFromNow(365));
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const isAdmin = me?.role === 'admin';

  return (
    <div className="stack">
      {rd.readiness === 'blocked' && <Callout tone="danger"><b>Blocked from new requests:</b> {rd.blockingLabels.join(', ')}. In-flight assigned patients are not cancelled. {isAdmin ? 'You can record an authorized override below.' : 'An Admin can record an authorized override.'}</Callout>}
      {rd.readiness === 'override' && ov && <Callout tone="warn"><b>Override active</b> until {fmtDate(ov.expiresOn)} - recorded by {L.userName(ov.by)} on {fmtDateTime(ov.at)}: “{ov.reason}”. Underlying issue: {rd.blockingLabels.join(', ')}. {isAdmin && <Button size="sm" variant="ghost" onClick={() => { actions.removeOverride(ov.id); toast('Override removed'); }}>Remove override</Button>}</Callout>}
      {rd.readiness === 'expiring' && <Callout tone="warn">A required credential expires within 30 days. Reminders go to the clinician automatically; you can also send one now.</Callout>}
      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
        <Card pad={false} title={<h2 className="row">Required credentials <ReadinessPill readiness={rd.readiness} /></h2>} actions={rd.readiness === 'blocked' && isAdmin ? <Button size="sm" onClick={() => setOvModal(true)}>Record override</Button> : undefined}>
          <div className="table-wrap"><table className="table"><thead><tr><th>Credential</th><th>Status</th><th>Document</th><th>Expires</th><th>Review</th><th /></tr></thead><tbody>
            {lines.map((l) => { const c = l.credential; const pendingDoc = state.credentials.find((x) => x.clinicianId === clinician.id && x.type === l.requirement.type && x.status === 'under_review'); return (
              <tr key={l.requirement.type} className={l.state === 'expired' || l.state === 'missing' ? 'hl' : ''}>
                <td><div className="cell-main">{l.requirement.label}</div><div className="cell-sub">{l.requirement.blocksNewWork ? 'Blocks new work' : 'Warning only'}</div></td>
                <td><LineStatePill line={l} />{pendingDoc && l.state !== 'under_review' && <div style={{ marginTop: 4 }}><Pill tone="periwinkle" sm>Renewal under review</Pill></div>}</td>
                <td>{c?.fileName ? <button className="btn sm ghost" onClick={() => toast('Document preview simulated - files are not stored in this prototype')}><I.file size={14} /> {c.fileName}</button> : <span className="muted small">No document</span>}</td>
                <td>{c?.expiresOn ? fmtDate(c.expiresOn) : '—'}{pendingDoc && l.state !== 'under_review' && <div className="cell-sub">renewal → {fmtDate(pendingDoc.expiresOn)}</div>}</td>
                <td>{c?.status ? <CredStatusPill status={c.status} /> : '—'}{c?.reviewNote && <div className="cell-sub">{c.reviewNote}</div>}</td>
                <td className="right"><div className="row" style={{ justifyContent: 'flex-end' }}>
                  {(pendingDoc ?? (c?.status === 'under_review' ? c : undefined)) && <><Button size="sm" variant="success" onClick={() => { setReview({ credId: (pendingDoc ?? c)!.id, decision: 'approve' }); setNote(''); }}>Approve</Button><Button size="sm" onClick={() => { setReview({ credId: (pendingDoc ?? c)!.id, decision: 'return' }); setNote(''); }}>Return</Button></>}
                  {(l.state === 'expired' || l.state === 'expiring') && <Button size="sm" icon="bell" onClick={() => { actions.sendReminder(clinician.id, l.requirement.type, l.daysLeft); toast('Reminder sent', 'success'); }}>Remind</Button>}
                  <Button size="sm" icon="upload" onClick={() => { setUpload(l.requirement.type); setFile(undefined); }}>Add document</Button>
                  {c && c.history.length > 0 && <Button size="sm" variant="ghost" onClick={() => setHistoryFor(c.id)}>History</Button>}
                </div></td>
              </tr>
            ); })}
          </tbody></table></div>
        </Card>
        <div className="stack">
          <Card title="Eligibility rule">
            <p className="small">A clinician can receive new requests only when every credential marked <b>blocks new work</b> is approved and unexpired. Expiring items warn. A returned or rejected document keeps the previous approved document in force until it expires.</p>
            <div className="divider" style={{ margin: '10px 0' }} />
            <div className="small muted">Overrides on record: {state.overrides.filter((o) => o.clinicianId === clinician.id).length}. Downloads and reviews are recorded in the activity history.</div>
          </Card>
          <Card title="Onboarding checklist">
            {clinician.onboarding ? <div className="stack" style={{ gap: 6 }}>{clinician.onboarding.map((o) => <Check key={o.key} label={<span className={o.done ? 'muted' : ''}>{o.label}</span>} checked={o.done} onChange={() => actions.toggleOnboardingItem(clinician.id, o.key)} />)}</div> : <span className="muted">—</span>}
          </Card>
        </div>
      </div>

      {review && (() => { const cred = state.credentials.find((c) => c.id === review.credId)!; return (
        <Modal title={`${review.decision === 'approve' ? 'Approve' : review.decision === 'return' ? 'Return' : 'Reject'} - ${CREDENTIAL_TYPE_LABEL[cred.type]}`} onClose={() => setReview(null)} footer={<><Button onClick={() => setReview(null)}>Cancel</Button>{review.decision !== 'approve' && <Button variant="danger" onClick={() => { actions.reviewCredential(cred.id, 'reject', note.trim() || 'Document not acceptable'); setReview(null); toast('Credential rejected'); }}>Reject instead</Button>}<Button variant={review.decision === 'approve' ? 'success' : 'primary'} disabled={review.decision !== 'approve' && !note.trim()} onClick={() => { actions.reviewCredential(cred.id, review.decision, note.trim() || undefined); setReview(null); toast(review.decision === 'approve' ? 'Approved - eligibility recalculated' : 'Returned to clinician with reason', 'success'); }}>{review.decision === 'approve' ? 'Approve' : 'Return with reason'}</Button></>}>
          <div className="panel"><div className="row between"><span className="row"><I.file size={16} /> <b>{cred.fileName}</b></span><span className="small muted">uploaded {fmtDateTime(cred.uploadedAt)}</span></div><div className="small" style={{ marginTop: 6 }}>Expires {fmtDate(cred.expiresOn)}{cred.issuedOn ? ` · issued ${fmtDate(cred.issuedOn)}` : ''}</div><div className="small muted" style={{ marginTop: 4 }}>Document preview is simulated in this prototype.</div></div>
          {review.decision === 'approve' ? <Callout tone="success">Approving supersedes the previous approved document of this type and recalculates eligibility immediately. The clinician is notified.</Callout> : <Field label="Reason for the clinician" required><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Expiration date is cut off - please re-scan the full card" /></Field>}
        </Modal>
      ); })()}
      {ovModal && (
        <Modal title={`Record override - ${clinician.name}`} onClose={() => setOvModal(false)} footer={<><Button onClick={() => setOvModal(false)}>Cancel</Button><Button variant="primary" disabled={!ovReason.trim()} onClick={() => { actions.addOverride(clinician.id, ovReason.trim(), ovUntil); setOvModal(false); setOvReason(''); toast('Override recorded - clinician can receive new requests until it expires', 'success'); }}>Record override</Button></>}>
          <Callout tone="danger">Blocked: {rd.blockingLabels.join(', ')}. The override is recorded with your name, reason, time and expiry, and appears on every request it is used for.</Callout>
          <Field label="Reason" required><Textarea value={ovReason} onChange={(e) => setOvReason(e.target.value)} /></Field>
          <Field label="Override expires on" required><Input type="date" value={ovUntil} onChange={(e) => setOvUntil(e.target.value)} /></Field>
        </Modal>
      )}
      {upload && (
        <Modal title={`Add document - ${CREDENTIAL_TYPE_LABEL[upload]}`} onClose={() => setUpload(null)} footer={<><Button onClick={() => setUpload(null)}>Cancel</Button><Button variant="primary" disabled={!file} onClick={() => { const cid = actions.uploadCredential(clinician.id, upload, { fileName: file!, expiresOn: exp }); actions.reviewCredential(cid, 'approve', 'Uploaded and verified by office'); setUpload(null); toast('Document added and approved', 'success'); }}>Add and approve</Button></>}>
          <Callout tone="neutral">Office users can add or replace a document on the clinician's behalf (e.g. received by email). Replacing keeps the previous document in history.</Callout>
          <FilePick value={file} onChange={setFile} />
          <Field label="Expiration date" required><Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
        </Modal>
      )}
      {historyFor && (() => { const c = state.credentials.find((x) => x.id === historyFor)!; return <Modal title={`History - ${CREDENTIAL_TYPE_LABEL[c.type]}`} onClose={() => setHistoryFor(null)}><Timeline items={c.history.map((h) => ({ at: h.at, who: L.userName(h.actorId), text: h.text }))} /></Modal>; })()}
      <span style={{ display: 'none' }}><Stat label="" value="" /></span>
    </div>
  );
}
