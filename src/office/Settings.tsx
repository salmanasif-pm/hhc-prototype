import { useState } from 'react';
import { useLookups, useStore } from '../store/store';
import { Button, Callout, Card, Field, Input, Modal, PageHead, Pill, Select, Tabs, Timeline, Toggle, useToast } from '../ui';
import { CHANNEL_LABEL, ROLE_LABEL } from '../domain/labels';
import type { Agency, ChannelType } from '../domain/types';

export function SettingsPage() {
  const { state, actions, me } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<'agencies' | 'visitTypes' | 'channels' | 'access' | 'activity'>('agencies');
  const [edit, setEdit] = useState<Partial<Agency> | null>(null);
  const [chan, setChan] = useState<{ type: ChannelType; clinicianId: string; name: string } | null>(null);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const isAdmin = me?.role === 'admin';
  const activity = state.activity.filter((a) => !actor || a.actorId === actor).filter((a) => !action || a.action.startsWith(action));
  const actionTypes = [...new Set(state.activity.map((a) => a.action.split('.')[0]!))];

  return (
    <>
      <PageHead title="Settings" lede="Reference lists that keep operational forms current: agencies and EMR references, visit types, department channels, access levels and the activity history." />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'agencies', label: 'Agencies', count: state.agencies.length }, { key: 'visitTypes', label: 'Visit types' }, { key: 'channels', label: 'Department channels' }, { key: 'access', label: 'Access levels' }, { key: 'activity', label: 'Activity history', count: state.activity.length }]} />
      {tab === 'agencies' && (
        <Card pad={false} title="Agencies" actions={<Button variant="primary" size="sm" icon="plus" disabled={!isAdmin} onClick={() => setEdit({ name: '', emrLabel: 'Kinnser', emrDomain: '', terms: 'Net 30', billingAddress: '', contactEmail: '' })}>Add agency</Button>}>
          <div className="table-wrap"><table className="table"><thead><tr><th>Agency</th><th>EMR</th><th>Billing address</th><th>Terms</th><th>Status</th><th /></tr></thead><tbody>
            {state.agencies.map((a) => <tr key={a.id}><td className="cell-main">{a.name}</td><td>{a.emrLabel} <span className="cell-sub">{a.emrDomain}</span></td><td className="small">{a.billingAddress}</td><td>{a.terms}</td><td>{a.active ? <Pill tone="green">Active</Pill> : <Pill tone="gray">Inactive</Pill>}</td><td className="right"><div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" disabled={!isAdmin} onClick={() => setEdit({ ...a })}>Edit</Button><Button size="sm" disabled={!isAdmin} onClick={() => { actions.upsertAgency({ ...a, active: !a.active }); toast(a.active ? 'Agency deactivated (history kept)' : 'Agency reactivated'); }}>{a.active ? 'Deactivate' : 'Reactivate'}</Button></div></td></tr>)}
          </tbody></table></div>
        </Card>
      )}
      {tab === 'visitTypes' && (
        <Card title="Visit types" pad={false}>
          <div className="table-wrap"><table className="table"><thead><tr><th>Code</th><th>Label</th><th>Used by</th></tr></thead><tbody>
            {state.visitTypes.map((v) => <tr key={v.code}><td className="cell-main">{v.short}</td><td>{v.label}</td><td className="small muted">{state.requests.filter((r) => r.visitTypeCode === v.code).length} request(s) · rates on {state.agencies.filter((a) => a.rateCard[v.code] !== undefined).length} agency card(s)</td></tr>)}
          </tbody></table></div>
          <div className="card-body"><Callout tone="neutral">Disciplines: PT, PTA, OT, COTA and ST are available from day one. Speech therapy is included as a visit discipline even though it was not yet set up in the current tool.</Callout></div>
        </Card>
      )}
      {tab === 'channels' && (
        <Card title="Department channels" actions={<Button size="sm" variant="primary" icon="plus" disabled={!isAdmin} onClick={() => setChan({ type: 'intake', clinicianId: state.users.find((u) => u.role === 'clinician')?.id ?? '', name: '' })}>Create channel</Button>}>
          <p className="small muted" style={{ marginBottom: 12 }}>Channel types are configurable - the four current departments are a starting point, not a limit. Each active clinician gets a private instance of Intake, HR, Billing and Medical Records with the relevant office team; Announcements is read-only for clinicians.</p>
          <div className="table-wrap"><table className="table"><thead><tr><th>Channel type</th><th>Default office members</th><th className="num">Instances</th></tr></thead><tbody>
            {(['intake', 'hr', 'billing', 'medical_records', 'announcements'] as ChannelType[]).map((t) => { const convs = state.conversations.filter((c) => c.channelType === t); const members = [...new Set(convs.flatMap((c) => c.memberIds).filter((m) => !m.startsWith('c_')))]; return <tr key={t}><td className="cell-main">{CHANNEL_LABEL[t]}</td><td className="small">{members.map((m) => L.userName(m)).join(', ')}</td><td className="num">{convs.length}</td></tr>; })}
          </tbody></table></div>
        </Card>
      )}
      {tab === 'access' && (
        <Card title="Access levels (Phase 1 permission matrix)" pad={false}>
          <div className="table-wrap"><table className="table"><thead><tr><th>Capability</th><th>Admin / Manager</th><th>Office Team</th><th>Clinician</th></tr></thead><tbody>
            {[
              ['Add patients, create and send requests, assign', '✓', '✓', '—'],
              ['Record EMR plot status, review billing, prepare export', '✓', '✓', '—'],
              ['Review and approve credentials', '✓', '✓', '—'],
              ['Record credential override / assignment exception for a blocked clinician', '✓', '—', '—'],
              ['Edit rates, agencies, requirements; invite and deactivate users', '✓', '—', '—'],
              ['Adjust an agency amount on a billing line', '✓', '—', '—'],
              ['See own requests, assigned patients, chats, credentials, billing', '—', '—', '✓'],
              ['Accept or decline requests (desktop and mobile)', '—', '—', '✓'],
              ['See clinician pay rate on own submissions', '✓', '✓', '✓ (own only)'],
              ['See agency bill rates', '✓', '✓', '—'],
            ].map(([c, a, o, cl]) => <tr key={c}><td>{c}</td><td>{a}</td><td>{o}</td><td>{cl}</td></tr>)}
          </tbody></table></div>
          <div className="card-body"><div className="row wrap">{state.users.filter((u) => u.role !== 'clinician').map((u) => <Pill key={u.id} tone={u.role === 'admin' ? 'navy' : 'blue'}>{u.name} · {ROLE_LABEL[u.role]}</Pill>)}</div></div>
        </Card>
      )}
      {tab === 'activity' && (
        <Card title="Activity history" actions={<div className="row"><Select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Actor"><option value="">All users</option>{state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}<option value="system">System</option></Select><Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action"><option value="">All actions</option>{actionTypes.map((t) => <option key={t}>{t}</option>)}</Select></div>}>
          <Timeline items={activity.slice(0, 80).map((a) => ({ at: a.at, who: L.userName(a.actorId), text: `${a.action} · ${a.entity}${a.detail ? ` - ${a.detail}` : ''}` }))} />
        </Card>
      )}
      {edit && (
        <Modal title={edit.id ? `Edit ${edit.name}` : 'Add agency'} onClose={() => setEdit(null)} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" disabled={!edit.name?.trim()} onClick={() => { actions.upsertAgency({ ...edit, name: edit.name!.trim() } as Partial<Agency> & { name: string }); setEdit(null); toast('Agency saved', 'success'); }}>Save</Button></>}>
          <div className="form-grid">
            <Field label="Agency name" required className="span2"><Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="EMR"><Select value={edit.emrLabel} onChange={(e) => setEdit({ ...edit, emrLabel: e.target.value })}>{['Kinnser', 'Devero', 'HHMD', 'Other'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="EMR domain"><Input value={edit.emrDomain ?? ''} onChange={(e) => setEdit({ ...edit, emrDomain: e.target.value })} placeholder="kinnser.net" /></Field>
            <Field label="Billing address" className="span2"><Input value={edit.billingAddress ?? ''} onChange={(e) => setEdit({ ...edit, billingAddress: e.target.value })} /></Field>
            <Field label="AP contact email"><Input value={edit.contactEmail ?? ''} onChange={(e) => setEdit({ ...edit, contactEmail: e.target.value })} /></Field>
            <Field label="Terms"><Select value={edit.terms} onChange={(e) => setEdit({ ...edit, terms: e.target.value })}>{['Net 15', 'Net 30', 'Net 45', 'Net 60'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            {edit.id && <div className="span2"><Toggle label="Active" checked={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} /></div>}
          </div>
          <p className="small muted">Bill rates are edited under Billing &gt; Rates.</p>
        </Modal>
      )}
      {chan && (
        <Modal title="Create channel" onClose={() => setChan(null)} footer={<><Button onClick={() => setChan(null)}>Cancel</Button><Button variant="primary" onClick={() => { const c = state.users.find((u) => u.id === chan.clinicianId); const name = chan.name.trim() || `${CHANNEL_LABEL[chan.type]} - ${c?.name ?? ''}`; const members = [...state.users.filter((u) => u.role === 'admin').map((u) => u.id), ...(chan.clinicianId ? [chan.clinicianId] : [])]; actions.createChannel(chan.type, chan.clinicianId || undefined, name, members); setChan(null); toast('Channel created', 'success'); }}>Create</Button></>}>
          <Field label="Channel type"><Select value={chan.type} onChange={(e) => setChan({ ...chan, type: e.target.value as ChannelType })}>{(['intake', 'hr', 'billing', 'medical_records'] as ChannelType[]).map((t) => <option key={t} value={t}>{CHANNEL_LABEL[t]}</option>)}</Select></Field>
          <Field label="Clinician"><Select value={chan.clinicianId} onChange={(e) => setChan({ ...chan, clinicianId: e.target.value })}>{state.users.filter((u) => u.role === 'clinician').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="Name (optional)"><Input value={chan.name} onChange={(e) => setChan({ ...chan, name: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
