import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from './store/store';
import { Button, Select } from './ui';

export function Entry() {
  const { state, actions, role } = useStore();
  const nav = useNavigate();
  const office = state.users.filter((u) => u.role !== 'clinician' && u.status === 'active');
  const clinicians = state.users.filter((u) => u.role === 'clinician' && u.status === 'active');
  const [officeId, setOfficeId] = useState(office[0]?.id ?? '');
  const [clinId, setClinId] = useState('c_priya');

  useEffect(() => {
    if (role === 'office') nav('/office', { replace: true });
    if (role === 'clinician') nav('/clinician', { replace: true });
  }, [role, nav]);

  return (
    <div className="entry">
      <div className="entry-card">
        <div className="entry-brand">
          <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill="#fff" fillOpacity="0.1" /><path d="M14 16h26l-13 22z" fill="#AEF6D2" /><path d="M28 48l12-22h12z" fill="#4ABA6A" /></svg>
          <div>
            <div className="word">Home Health Compass</div>
            <div className="sub">Operations Platform · Prototype</div>
          </div>
        </div>
        <h1>One application. Two ways in.</h1>
        <p className="lede">Referrals, clinician communication, credentials and billing in one place, with permissions deciding what each person sees. Pick an experience to start the demonstration. Everything here is fictional demo data.</p>
        <div className="entry-grid">
          <div className="role-card">
            <h2>Office Staff</h2>
            <ul>
              <li>Add patients and referrals once, then create visit requests</li>
              <li>Select eligible clinicians and send by priority group</li>
              <li>Track EMR plotting, review billing, export for QuickBooks</li>
              <li>Credentials, users, regions, reports and rates</li>
            </ul>
            <div className="persona">
              <label className="label" htmlFor="office-persona">Sign in as</label>
              <Select id="office-persona" value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
                {office.map((u) => <option key={u.id} value={u.id}>{u.name} - {u.title}{u.role === 'admin' ? ' (Admin)' : ''}</option>)}
              </Select>
            </div>
            <Button variant="primary" size="lg" onClick={() => { actions.enterDemo('office', officeId); nav('/office'); }}>Open the office experience</Button>
          </div>
          <div className="role-card clinician" data-experience="clinician">
            <h2>Clinician</h2>
            <ul>
              <li>Receive requests and accept or decline in one tap</li>
              <li>See assigned patients, planned visits and directions</li>
              <li>Chat with the office; upload and renew credentials</li>
              <li>Confirm visits, submit billing, follow payout status</li>
            </ul>
            <div className="persona">
              <label className="label" htmlFor="clin-persona">Sign in as</label>
              <Select id="clin-persona" value={clinId} onChange={(e) => setClinId(e.target.value)}>
                {clinicians.map((u) => <option key={u.id} value={u.id}>{u.name}, {u.disciplines?.join('/')} - {u.homeCity}</option>)}
              </Select>
            </div>
            <Button variant="success" size="lg" onClick={() => { actions.enterDemo('clinician', clinId); nav('/clinician'); }}>Open the clinician experience</Button>
          </div>
        </div>
        <div className="entry-foot">
          <span>Simulated role boundaries for demonstration, not production sign-in.</span>
          <span>Demo changes are saved in this browser. Use the demo control to switch experiences or reset.</span>
        </div>
      </div>
    </div>
  );
}
export const _r = React;
