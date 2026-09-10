import { Link } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Callout, Card, Empty, I, LinkButton, Pill, Stat, Tag } from '../ui';
import { PayoutPill, PlotPill, SubmissionPill } from '../shared/pills';
import { readinessFor, visitReadyToSubmit } from '../domain/rules';
import { fmtCountdown, fmtRelative, fmtShortDate, money, todayIso } from '../domain/format';
import { unreadCount } from '../shared/ChatPanel';

export function ClinicianHome() {
  const { state, me } = useStore();
  const L = useLookups();
  if (!me) return null;
  const pending = state.requests.filter((r) => r.status === 'pending' && r.recipients.some((x) => x.clinicianId === me.id && x.sentAt && !x.response));
  const assigned = state.requests.filter((r) => r.status === 'assigned' && r.assignedClinicianId === me.id);
  const visits = state.visits.filter((v) => v.clinicianId === me.id && L.request(v.requestId)?.status === 'assigned' && !v.billingSubmissionId).sort((a, b) => (a.plannedDate ?? '9999').localeCompare(b.plannedDate ?? '9999'));
  const unread = state.conversations.filter((c) => c.memberIds.includes(me.id)).reduce((n, c) => n + unreadCount(c, me.id), 0);
  const rd = readinessFor(state, me);
  const expiringLines = rd.lines.filter((l) => l.state !== 'ok');
  const subs = state.submissions.filter((s) => s.clinicianId === me.id);
  const returned = subs.filter((s) => s.status === 'returned');
  const month = todayIso().slice(0, 7);
  const monthPay = subs.filter((s) => s.status === 'approved' && s.visitDate.startsWith(month)).reduce((a, s) => a + s.clinicianRate, 0);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <>
      <div className="page-head"><div className="titles"><div className="crumbs">{today}</div><h1>Hi, {me.name.split(' ')[0]}</h1><p className="lede">Your current work. Everything here is limited to requests sent to you and patients assigned to you.</p></div></div>
      {rd.readiness === 'blocked' && <div style={{ marginBottom: 14 }}><Callout tone="danger"><b>New requests are blocked.</b> {rd.blockingLabels.join(', ')}. Upload the renewal in <Link to="/clinician/credentials">Credentials</Link> so the office can approve it.</Callout></div>}
      {rd.readiness === 'expiring' && <div style={{ marginBottom: 14 }}><Callout tone="warn">{expiringLines.map((l) => `${l.requirement.label} expires in ${l.daysLeft} days`).join(' · ')}. <Link to="/clinician/credentials">Renew now</Link> to stay eligible.</Callout></div>}
      {returned.length > 0 && <div style={{ marginBottom: 14 }}><Callout tone="warn">{returned.length} billing submission(s) returned for correction. <Link to="/clinician/billing">Open Billing</Link>.</Callout></div>}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat label="Pending requests" value={pending.length} to="/clinician/requests" tone={pending.length ? 'warn' : undefined} />
        <Stat label="Assigned patients" value={assigned.length} to="/clinician/patients" />
        <Stat label="Unread messages" value={unread} to="/clinician/chat" />
        <Stat label={`Approved pay · ${new Date().toLocaleDateString('en-US', { month: 'short' })}`} value={money(monthPay)} to="/clinician/billing" hint="Payout status in Billing" />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Requests waiting for your response" actions={<LinkButton to="/clinician/requests" size="sm">All requests</LinkButton>} pad={false}>
          {pending.length === 0 ? <Empty title="No pending requests" hint="New requests sent to you appear here and by email." icon="layers" /> : pending.map((r) => { const p = L.patient(r.patientId)!; return (
            <Link key={r.id} to={`/clinician/requests/${r.id}`} className="list-item click">
              <div className="main"><div className="title row wrap"><Tag kind="discipline">{r.discipline}</Tag><Tag kind="type">{L.visitType(r.visitTypeCode)?.short}</Tag>{p.address.city} {p.address.zip}</div><div className="sub">{L.agency(r.agencyId)?.name} · visit by {fmtShortDate(r.visitBy)} · {r.notesToClinicians}</div></div>
              <Pill tone="amber">{fmtCountdown(r.visitBy)}</Pill><I.chevronRight size={16} className="muted" />
            </Link>
          ); })}
        </Card>
        <Card title="Upcoming and open visits" actions={<LinkButton to="/clinician/schedule" size="sm">My schedule</LinkButton>} pad={false}>
          {visits.length === 0 ? <Empty title="No open visits" icon="calendar" /> : visits.slice(0, 5).map((v) => { const p = L.patient(v.patientId)!; return (
            <Link key={v.id} to={`/clinician/schedule/${v.id}`} className="list-item click">
              <div className="main"><div className="title">{p.firstName} {p.lastName} · {L.visitType(v.visitTypeCode)?.short}</div><div className="sub">{v.plannedDate ? fmtShortDate(v.plannedDate) : 'Date to be confirmed by office'} · {L.agency(v.agencyId)?.name}</div></div>
              {visitReadyToSubmit(v) ? <Pill tone="blue">Ready to bill</Pill> : v.visitCompletedAt ? <Pill tone="green">Visit done</Pill> : <PlotPill status={v.plotStatus} />}
            </Link>
          ); })}
        </Card>
        <Card title="Recent billing" actions={<LinkButton to="/clinician/billing" size="sm">All billing</LinkButton>} pad={false}>
          {subs.length === 0 ? <Empty title="No submissions yet" icon="dollar" /> : subs.slice(0, 4).map((s) => { const p = L.patient(s.patientId)!; return <div key={s.id} className="list-item"><div className="main"><div className="title">{p.firstName} {p.lastName} · {s.visitTypeCode} · {fmtShortDate(s.visitDate)}</div><div className="sub">{money(s.clinicianRate)} · submitted {fmtRelative(s.submittedAt)}</div></div><div className="row wrap" style={{ gap: 4 }}><SubmissionPill status={s.status} />{s.status === 'approved' && <PayoutPill status={s.payoutStatus} />}</div></div>; })}
        </Card>
        <Card title="Credential alerts" actions={<LinkButton to="/clinician/credentials" size="sm">Credentials</LinkButton>} pad={false}>
          {expiringLines.length === 0 ? <div className="empty"><Pill tone="green">All credentials current</Pill></div> : expiringLines.map((l) => <div key={l.requirement.type} className="list-item"><div className="main"><div className="title">{l.requirement.label}</div><div className="sub">{l.nextAction}</div></div><Pill tone={l.state === 'expired' || l.state === 'missing' ? 'red' : l.state === 'expiring' ? 'amber' : 'periwinkle'}>{l.state.replace('_', ' ')}</Pill></div>)}
        </Card>
      </div>
    </>
  );
}
