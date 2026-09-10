import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/store';
import { Button, Callout, Card, Chips, Confirm, Empty, Field, Input, Modal, PageHead, Pill, Segmented, useToast } from '../ui';
import { ZIPS, zipInfo } from '../domain/geo';
import type { Region } from '../domain/types';

// Schematic map: ZIP centroids projected to a small SVG. Not a real map service.
function MapSketch({ highlight, patients }: { highlight: string[]; patients?: string[] }) {
  const lats = ZIPS.map((z) => z.lat), lngs = ZIPS.map((z) => z.lng);
  const minLat = Math.min(...lats) - 0.05, maxLat = Math.max(...lats) + 0.05, minLng = Math.min(...lngs) - 0.05, maxLng = Math.max(...lngs) + 0.05;
  const W = 640, H = 420;
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * W;
  const y = (lat: number) => H - ((lat - minLat) / (maxLat - minLat)) * H;
  return (
    <div className="map-sketch" aria-label="Schematic coverage map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0v32" fill="none" stroke="rgba(0,36,89,0.06)" /></pattern></defs>
        <rect width={W} height={H} fill="url(#grid)" />
        <path d={`M${x(-122.42)} ${y(37.9)} C ${x(-122.3)} ${y(37.7)}, ${x(-122.2)} ${y(37.5)}, ${x(-122.05)} ${y(37.42)}`} stroke="#b9d4f2" strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.7" />
        {ZIPS.map((z) => {
          const on = highlight.includes(z.zip);
          return (
            <g key={z.zip}>
              <circle cx={x(z.lng)} cy={y(z.lat)} r={on ? 16 : 9} fill={on ? 'rgba(40,67,255,0.28)' : 'rgba(0,36,89,0.08)'} stroke={on ? '#2843FF' : 'rgba(0,36,89,0.25)'} strokeWidth={on ? 2 : 1} />
              <text x={x(z.lng)} y={y(z.lat) + 3} textAnchor="middle" fontSize="9" fill={on ? '#002459' : '#667089'} fontWeight={on ? 700 : 500}>{z.zip}</text>
            </g>
          );
        })}
        {patients?.map((zip, i) => { const z = zipInfo(zip); return z ? <circle key={i} cx={x(z.lng)} cy={y(z.lat) - 14} r="4" fill="#4ABA6A" /> : null; })}
        <text x="12" y="20" fontSize="11" fill="#667089">Schematic map - ZIP centroids. Production uses a mapping provider with ZIP boundaries and polygon drawing.</text>
      </svg>
    </div>
  );
}

export function RegionsPage() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [sel, setSel] = useState<string | null>(state.regions[0]?.id ?? null);
  const [edit, setEdit] = useState<Partial<Region> | null>(null);
  const [del, setDel] = useState<Region | null>(null);
  const [zipInput, setZipInput] = useState('');
  const region = state.regions.find((r) => r.id === sel);
  const clinicians = state.users.filter((u) => u.role === 'clinician' && u.status !== 'inactive');
  const openCount = useMemo(() => (r: Region) => state.requests.filter((q) => q.status === 'pending' && r.zips.includes(state.patients.find((p) => p.id === q.patientId)?.address.zip ?? '')).length, [state.requests, state.patients]);

  const save = () => {
    if (!edit?.name?.trim()) { toast('Region name is required', 'error'); return; }
    if (!edit.zips?.length) { toast('Select at least one ZIP code or draw an area', 'error'); return; }
    const id = actions.upsertRegion({ id: edit.id, name: edit.name.trim(), mode: edit.mode ?? 'zip', zips: edit.zips, polygonLabel: edit.polygonLabel, clinicianIds: edit.clinicianIds ?? [] });
    setSel(id); setEdit(null); toast('Region saved - matching uses it immediately', 'success');
  };
  const addZip = () => { const z = zipInput.trim(); if (!/^\d{5}$/.test(z)) return; if (!zipInfo(z)) { toast('ZIP outside the demo reference data', 'error'); return; } setEdit((e) => ({ ...e!, zips: [...new Set([...(e!.zips ?? []), z])] })); setZipInput(''); };

  return (
    <>
      <PageHead title="Regions" lede="Named coverage areas built from ZIP codes or a drawn polygon and assigned to clinicians. Matching uses coverage plus discipline, accepting-work preference and credential status." actions={<Button variant="primary" icon="plus" onClick={() => setEdit({ name: '', mode: 'zip', zips: [], clinicianIds: [] })}>New region</Button>} />
      <div className="grid-3" style={{ gridTemplateColumns: '320px 1fr', alignItems: 'start' }}>
        <Card pad={false} title="Coverage regions">
          <div className="list">
            {state.regions.map((r) => (
              <button key={r.id} className={`list-item click ${r.id === sel ? 'active' : ''}`} style={{ border: 0, background: r.id === sel ? undefined : 'transparent', width: '100%', textAlign: 'left' }} onClick={() => setSel(r.id)}>
                <div className="main"><div className="title">{r.name}</div><div className="sub">{r.mode === 'zip' ? `${r.zips.length} ZIP codes` : 'Polygon'} · {r.clinicianIds.length} clinician(s){openCount(r) ? ` · ${openCount(r)} open request(s)` : ''}</div></div>
                {r.clinicianIds.length === 0 && <Pill tone="amber" sm>No clinicians</Pill>}
              </button>
            ))}
            {state.regions.length === 0 && <Empty title="No regions yet" icon="map" />}
          </div>
        </Card>
        {region ? (
          <Card title={<h2>{region.name} <span className="muted small" style={{ fontWeight: 500 }}>· {region.mode === 'zip' ? 'ZIP-based' : 'Polygon'}{region.polygonLabel ? ` · ${region.polygonLabel}` : ''}</span></h2>} actions={<><Button icon="edit" onClick={() => setEdit({ ...region })}>Edit</Button><Button variant="danger" onClick={() => setDel(region)}>Delete</Button></>}>
            <div className="grid-3" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
              <MapSketch highlight={region.zips} patients={state.requests.filter((q) => q.status === 'pending').map((q) => state.patients.find((p) => p.id === q.patientId)?.address.zip ?? '').filter((z) => region.zips.includes(z))} />
              <div className="stack">
                <div><div className="label" style={{ marginBottom: 6 }}>ZIP codes ({region.zips.length})</div><div className="chips">{region.zips.map((z) => <span key={z} className="chip">{z} <span className="muted">{zipInfo(z)?.city}</span></span>)}</div></div>
                <div><div className="label" style={{ marginBottom: 6 }}>Assigned clinicians</div>
                  {region.clinicianIds.length === 0 ? <Callout tone="warn">No clinician is assigned to this region. Requests for these ZIPs will find no coverage.</Callout> : (
                    <div className="list card" style={{ boxShadow: 'none' }}>{region.clinicianIds.map((cid) => { const c = state.users.find((u) => u.id === cid); return c ? <Link key={cid} to={`/office/users/${cid}`} className="list-item click"><span className="avatar sm green">{c.name.split(' ').map((x) => x[0]).join('')}</span><div className="main"><div className="title">{c.name}</div><div className="sub">{c.disciplines?.join('/')} · {c.homeCity} · {c.acceptingWork === false ? 'not accepting work' : 'accepting work'}</div></div></Link> : null; })}</div>
                  )}
                </div>
                <Callout tone="neutral">Green dots are pending requests inside this region. Coverage changes apply to clinician selection immediately and are recorded.</Callout>
              </div>
            </div>
          </Card>
        ) : <Card><Empty title="Select a region" icon="map" /></Card>}
      </div>

      {edit && (
        <Modal wide title={edit.id ? `Edit ${edit.name}` : 'New region'} onClose={() => setEdit(null)} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save region</Button></>}>
          <div className="grid-3" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
            <div className="stack">
              <Field label="Region name" required><Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. East Bay South" /></Field>
              <Field label="Build coverage by"><Segmented value={edit.mode ?? 'zip'} onChange={(v) => setEdit({ ...edit, mode: v })} items={[{ key: 'zip', label: 'ZIP codes' }, { key: 'polygon', label: 'Draw polygon' }]} /></Field>
              {edit.mode === 'zip' ? (
                <Field label="Add ZIP codes" help="Type a ZIP or click a marker on the map."><div className="row"><Input value={zipInput} onChange={(e) => setZipInput(e.target.value)} maxLength={5} list="zips2" onKeyDown={(e) => e.key === 'Enter' && addZip()} /><datalist id="zips2">{ZIPS.map((z) => <option key={z.zip} value={z.zip}>{z.city}</option>)}</datalist><Button onClick={addZip}>Add</Button></div></Field>
              ) : (
                <Field label="Drawn area" help="Simulated: click markers to include them in the drawn shape. Production uses a map drawing control; the shape is validated and simplified on save."><Input value={edit.polygonLabel ?? ''} onChange={(e) => setEdit({ ...edit, polygonLabel: e.target.value })} placeholder="Describe the drawn area, e.g. Fremont to Hayward along I-880" /></Field>
              )}
              <div className="chips">{(edit.zips ?? []).map((z) => <button key={z} type="button" className="chip on" onClick={() => setEdit({ ...edit, zips: edit.zips!.filter((x) => x !== z) })}>{z} {zipInfo(z)?.city} ×</button>)}{(edit.zips ?? []).length === 0 && <span className="muted small">No ZIP codes selected</span>}</div>
              <Field label="Assign to clinicians"><Chips options={clinicians.map((c) => c.name)} value={(edit.clinicianIds ?? []).map((id) => clinicians.find((c) => c.id === id)?.name ?? id)} onChange={(names) => setEdit({ ...edit, clinicianIds: names.map((n) => clinicians.find((c) => c.name === n)?.id ?? n) })} /></Field>
            </div>
            <div>
              <div className="small muted" style={{ marginBottom: 6 }}>Click a ZIP marker to toggle it.</div>
              <div onClick={(e) => { const t = (e.target as HTMLElement).closest('g'); const txt = t?.querySelector('text')?.textContent; if (txt && /^\d{5}$/.test(txt)) setEdit((ed) => ({ ...ed!, zips: ed!.zips?.includes(txt) ? ed!.zips.filter((x) => x !== txt) : [...(ed!.zips ?? []), txt] })); }} style={{ cursor: 'pointer' }}>
                <MapSketch highlight={edit.zips ?? []} />
              </div>
            </div>
          </div>
        </Modal>
      )}
      {del && <Confirm title={`Delete ${del.name}?`} danger confirmLabel="Delete region" body={`${del.clinicianIds.length} clinician(s) lose this coverage. Requests already sent are not affected.`} onCancel={() => setDel(null)} onConfirm={() => { actions.deleteRegion(del.id); setDel(null); setSel(state.regions.find((r) => r.id !== del.id)?.id ?? null); toast('Region deleted'); }} />}
    </>
  );
}
