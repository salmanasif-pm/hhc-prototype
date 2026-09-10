import React from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from '../store/store';
import { I } from '../ui';
import { NotificationBell } from '../shared/Notifications';
import { RequestsPage } from './Requests';
import { RequestDetailPage } from './RequestDetail';
import { NewRequestPage } from './NewRequest';
import { SchedulePage } from './Schedule';
import { PatientsPage, PatientDetailPage, NewPatientPage } from './Patients';
import { UsersPage, UserDetailPage } from './Users';
import { RegionsPage } from './Regions';
import { ReportsPage } from './Reports';
import { OfficeChatPage } from './Chat';
import { CredentialsPage } from './Credentials';
import { BillingPage } from './Billing';
import { SettingsPage } from './Settings';
import { readinessFor } from '../domain/rules';
import { unreadCount } from '../shared/ChatPanel';

export function OfficeShell() {
  const { state, me } = useStore();
  const loc = useLocation();
  const pending = state.requests.filter((r) => r.status === 'pending').length;
  const billingQueue = state.submissions.filter((s) => s.status === 'submitted').length;
  const credIssues = state.users.filter((u) => u.role === 'clinician' && u.status === 'active').filter((u) => ['blocked', 'expiring', 'under_review'].includes(readinessFor(state, u).readiness)).length;
  const unread = me ? state.conversations.filter((c) => c.memberIds.includes(me.id)).reduce((n, c) => n + unreadCount(c, me.id), 0) : 0;
  const links: { to: string; label: string; icon: keyof typeof I; count?: number }[] = [
    { to: '/office/scheduling', label: 'Scheduling', icon: 'layers', count: pending },
    { to: '/office/patients', label: 'Patient', icon: 'user' },
    { to: '/office/users', label: 'User', icon: 'users' },
    { to: '/office/regions', label: 'Region', icon: 'map' },
    { to: '/office/reports', label: 'Report', icon: 'chart' },
    { to: '/office/chat', label: 'Chat', icon: 'chat', count: unread },
    { to: '/office/credentials', label: 'Credentials', icon: 'badge', count: credIssues },
    { to: '/office/billing', label: 'Billing', icon: 'dollar', count: billingQueue },
  ];
  const isScheduling = loc.pathname.startsWith('/office/scheduling');
  return (
    <div className="shell" data-experience="office">
      <header className="topnav">
        <div className="topnav-inner">
          <NavLink to="/office" className="brand">
            <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill="#fff" fillOpacity="0.12" /><path d="M14 16h26l-13 22z" fill="#AEF6D2" /><path d="M28 48l12-22h12z" fill="#4ABA6A" /></svg>
            <span className="word">Home Health Compass</span>
            <span className="tag">Office</span>
          </NavLink>
          <nav className="nav-links" aria-label="Main">
            {links.map((l) => {
              const Ic = I[l.icon];
              return (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Ic size={16} />
                  {l.label}
                  {!!l.count && <span className="count">{l.count}</span>}
                </NavLink>
              );
            })}
          </nav>
          <div className="nav-right">
            <NavLink to="/office/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Settings" aria-label="Settings"><I.settings size={16} /></NavLink>
            <NotificationBell />
            <div className="nav-user" style={{ cursor: 'default' }}>
              <span className="avatar sm navy" aria-hidden>{me?.name.split(' ').map((p) => p[0]).join('')}</span>
              <span className="who"><span>{me?.name}</span><span>{me?.title}{me?.role === 'admin' ? ' · Admin' : ''}</span></span>
            </div>
          </div>
        </div>
        {isScheduling && (
          <div className="subnav">
            <div className="subnav-inner">
              <NavLink to="/office/scheduling/requests" className={({ isActive }) => (isActive ? 'active' : '')}>Requests</NavLink>
              <NavLink to="/office/scheduling/schedule" className={({ isActive }) => (isActive ? 'active' : '')}>Schedule</NavLink>
            </div>
          </div>
        )}
      </header>
      <main className="main">
        <Routes>
          <Route index element={<Navigate to="scheduling/requests" replace />} />
          <Route path="scheduling" element={<Navigate to="requests" replace />} />
          <Route path="scheduling/requests" element={<RequestsPage />} />
          <Route path="scheduling/requests/new" element={<NewRequestPage />} />
          <Route path="scheduling/requests/:id/send" element={<NewRequestPage />} />
          <Route path="scheduling/requests/:id" element={<RequestDetailPage />} />
          <Route path="scheduling/schedule" element={<SchedulePage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="patients/new" element={<NewPatientPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="regions" element={<RegionsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="chat" element={<OfficeChatPage />} />
          <Route path="chat/:id" element={<OfficeChatPage />} />
          <Route path="credentials" element={<CredentialsPage />} />
          <Route path="credentials/:id" element={<CredentialsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="billing/:tab" element={<BillingPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/office" replace />} />
        </Routes>
      </main>
    </div>
  );
}
export const _r = React;
