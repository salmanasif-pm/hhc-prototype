import React from 'react';
import { useParams } from 'react-router-dom';
import { ChatPanel } from '../shared/ChatPanel';
import { PageHead } from '../ui';

export function OfficeChatPage() {
  const { id } = useParams();
  return (
    <>
      <PageHead title="Chat" lede="Patient conversations open automatically on assignment and stay linked to the patient record. Department channels keep Intake, HR, Billing and Medical Records conversations with each clinician organized." />
      <ChatPanel activeId={id} basePath="/office/chat" patientLink={(pid) => `/office/patients/${pid}`} />
    </>
  );
}
export const _r = React;
