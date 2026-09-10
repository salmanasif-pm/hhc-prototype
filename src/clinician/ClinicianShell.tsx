import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '../store/store';
import { I } from '../ui';
import { NotificationBell } from '../shared/Notifications';
import { unreadCount } from '../shared/ChatPanel';
import { readinessFor } from '../domain/rules';
import { ClinicianHome } from './Home';
import { ClinicianRequests } from './Requests';
import { ClinicianPatients, ClinicianPatientDetail } from './Patients';
import { ClinicianSchedule } from './Schedule';
import { ClinicianChat } from './Chat';
import { ClinicianCredentials } from './Credentials';
import { ClinicianBilling } from './Billing';
import { ClinicianProfile } from './Profile';

export function ClinicianShell() {
  const { state, me } = useStore();
  if (!me) return null;
  const pending = state.requests.filter((r) => r.status === 'pending' && r.recipients.some((x) => x.clinicianId === me.id && x.sentAt && !x.response)).length;
  const unread = state.conversations.filter((c) => c.memberIds.includes(me.id)).reduce((n, c) => n + unreadCount(c, me.id), 0);
  const credAlert = readinessFor(state, me).readiness !== 'ready';
  const returned = state.submissions.filter((s) => s.clinicianId === me.id && s.status === 'returned').length;
  const links: { to: string; label: string; icon: keyof typeof I; count?: number; end?: boolean }[] = [
    { to: '/clinician', label: 'Home', icon: 'home', end: true },
    { to: '/clinician/requests', label: 'Requests', icon: 'layers', count: pending },
    { to: '/clinician/patients', label: 'Patients', icon: 'user' },
    { to: '/clinician/schedule', label: 'Schedule', icon: 'calendar' },
    { to: '/clinician/chat', label: 'Chat', icon: 'chat', count: unread },
    { to: '/clinician/credentials', label: 'Credentials', icon: 'badge', count: credAlert ? 1 : 0 },
    { to: '/clinician/billing', label: 'Billing', icon: 'dollar', count: returned },
    { to: '/clinician/profile', label: 'My profile', icon: 'settings' },
  ];
  const tabs = links.filter((l) => ['Home', 'Requests', 'Patients', 'Schedule', 'Chat'].includes(l.label));
  return (
    <div className="shell" data-experience="clinician">
      <header className="topnav">
        <div className="topnav-inner">
          <NavLink to="/clinician" className="brand">
            <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill="#fff" fillOpacity="0.12" /><path d="M14 16h26l-13 22z" fill="#AEF6D2" /><path d="M28 48l12-22h12z" fill="#4ABA6A" /></svg>
            <span className="word">Home Health Compass</span>
            <span className="tag">Clinician</span>
          </NavLink>
          <nav className="nav-links hide-mobile" aria-label="Main">
            {links.map((l) => { const Ic = I[l.icon]; return <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Ic size={16} />{l.label}{!!l.count && <span className="count">{l.count}</span>}</NavLink>; })}
          </nav>
          <div className="nav-right">
            <NotificationBell />
            <NavLink to="/clinician/profile" className="nav-user">
              <span className="avatar sm green" aria-hidden>{me.name.split(' ').map((p) => p[0]).join('')}</span>
              <span className="who"><span>{me.name}</span><span>{me.disciplines?.join('/')}</span></span>
            </NavLink>
          </div>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route index element={<ClinicianHome />} />
          <Route path="requests" element={<ClinicianRequests />} />
          <Route path="requests/:id" element={<ClinicianRequests />} />
          <Route path="patients" element={<ClinicianPatients />} />
          <Route path="patients/:id" element={<ClinicianPatientDetail />} />
          <Route path="schedule" element={<ClinicianSchedule />} />
          <Route path="schedule/:id" element={<ClinicianSchedule />} />
          <Route path="chat" element={<ClinicianChat />} />
          <Route path="chat/:id" element={<ClinicianChat />} />
          <Route path="credentials" element={<ClinicianCredentials />} />
          <Route path="billing" element={<ClinicianBilling />} />
          <Route path="profile" element={<ClinicianProfile />} />
          <Route path="*" element={<Navigate to="/clinician" replace />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="Mobile navigation">
        {tabs.map((l) => { const Ic = I[l.icon]; return <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}><Ic size={20} />{l.label}{!!l.count && <span className="dot" />}</NavLink>; })}
      </nav>
    </div>
  );
}
