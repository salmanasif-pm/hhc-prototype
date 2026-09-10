import { useState } from 'react';
import { useStore } from '../store/store';
import { Button, Callout, Card, Chips, DefGrid, Field, Input, PageHead, Pill, Toggle, useToast } from '../ui';
import { LANGUAGES } from '../domain/labels';
import { zipInfo } from '../domain/geo';

export function ClinicianProfile() {
  const { state, actions, me } = useStore();
  const toast = useToast();
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [langs, setLangs] = useState<string[]>(me?.languages ?? []);
  const [saving, setSaving] = useState(false);
  if (!me) return null;
  const regions = state.regions.filter((r) => r.clinicianIds.includes(me.id));
  const zips = [...new Set(regions.flatMap((r) => r.zips))];
  const save = () => {
    if (!phone.trim()) { toast('Phone is required', 'error'); return; }
    setSaving(true);
    actions.updateUser(me.id, { phone: phone.trim(), languages: langs }, 'Clinician updated contact details / languages');
    setSaving(false); toast('Profile saved', 'success');
  };
  return (
    <>
      <PageHead title="My profile" lede="Contact details, languages and work preferences you can change yourself. Discipline, home address and coverage changes go through the office." />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Contact and preferences" footer={<Button variant="primary" onClick={save} disabled={saving}>Save changes</Button>}>
          <div className="stack">
            <DefGrid items={[['Name', me.name], ['Email', me.email], ['Discipline', me.disciplines?.join(', ')], ['Home', `${me.homeCity} ${me.homeZip}`]]} />
            <Field label="Phone" required><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Languages"><Chips options={LANGUAGES} value={langs} onChange={setLangs} /></Field>
            <div className="divider" />
            <Toggle label={<span><b>Accepting new work</b> <span className="muted small">- turn off to stop receiving requests while you are away</span></span>} checked={me.acceptingWork !== false} onChange={(v) => { actions.updateUser(me.id, { acceptingWork: v }, v ? 'Clinician set accepting work' : 'Clinician set do-not-send'); toast(v ? 'You will receive new requests' : 'Requests paused - the office sees "Do not send"'); }} />
          </div>
        </Card>
        <div className="stack">
          <Card title="Coverage (set by the office)">
            {regions.length === 0 ? <Callout tone="warn">No coverage region is assigned to you yet. Ask the office.</Callout> : (
              <div className="stack">
                {regions.map((r) => <div key={r.id}><div className="strong">{r.name}</div><div className="small muted">{r.mode === 'zip' ? `${r.zips.length} ZIP codes` : r.polygonLabel ?? 'Drawn area'}</div></div>)}
                <div className="chips">{zips.map((z) => <span key={z} className="chip">{z} <span className="muted">{zipInfo(z)?.city}</span></span>)}</div>
                <p className="small muted">Requests for patients in these ZIP codes are sent to you when your discipline matches and your credentials are current.</p>
              </div>
            )}
          </Card>
          <Card title="Requests to the office">
            <p className="small muted">Changing discipline or home address requires office approval. Send a message in your <b>Human Resources</b> channel and the office will update it.</p>
            <div className="row wrap" style={{ marginTop: 8 }}><Pill tone="outline">Discipline change</Pill><Pill tone="outline">Home address change</Pill><Pill tone="outline">Coverage change</Pill></div>
          </Card>
        </div>
      </div>
    </>
  );
}
