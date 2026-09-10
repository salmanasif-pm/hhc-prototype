import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from './store/store';
import { Button, Confirm, I, Select, useToast } from './ui';

const OFFICE_STEPS = [
  'Patient > Add patient and referral for a new referral.',
  'Scheduling > Requests > New request: select clinicians (credential status decides eligibility) and send.',
  'Switch to the clinician: accept the request - first eligible acceptance assigns.',
  'Scheduling > Schedule: record the planned date and mark it plotted in the agency EMR.',
  'Clinician confirms visit + note and submits billing from the visit.',
  'Billing > Awaiting review: approve with both rates, then Prepare agency billing and export for QuickBooks.',
  'Billing > Payment status: mark paid - the clinician sees the same status.',
  'Onboarding & Credentials: Daniel Okafor is blocked (expired CPR); review uploads, send reminders, record an override.',
];

export function DemoControl() {
  const { state, actions, me, role } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!role) return null;
  const office = state.users.filter((u) => u.role !== 'clinician' && u.status === 'active');
  const clinicians = state.users.filter((u) => u.role === 'clinician' && u.status !== 'inactive');

  const switchTo = (r: 'office' | 'clinician', id: string) => {
    actions.enterDemo(r, id);
    nav(r === 'office' ? '/office' : '/clinician');
    setOpen(false);
  };
  return (
    <>
      <button className="demo-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Demo controls">
        <I.sparkle size={14} />
        <span className="txt">Demo · {role === 'office' ? 'Office' : 'Clinician'} · {me?.name.split(' ')[0]}</span>
      </button>
      {open && (
        <div className="demo-panel" role="dialog" aria-label="Demo controls">
          <div className="hd">
            <strong>Demo controls</strong>
            <button className="btn icon sm ghost" style={{ color: '#fff' }} onClick={() => setOpen(false)} aria-label="Close"><I.x size={14} /></button>
          </div>
          <div className="bd">
            <div className="field">
              <label>Office Staff experience</label>
              <div className="row">
                <Select value={role === 'office' ? me?.id : ''} onChange={(e) => e.target.value && switchTo('office', e.target.value)}>
                  <option value="">Switch to office as…</option>
                  {office.map((u) => <option key={u.id} value={u.id}>{u.name} - {u.title}</option>)}
                </Select>
              </div>
            </div>
            <div className="field">
              <label>Clinician experience</label>
              <Select value={role === 'clinician' ? me?.id : ''} onChange={(e) => e.target.value && switchTo('clinician', e.target.value)}>
                <option value="">Switch to clinician as…</option>
                {clinicians.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.disciplines?.join('/')}){u.status === 'invited' ? ' - onboarding' : ''}</option>)}
              </Select>
            </div>
            <div className="divider" />
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Suggested walkthrough</div>
              <div className="stack" style={{ gap: 6 }}>
                {OFFICE_STEPS.map((s, i) => (
                  <div key={i} className={`demo-step ${i === 2 || i === 4 ? 'clin' : ''}`}><span className="n">{i + 1}</span><span>{s}</span></div>
                ))}
              </div>
            </div>
            <div className="divider" />
            <div className="row between wrap">
              <Button size="sm" icon="logout" onClick={() => { actions.exitDemo(); nav('/'); setOpen(false); }}>Entry screen</Button>
              <Button size="sm" variant="danger" icon="refresh" onClick={() => setConfirm(true)}>Reset demo</Button>
            </div>
          </div>
        </div>
      )}
      {confirm && (
        <Confirm title="Reset demo data?" danger confirmLabel="Reset" body="All changes made in this browser are discarded and the seeded scenario is restored. You return to the entry screen." onCancel={() => setConfirm(false)}
          onConfirm={() => { actions.reset(); setConfirm(false); setOpen(false); nav('/'); toast('Demo data reset to the seeded scenario', 'success'); }} />
      )}
    </>
  );
}
export const _r = React;
