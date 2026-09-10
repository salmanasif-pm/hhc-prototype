import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './store/store';
import { ToastProvider } from './ui';
import { Entry } from './Entry';
import { DemoControl } from './DemoControl';
import { OfficeShell } from './office/OfficeShell';
import { ClinicianShell } from './clinician/ClinicianShell';

function Guard({ role, children }: { role: 'office' | 'clinician'; children: React.ReactNode }) {
  const { role: current } = useStore();
  if (current !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Entry />} />
            <Route path="/office/*" element={<Guard role="office"><OfficeShell /></Guard>} />
            <Route path="/clinician/*" element={<Guard role="clinician"><ClinicianShell /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <DemoControl />
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
