import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Button, Card, Empty, LinkButton, PageHead, SearchBox, Select, Tabs, Tag, useToast } from '../ui';
import { RequestPill } from '../shared/pills';
import { fmtCountdown, fmtRelative, hoursUntil } from '../domain/format';
import { isExpiringSoon, responseSummary } from '../domain/rules';
import { DISCIPLINES } from '../domain/labels';
import type { VisitRequest } from '../domain/types';
import { downloadText, toCsv } from '../domain/csv';

type Tab = 'pending' | 'assigned' | 'closed' | 'draft';

export function RequestCard({ req }: { req: VisitRequest }) {
  const L = useLookups();
  const p = L.patient(req.patientId)!;
  const a = L.agency(req.agencyId)!;
  const vt = L.visitType(req.visitTypeCode)!;
  const sum = responseSummary(req);
  const last = req.log[req.log.length - 1];
  const hot = isExpiringSoon(req);
  const expired = req.status === 'pending' && hoursUntil(req.visitBy) <= 0;
  return (
    <Link to={`/office/scheduling/requests/${req.id}`} className="req-card">
      <div className={`expiry ${hot || expired ? 'hot' : req.status === 'assigned' ? 'done' : ''}`}>
        <div className="lbl">{req.status === 'pending' ? (expired ? 'Visit-by' : 'Expires in') : req.status === 'assigned' ? 'Assigned' : 'Visit by'}</div>
        <div className="val">{req.status === 'pending' ? (expired ? 'Passed' : fmtCountdown(req.visitBy)) : req.status === 'assigned' ? '✓' : new Date(req.visitBy).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <Tag kind="discipline">{req.discipline}</Tag>
          <Tag kind="type">{vt.short}</Tag>
          <span className="name">{p.firstName} {p.lastName}</span>
        </div>
        <div className="meta">
          <Tag kind="agency">{a.name}</Tag>
          <Tag kind="insurance">{p.insurance}</Tag>
          <Tag kind="emr">{a.emrDomain}</Tag>
          <span className="tag">{p.address.city} {p.address.zip}</span>
        </div>
        <div className="notes">Notes: {req.notesToClinicians || '—'}</div>
      </div>
      <div className="side">
        <RequestPill req={req} />
        {req.status === 'pending' && (
          <div className="resp-counts">
            <span>Available <b>{sum.available}</b></span>
            <span>Waiting <b>{sum.read + sum.waiting}</b></span>
            {sum.queued > 0 && <span>Queued <b>{sum.queued}</b></span>}
          </div>
        )}
        {req.status === 'pending' && req.groups.length > 1 && (
          <div className="groups" title={`${req.groups.filter((g) => g.releasedAt).length} of ${req.groups.length} priority groups released`}>
            {req.groups.map((g, i) => (<React.Fragment key={g.no}>{i > 0 && <span className="ln" />}<span className={`g ${g.releasedAt ? 'on' : ''}`} /></React.Fragment>))}
          </div>
        )}
        {req.assignedClinicianId && <span className="small strong">{L.userName(req.assignedClinicianId)}</span>}
        {last && <span className="small muted">{last.text.length > 48 ? last.text.slice(0, 48) + '…' : last.text} · {fmtRelative(last.at)}</span>}
      </div>
    </Link>
  );
}

export function RequestsPage() {
  const { state } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('pending');
  const [q, setQ] = useState('');
  const [disc, setDisc] = useState('');
  const [agency, setAgency] = useState('');
  const [sort, setSort] = useState<'created' | 'visitBy'>('created');

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return state.requests
      .filter((r) => r.status === tab)
      .filter((r) => !disc || r.discipline === disc)
      .filter((r) => !agency || r.agencyId === agency)
      .filter((r) => {
        if (!ql) return true;
        const p = L.patient(r.patientId)!;
        const a = L.agency(r.agencyId)!;
        return [`${p.firstName} ${p.lastName}`, p.mrn ?? '', a.name, r.discipline, r.visitTypeCode, L.userName(r.assignedClinicianId), p.address.city, p.address.zip].join(' ').toLowerCase().includes(ql);
      })
      .sort((x, y) => (sort === 'created' ? y.createdAt.localeCompare(x.createdAt) : x.visitBy.localeCompare(y.visitBy)));
  }, [state.requests, tab, q, disc, agency, sort, L]);

  const counts = (s: Tab) => state.requests.filter((r) => r.status === s).length;
  const exportCsv = () => {
    const rows: (string | number)[][] = [['Request', 'Patient', 'City', 'ZIP', 'Agency', 'Discipline', 'Visit type', 'Visit by', 'Status', 'Assigned clinician', 'Created']];
    for (const r of filtered) {
      const p = L.patient(r.patientId)!;
      rows.push([r.id, `${p.lastName}, ${p.firstName}`, p.address.city, p.address.zip, L.agency(r.agencyId)!.name, r.discipline, r.visitTypeCode, r.visitBy.slice(0, 16), r.status + (r.closedReason ? ` (${r.closedReason})` : ''), L.userName(r.assignedClinicianId), r.createdAt.slice(0, 10)]);
    }
    downloadText(`visit-requests-${tab}.csv`, toCsv(rows));
    toast(`Exported ${filtered.length} request(s)`, 'success');
  };

  return (
    <>
      <PageHead title="Request Management" lede="Visit requests from referral to assignment. Pending requests expire at the visit-by time; unstaffed and expiring requests are highlighted." actions={<><Button icon="download" onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button><LinkButton to="/office/scheduling/requests/new" variant="primary" icon="plus">New request</LinkButton></>} />
      <div className="filters">
        <SearchBox value={q} onChange={setQ} placeholder="Search patient, MRN, agency, clinician, city or ZIP" />
        <Select value={disc} onChange={(e) => setDisc(e.target.value)} aria-label="Discipline"><option value="">All disciplines</option>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</Select>
        <Select value={agency} onChange={(e) => setAgency(e.target.value)} aria-label="Agency"><option value="">All agencies</option>{state.agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as 'created' | 'visitBy')} aria-label="Sort"><option value="created">Sort: Time created</option><option value="visitBy">Sort: Visit by</option></Select>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ key: 'pending', label: 'Pending', count: counts('pending') }, { key: 'assigned', label: 'Assigned', count: counts('assigned') }, { key: 'closed', label: 'Closed', count: counts('closed') }, { key: 'draft', label: 'Drafts', count: counts('draft') }]} />
      <Card pad={false}>
        {filtered.length === 0 ? (
          <Empty title={`No ${tab} requests`} hint={tab === 'pending' ? 'New requests appear here once sent to clinicians.' : 'Adjust the filters or create a new request.'} icon="layers" action={tab === 'pending' ? <LinkButton to="/office/scheduling/requests/new" variant="primary" icon="plus">New request</LinkButton> : undefined} />
        ) : (
          filtered.map((r) => <RequestCard key={r.id} req={r} />)
        )}
      </Card>
    </>
  );
}
