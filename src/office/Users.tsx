import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, Check, Chips, DefGrid, Empty, Field, Input, Modal, PageHead, Pill, SearchBox, Select, Tabs, Tag, Timeline, Toggle, useToast } from '../ui';
import { ReadinessPill, UserStatusPill, LineStatePill, CredStatusPill } from '../shared/pills';
import { credentialLines, readinessFor } from '../domain/rules';
import { DISCIPLINES, LANGUAGES, ROLE_LABEL } from '../domain/labels';
import { fmtDate, fmtDateTime, money } from '../domain/format';
import type { Discipline, User, UserRole } from '../domain/types';
import { CredentialReviewPanel } from './Credentials';

export function UsersPage() {
  const { state, actions, me } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'clinicians' | 'office'>('clinicians');
  const [q, setQ] = useState('');
  const [disc, setDisc] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('');
  const [invite, setInvite] = useState(false);
  const [inv, setInv] = useState({ name: '', email: '', phone: '', role: 'clinician' as UserRole, title: '', disciplines: [] as string[], languages: ['English'], regionIds: [] as string[], homeZip: '', homeCity: '' });

  const rows = useMemo(() => state.users
    .filter((u) => (tab === 'clinicians' ? u.role === 'clinician' : u.role !== 'clinician'))
    .filter((u) => !q || `${u.name} ${u.email} ${u.phone ?? ''} ${u.disciplines?.join(' ') ?? ''} ${u.homeCity ?? ''} ${u.title ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .filter((u) => !disc || u.disciplines?.includes(disc as Discipline))
    .filter((u) => !region || u.regionIds?.includes(region))
    .filter((u) => !status || u.status === status)
    .sort((a, b) => a.name.localeCompare(b.name)), [state.users, tab, q, disc, region, status]);

  const sendInvite = () => {
    if (!inv.name.trim() || !/\S+@\S+\.\S+/.test(inv.email)) { toast('Name and a valid email are required', 'error'); return; }
    if (inv.role === 'clinician' && inv.disciplines.length === 0) { toast('Select at least one discipline', 'error'); return; }
    const id = actions.inviteUser({ name: inv.name.trim(), email: inv.email.trim(), phone: inv.phone, role: inv.role, title: inv.role === 'clinician' ? undefined : inv.title || (inv.role === 'admin' ? 'Manager' : 'Office Team'), disciplines: inv.disciplines as Discipline[], languages: inv.languages, regionIds: inv.regionIds, homeZip: inv.homeZip || undefined, homeCity: inv.homeCity || undefined });
    setInvite(false);
    toast(`Invitation sent to ${inv.email} (simulated email)`, 'success');
    nav(`/office/users/${id}`);
  };

  return (
    <>
      <PageHead title="Users" lede="HHC-contracted clinicians and office accounts in one directory. Permissions decide what each user can see and do." actions={<Button variant="primary" icon="plus" onClick={() => setInvite(true)} disabled={me?.role !== 'admin'} title={me?.role !== 'admin' ? 'Admin only' : ''}>Invite user</Button>} />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'clinicians', label: 'Clinicians', count: state.users.filter((u) => u.role === 'clinician').length }, { key: 'office', label: 'Office staff', count: state.users.filter((u) => u.role !== 'clinician').length }]} />
      <div className="filters">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, email, discipline or city" />
        {tab === 'clinicians' && <><Select value={disc} onChange={(e) => setDisc(e.target.value)} aria-label="Discipline"><option value="">All disciplines</option>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</Select>
          <Select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region"><option value="">All regions</option>{state.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></>}
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option><option value="active">Active</option><option value="invited">Invited</option><option value="inactive">Inactive</option></Select>
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty title="No users match" icon="users" /> : (
          <div className="table-wrap"><table className="table">
            <thead>{tab === 'clinicians' ? <tr><th>Clinician</th><th>Discipline</th><th>Contact</th><th>Regions</th><th>Accepting work</th><th>Credential readiness</th><th>Status</th></tr> : <tr><th>User</th><th>Title</th><th>Access level</th><th>Contact</th><th>Status</th></tr>}</thead>
            <tbody>{rows.map((u) => {
              const rd = u.role === 'clinician' ? readinessFor(state, u) : null;
              return (
                <tr key={u.id} className="click" onClick={() => nav(`/office/users/${u.id}`)} style={u.status === 'inactive' ? { opacity: 0.6 } : undefined}>
                  <td><div className="row"><span className={`avatar sm ${u.role === 'clinician' ? 'green' : 'navy'}`}>{u.name.split(' ').map((x) => x[0]).join('')}</span><div><div className="cell-main">{u.name}</div><div className="cell-sub">{u.role === 'clinician' ? u.homeCity : u.email}</div></div></div></td>
                  {u.role === 'clinician' ? <>
                    <td>{u.disciplines?.map((d) => <Tag key={d} kind="discipline">{d}</Tag>)}</td>
                    <td><div>{u.phone}</div><div className="cell-sub">{u.email}</div></td>
                    <td>{u.regionIds?.map((r) => state.regions.find((x) => x.id === r)?.name).join(', ') || <span className="muted">None</span>}</td>
                    <td>{u.acceptingWork === false ? <Pill tone="gray">Do not send</Pill> : <Pill tone="green">Accepting</Pill>}</td>
                    <td>{rd && <ReadinessPill readiness={rd.readiness} />}</td>
                  </> : <>
                    <td>{u.title}</td><td>{ROLE_LABEL[u.role]}</td><td>{u.phone}</td>
                  </>}
                  <td><UserStatusPill status={u.status} /></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>
      {invite && (
        <Modal title="Invite user" onClose={() => setInvite(false)} footer={<><Button onClick={() => setInvite(false)}>Cancel</Button><Button variant="primary" icon="send" onClick={sendInvite}>Send invitation</Button></>}>
          <Callout tone="neutral">The user receives an email link to set a password and accept the terms (simulated). Clinicians do not self-register; the office owns the directory.</Callout>
          <div className="form-grid">
            <Field label="Full name" required><Input value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} /></Field>
            <Field label="Email" required><Input type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={inv.phone} onChange={(e) => setInv({ ...inv, phone: e.target.value })} /></Field>
            <Field label="Access level" required><Select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as UserRole })}><option value="clinician">Clinician</option><option value="office">Office Team</option><option value="admin">Admin / Manager</option></Select></Field>
            {inv.role !== 'clinician' && <Field label="Title" className="span2"><Input value={inv.title} onChange={(e) => setInv({ ...inv, title: e.target.value })} placeholder="e.g. Intake Coordinator" /></Field>}
            {inv.role === 'clinician' && <>
              <Field label="Disciplines" required className="span2"><Chips options={DISCIPLINES} value={inv.disciplines} onChange={(v) => setInv({ ...inv, disciplines: v })} /></Field>
              <Field label="Languages" className="span2"><Chips options={LANGUAGES} value={inv.languages} onChange={(v) => setInv({ ...inv, languages: v })} /></Field>
              <Field label="Home city"><Input value={inv.homeCity} onChange={(e) => setInv({ ...inv, homeCity: e.target.value })} /></Field>
              <Field label="Home ZIP" help="Used for distance"><Input value={inv.homeZip} maxLength={5} onChange={(e) => setInv({ ...inv, homeZip: e.target.value })} /></Field>
              <Field label="Coverage regions" className="span2"><div className="chips">{state.regions.map((r) => <button key={r.id} type="button" className={`chip ${inv.regionIds.includes(r.id) ? 'on' : ''}`} onClick={() => setInv({ ...inv, regionIds: inv.regionIds.includes(r.id) ? inv.regionIds.filter((x) => x !== r.id) : [...inv.regionIds, r.id] })}>{r.name}</button>)}</div></Field>
            </>}
          </div>
        </Modal>
      )}
    </>
  );
}

export function UserDetailPage() {
  const { id } = useParams();
  const { state, actions, me } = useStore();
  const L = useLookups();
  const toast = useToast();
  const u = L.user(id);
  const [tab, setTab] = useState<'profile' | 'credentials' | 'onboarding' | 'rates' | 'activity'>('profile');
  const [edit, setEdit] = useState(false);
  const [ef, setEf] = useState<Partial<User>>({});
  if (!u) return <Callout tone="danger">User not found. <Link to="/office/users">Back to users</Link></Callout>;
  const isClin = u.role === 'clinician';
  const rd = isClin ? readinessFor(state, u) : null;
  const lines = isClin ? credentialLines(state, u) : [];
  const assignments = state.requests.filter((r) => r.assignedClinicianId === u.id);
  const activity = state.activity.filter((a) => a.actorId === u.id || a.entity.includes(u.name));
  const regions = state.regions.filter((r) => r.clinicianIds.includes(u.id));
  const isAdmin = me?.role === 'admin';

  return (
    <>
      <PageHead crumbs={[{ to: '/office/users', label: 'User' }, { label: u.name }]} title={<span className="row wrap"><span className={`avatar lg ${isClin ? 'green' : 'navy'}`}>{u.name.split(' ').map((x) => x[0]).join('')}</span>{u.name}<UserStatusPill status={u.status} />{rd && <ReadinessPill readiness={rd.readiness} />}</span>}
        lede={isClin ? `${u.disciplines?.map((d) => d).join(', ')} · ${u.homeCity} · ${u.languages?.join(', ')}` : `${u.title} · ${ROLE_LABEL[u.role]}`}
        actions={<>
          <Button icon="edit" onClick={() => { setEf({ phone: u.phone, email: u.email, languages: u.languages, disciplines: u.disciplines, regionIds: u.regionIds, homeCity: u.homeCity, homeZip: u.homeZip, acceptingWork: u.acceptingWork, title: u.title, role: u.role, includeInPatientChats: u.includeInPatientChats }); setEdit(true); }}>Edit</Button>
          {u.status !== 'inactive' ? <Button variant="danger" disabled={!isAdmin || u.id === me?.id} onClick={() => { actions.setUserStatus(u.id, 'inactive'); toast(`${u.name} deactivated - removed from matching`); }}>Deactivate</Button> : <Button onClick={() => { actions.setUserStatus(u.id, 'active'); toast(`${u.name} reactivated`, 'success'); }}>Reactivate</Button>}
          {u.status === 'invited' && <Button variant="primary" onClick={() => { actions.setUserStatus(u.id, 'active'); toast('Marked active (invitation accepted - simulated)', 'success'); }}>Mark invitation accepted</Button>}
        </>} />
      {rd?.readiness === 'blocked' && <div style={{ marginBottom: 14 }}><Callout tone="danger"><b>Blocked from new requests:</b> {rd.blockingLabels.join(', ')}. Existing assignments are not cancelled automatically. An Admin can record an override from the Credentials tab.</Callout></div>}
      <Tabs value={tab} onChange={setTab} items={[{ key: 'profile', label: 'Profile' }, ...(isClin ? [{ key: 'credentials' as const, label: 'Credentials', count: lines.filter((l) => l.state !== 'ok').length }, { key: 'onboarding' as const, label: 'Onboarding', count: u.onboarding?.filter((o) => !o.done && o.required).length }, { key: 'rates' as const, label: 'Rate card' }] : []), { key: 'activity', label: 'Activity' }]} />
      {tab === 'profile' && (
        <div className="grid-3" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
          <Card title="User details">
            <DefGrid items={isClin ? [['Email', u.email], ['Phone', u.phone], ['Disciplines', u.disciplines?.join(', ')], ['Languages', u.languages?.join(', ')], ['Home', `${u.homeCity} ${u.homeZip}`], ['Accepting work', u.acceptingWork === false ? 'No - do not send' : 'Yes'], ['Started', fmtDate(u.startedOn)], ['Access level', ROLE_LABEL[u.role]]] : [['Email', u.email], ['Phone', u.phone], ['Title', u.title], ['Access level', ROLE_LABEL[u.role]], ['Included in new patient chats', u.includeInPatientChats ? 'Yes' : 'No']]} />
          </Card>
          <div className="stack">
            {isClin && <Card title="Coverage regions" actions={<Link to="/office/regions" className="btn sm">Manage regions</Link>}>{regions.length ? regions.map((r) => <div key={r.id} className="row between" style={{ padding: '6px 0' }}><span><b>{r.name}</b> <span className="muted small">· {r.mode === 'zip' ? `${r.zips.length} ZIPs` : 'polygon'}</span></span><span className="small muted">{r.zips.slice(0, 4).join(', ')}{r.zips.length > 4 ? '…' : ''}</span></div>) : <span className="muted">No regions assigned - this clinician will not match any request.</span>}</Card>}
            {isClin && <Card title="Assignments"><DefGrid items={[['Active', assignments.filter((r) => r.status === 'assigned').length], ['Total', assignments.length], ['Responded available', state.requests.flatMap((r) => r.recipients).filter((r) => r.clinicianId === u.id && r.response === 'available').length], ['Declined', state.requests.flatMap((r) => r.recipients).filter((r) => r.clinicianId === u.id && r.response === 'not_available').length]]} /></Card>}
          </div>
        </div>
      )}
      {tab === 'credentials' && isClin && <CredentialReviewPanel clinician={u} />}
      {tab === 'onboarding' && isClin && (
        <Card title={<h2>Onboarding checklist <span className="muted small" style={{ fontWeight: 500 }}>· {u.onboarding?.filter((o) => o.done).length}/{u.onboarding?.length} complete</span></h2>}>
          <div className="stack" style={{ gap: 8 }}>
            {u.onboarding?.map((o) => <Check key={o.key} label={<span>{o.label} {o.required ? <Pill tone="outline" sm>required</Pill> : <Pill tone="gray" sm>optional</Pill>}</span>} checked={o.done} onChange={() => actions.toggleOnboardingItem(u.id, o.key)} />)}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>Document items are ticked automatically when the clinician uploads them. This is contractor onboarding, not an HR/payroll system.</p>
        </Card>
      )}
      {tab === 'rates' && isClin && (
        <Card title="Clinician pay rates" actions={<span className="small muted">Office-only. Clinicians see their agreed rate pre-filled on billing, never editable.</span>}>
          <div className="table-wrap"><table className="table"><thead><tr><th>Visit type</th><th className="num">Clinician pay</th><th /></tr></thead><tbody>
            {state.visitTypes.map((vt) => { const val = u.rateCard?.[vt.code]; return (
              <tr key={vt.code}><td><b>{vt.short}</b> <span className="muted">{vt.label}</span></td><td className="num">{val !== undefined ? money(val) : <span className="muted">not set</span>}</td><td className="right"><RateEditor value={val} disabled={!isAdmin} onSave={(v) => { actions.updateClinicianRate(u.id, vt.code, v); toast('Rate updated', 'success'); }} /></td></tr>
            ); })}
          </tbody></table></div>
        </Card>
      )}
      {tab === 'activity' && <Card title="Activity"><Timeline items={activity.map((a) => ({ at: a.at, who: L.userName(a.actorId), text: `${a.action} · ${a.entity}${a.detail ? ` - ${a.detail}` : ''}` }))} /></Card>}

      {edit && (
        <Modal title={`Edit ${u.name}`} onClose={() => setEdit(false)} footer={<><Button onClick={() => setEdit(false)}>Cancel</Button><Button variant="primary" onClick={() => { actions.updateUser(u.id, ef); setEdit(false); toast('Profile updated', 'success'); }}>Save</Button></>}>
          <div className="form-grid">
            <Field label="Email"><Input value={ef.email ?? ''} onChange={(e) => setEf({ ...ef, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={ef.phone ?? ''} onChange={(e) => setEf({ ...ef, phone: e.target.value })} /></Field>
            {isClin ? <>
              <Field label="Disciplines" className="span2"><Chips options={DISCIPLINES} value={ef.disciplines ?? []} onChange={(v) => setEf({ ...ef, disciplines: v as Discipline[] })} /></Field>
              <Field label="Languages" className="span2"><Chips options={LANGUAGES} value={ef.languages ?? []} onChange={(v) => setEf({ ...ef, languages: v })} /></Field>
              <Field label="Home city"><Input value={ef.homeCity ?? ''} onChange={(e) => setEf({ ...ef, homeCity: e.target.value })} /></Field>
              <Field label="Home ZIP"><Input value={ef.homeZip ?? ''} maxLength={5} onChange={(e) => setEf({ ...ef, homeZip: e.target.value })} /></Field>
              <Field label="Coverage regions" className="span2"><div className="chips">{state.regions.map((r) => <button key={r.id} type="button" className={`chip ${ef.regionIds?.includes(r.id) ? 'on' : ''}`} onClick={() => setEf({ ...ef, regionIds: ef.regionIds?.includes(r.id) ? ef.regionIds.filter((x) => x !== r.id) : [...(ef.regionIds ?? []), r.id] })}>{r.name}</button>)}</div></Field>
              <div className="span2"><Toggle label="Accepting new work (matching uses this)" checked={ef.acceptingWork !== false} onChange={(v) => setEf({ ...ef, acceptingWork: v })} /></div>
            </> : <>
              <Field label="Title"><Input value={ef.title ?? ''} onChange={(e) => setEf({ ...ef, title: e.target.value })} /></Field>
              <Field label="Access level"><Select value={ef.role} disabled={!isAdmin} onChange={(e) => setEf({ ...ef, role: e.target.value as UserRole })}><option value="office">Office Team</option><option value="admin">Admin / Manager</option></Select></Field>
              <div className="span2"><Toggle label="Include in new patient chat rooms" checked={!!ef.includeInPatientChats} onChange={(v) => setEf({ ...ef, includeInPatientChats: v })} /></div>
            </>}
          </div>
        </Modal>
      )}
      <span style={{ display: 'none' }}>{lines.map((l) => <LineStatePill key={l.requirement.type} line={l} />)}<CredStatusPill status="approved" />{fmtDateTime(u.startedOn ?? '')}</span>
    </>
  );
}

export function RateEditor({ value, onSave, disabled }: { value: number | undefined; onSave: (v: number | null) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value?.toString() ?? '');
  if (!editing) return <Button size="sm" disabled={disabled} title={disabled ? 'Admin / Manager only' : ''} onClick={() => { setV(value?.toString() ?? ''); setEditing(true); }}>{value !== undefined ? 'Edit' : 'Set rate'}</Button>;
  return (
    <span className="row" style={{ justifyContent: 'flex-end' }}>
      <Input type="number" min={0} step={5} value={v} onChange={(e) => setV(e.target.value)} style={{ width: 100 }} aria-label="Rate" />
      <Button size="sm" variant="primary" onClick={() => { const n = parseFloat(v); if (Number.isNaN(n) || n < 0) return; onSave(n); setEditing(false); }}>Save</Button>
      <Button size="sm" onClick={() => setEditing(false)}>Cancel</Button>
    </span>
  );
}
