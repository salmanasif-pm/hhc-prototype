import { useState } from 'react';
import { useStore } from '../store/store';
import { Button, Callout, Card, Check, Field, FilePick, I, Input, Modal, PageHead, Pill, useToast } from '../ui';
import { LineStatePill, ReadinessPill } from '../shared/pills';
import { credentialLines, readinessFor } from '../domain/rules';
import { dateFromNow, fmtDate, fmtDateTime } from '../domain/format';
import type { CredentialType } from '../domain/types';

export function ClinicianCredentials() {
  const { state, actions, me } = useStore();
  const toast = useToast();
  const [upload, setUpload] = useState<CredentialType | null>(null);
  const [file, setFile] = useState<string | undefined>();
  const [exp, setExp] = useState(dateFromNow(365));
  const [issued, setIssued] = useState('');
  if (!me) return null;
  const rd = readinessFor(state, me);
  const lines = credentialLines(state, me);
  const pendingFor = (t: CredentialType) => state.credentials.find((c) => c.clinicianId === me.id && c.type === t && c.status === 'under_review');
  const doUpload = () => {
    if (!upload || !file) return;
    if (!exp) { toast('Expiration date is required', 'error'); return; }
    actions.uploadCredential(me.id, upload, { fileName: file, expiresOn: exp, issuedOn: issued || undefined });
    toast('Uploaded - the office will review it', 'success');
    setUpload(null); setFile(undefined);
  };
  return (
    <>
      <PageHead title="Onboarding & Credentials" lede="Each required credential with its document and expiration date. Renew before the date to stay eligible for new requests." actions={<ReadinessPill readiness={rd.readiness} />} />
      {rd.readiness === 'blocked' && <div style={{ marginBottom: 14 }}><Callout tone="danger"><b>New requests are blocked</b> until the expired or missing items below are renewed and approved: {rd.blockingLabels.join(', ')}. Your current assigned patients are not affected.</Callout></div>}
      {rd.readiness === 'override' && <div style={{ marginBottom: 14 }}><Callout tone="warn">The office recorded a temporary exception so you can receive requests. Please upload the renewal soon.</Callout></div>}
      <div className="stack" style={{ maxWidth: 860 }}>
        <Card pad={false}>
          <div className="list">
            {lines.map((l) => { const c = l.credential; const pending = pendingFor(l.requirement.type); return (
              <div key={l.requirement.type} className="list-item" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className="main">
                  <div className="title row wrap">{l.requirement.label}<LineStatePill line={l} />{pending && l.state !== 'under_review' && <Pill tone="periwinkle" sm>Renewal under review</Pill>}{!l.requirement.blocksNewWork && <Pill tone="outline" sm>does not block</Pill>}</div>
                  <div className="sub" style={{ whiteSpace: 'normal' }}>
                    {c?.fileName ? <span className="row" style={{ display: 'inline-flex' }}><I.file size={13} /> {c.fileName}</span> : 'No document on file'}
                    {c?.expiresOn && <> · expires {fmtDate(c.expiresOn)}</>}
                    {c?.status === 'returned' && c.reviewNote && <div style={{ color: 'var(--amber)', marginTop: 2 }}>Returned: {c.reviewNote}</div>}
                    {c?.status === 'rejected' && c.reviewNote && <div style={{ color: 'var(--red)', marginTop: 2 }}>Rejected: {c.reviewNote}</div>}
                    {pending && <div style={{ marginTop: 2 }}>Renewal {pending.fileName} uploaded {fmtDateTime(pending.uploadedAt)} · awaiting office review</div>}
                  </div>
                  <div className="small" style={{ marginTop: 4, fontWeight: 600, color: l.state === 'ok' ? 'var(--muted)' : 'var(--navy)' }}>Next action: {pending ? 'Wait for office review' : l.nextAction}</div>
                </div>
                <Button size="sm" variant={l.state === 'ok' || pending ? 'default' : 'primary'} icon="upload" onClick={() => { setUpload(l.requirement.type); setFile(undefined); setExp(dateFromNow(365)); setIssued(''); }}>{c?.fileName ? 'Upload renewal' : 'Upload'}</Button>
              </div>
            ); })}
          </div>
        </Card>
        <Card title={`Onboarding checklist · ${me.onboarding?.filter((o) => o.done).length ?? 0}/${me.onboarding?.length ?? 0}`}>
          <div className="stack" style={{ gap: 6 }}>{me.onboarding?.map((o) => <Check key={o.key} label={<span className={o.done ? 'muted' : ''}>{o.label}{o.required && !o.done ? <Pill tone="amber" sm> required</Pill> : null}</span>} checked={o.done} disabled onChange={() => {}} />)}</div>
          <p className="small muted" style={{ marginTop: 10 }}>Document items are ticked when your upload is received. Other items are completed by the office.</p>
        </Card>
      </div>
      {upload && (
        <Modal title={`Upload - ${lines.find((l) => l.requirement.type === upload)?.requirement.label}`} onClose={() => setUpload(null)} footer={<><Button onClick={() => setUpload(null)}>Cancel</Button><Button variant="primary" disabled={!file} onClick={doUpload}>Submit for review</Button></>}>
          <FilePick value={file} onChange={setFile} />
          <div className="grid-2"><Field label="Expiration date" required><Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} min={dateFromNow(0)} /></Field><Field label="Issue date (if shown)"><Input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} /></Field></div>
          <Callout tone="neutral">PDF, JPEG or PNG up to 10 MB. Your document goes to the office for review; you are notified when it is approved or returned. An approved document cannot be deleted, only superseded.</Callout>
        </Modal>
      )}
    </>
  );
}
