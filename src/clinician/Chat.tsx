import { useParams } from 'react-router-dom';
import { ChatPanel } from '../shared/ChatPanel';
import { PageHead } from '../ui';

export function ClinicianChat() {
  const { id } = useParams();
  return (
    <>
      <PageHead title="Chat" lede="Patient conversations for your assigned work, plus your Intake, HR, Billing and Medical Records channels with the office." />
      <ChatPanel activeId={id} basePath="/clinician/chat" patientLink={(pid) => `/clinician/patients/${pid}`} />
    </>
  );
}
