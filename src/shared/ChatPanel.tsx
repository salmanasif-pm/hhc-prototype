import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLookups, useStore } from '../store/store';
import { Avatar, Button, Empty, I, Pill, SearchBox, Tag, Textarea, useToast } from '../ui';
import { fmtDateTime, fmtRelative } from '../domain/format';
import type { Conversation } from '../domain/types';
import { CHANNEL_LABEL } from '../domain/labels';

export function unreadCount(conv: Conversation, userId: string): number {
  const last = conv.lastReadAt[userId];
  return conv.messages.filter((m) => m.authorId !== userId && (!last || m.at > last)).length;
}

export function ChatPanel({ activeId, basePath, patientLink }: { activeId?: string; basePath: string; patientLink: (patientId: string) => string }) {
  const { state, actions, me, role } = useStore();
  const L = useLookups();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [side, setSide] = useState<'patients' | 'channels'>('patients');
  const [draft, setDraft] = useState('');
  const [attach, setAttach] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const mine = useMemo(() => state.conversations.filter((c) => me && c.memberIds.includes(me.id)), [state.conversations, me]);
  const patients = mine.filter((c) => c.kind === 'patient').filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const channels = mine.filter((c) => c.kind === 'channel').filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const lastAt = (c: Conversation) => c.messages[c.messages.length - 1]?.at ?? '';
  const sortByLast = (a: Conversation, b: Conversation) => lastAt(b).localeCompare(lastAt(a));
  const active = mine.find((c) => c.id === activeId);

  useEffect(() => {
    if (active && me) actions.markConversationRead(active.id, me.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.messages.length, me?.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [active?.id, active?.messages.length]);
  useEffect(() => { if (active) setSide(active.kind === 'patient' ? 'patients' : 'channels'); }, [active?.id, active?.kind]);

  const send = () => {
    if (!active || !draft.trim()) return;
    actions.sendMessage(active.id, draft.trim(), attach);
    setDraft(''); setAttach(undefined);
    toast('Message sent', 'success');
  };
  const patient = active?.patientId ? L.patient(active.patientId) : undefined;
  const agency = patient ? L.agency(patient.agencyId) : undefined;
  const req = patient ? state.requests.find((r) => r.patientId === patient.id && r.status === 'assigned') : undefined;
  const visit = req ? L.visitForRequest(req.id) : undefined;

  const renderItem = (c: Conversation) => {
    const n = me ? unreadCount(c, me.id) : 0;
    const last = c.messages[c.messages.length - 1];
    return (
      <Link key={c.id} to={`${basePath}/${c.id}`} className={`conv-item ${c.id === activeId ? 'active' : ''}`}>
        <Avatar name={c.kind === 'patient' ? c.name : (CHANNEL_LABEL[c.channelType!] ?? c.name)} tone={c.kind === 'patient' ? 'navy' : 'green'} size="sm" />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="t"><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>{n > 0 && <span className="unread">{n}</span>}</div>
          <div className="p">{last ? `${L.userName(last.authorId).split(' ')[0]}: ${last.body}` : 'No messages yet'}</div>
        </div>
      </Link>
    );
  };

  return (
    <div className="chat-layout">
      <div className={`chat-side ${active ? 'hidden-m' : ''}`}>
        <div className="hdr">
          <div className="seg" style={{ alignSelf: 'stretch', display: 'flex' }}>
            <button className={side === 'patients' ? 'active' : ''} style={{ flex: 1 }} onClick={() => setSide('patients')}>Patients ({patients.length})</button>
            <button className={side === 'channels' ? 'active' : ''} style={{ flex: 1 }} onClick={() => setSide('channels')}>Channels ({channels.length})</button>
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Search conversations" />
        </div>
        <div className="lst">
          {side === 'patients' ? (
            patients.length ? patients.sort(sortByLast).map(renderItem) : <Empty title="No patient conversations" hint={role === 'clinician' ? 'A patient chat opens when you are assigned.' : 'A patient chat opens automatically on assignment.'} icon="chat" />
          ) : (
            <>
              {(['announcements', 'intake', 'hr', 'billing', 'medical_records'] as const).map((type) => {
                const list = channels.filter((c) => c.channelType === type).sort(sortByLast);
                if (!list.length) return null;
                return (
                  <div key={type}>
                    <div className="grp-lbl">{CHANNEL_LABEL[type]}</div>
                    {list.map(renderItem)}
                  </div>
                );
              })}
              {!channels.length && <Empty title="No channels" icon="chat" />}
            </>
          )}
        </div>
      </div>
      <div className={`chat-main ${!active ? 'hidden-m' : ''}`}>
        {!active ? (
          <Empty title="Select a conversation" hint="Patient chats are shared with the assigned clinician and the intake team. Department channels keep HR, Billing, Intake and Medical Records conversations organized." icon="chat" />
        ) : (
          <>
            <div className="chat-head">
              <div className="row">
                <button className="btn icon sm" style={{ display: 'none' }} aria-hidden />
                <Button size="sm" variant="ghost" icon="chevronLeft" className="only-mobile" onClick={() => nav(basePath)}>Back</Button>
                <Avatar name={active.kind === 'patient' ? active.name : CHANNEL_LABEL[active.channelType!]} tone={active.kind === 'patient' ? 'navy' : 'green'} />
                <div>
                  <h2 style={{ fontSize: 15 }}>{active.name}</h2>
                  <div className="small muted">{active.memberIds.length} members · {active.kind === 'patient' ? 'Patient conversation' : `${CHANNEL_LABEL[active.channelType!]} channel`}{active.channelType === 'announcements' && role === 'clinician' ? ' · read-only' : ''}</div>
                </div>
              </div>
              <div className="row wrap">
                {patient && <Link to={patientLink(patient.id)} className="btn sm"><I.user size={14} /> Open patient</Link>}
                {req && role === 'office' && <Link to={`/office/scheduling/requests/${req.id}`} className="btn sm"><I.layers size={14} /> Request</Link>}
              </div>
            </div>
            {patient && (
              <div className="chat-ctx">
                <span><b>Agency</b> {agency?.name}</span>
                <span><b>EMR</b> <Tag kind="emr">{agency?.emrDomain}</Tag></span>
                <span><b>Insurance</b> {patient.insurance}</span>
                <span><b>Address</b> {role === 'clinician' && !req ? `${patient.address.city} ${patient.address.zip}` : `${patient.address.street}, ${patient.address.city} ${patient.address.zip}`}</span>
                {req && <span><b>Assigned</b> {L.userName(req.assignedClinicianId)}</span>}
                {visit && <span><b>Visit</b> {visit.plannedDate ?? 'unscheduled'} · {visit.plotStatus === 'plotted' ? 'plotted' : visit.plotStatus.replace('_', ' ')}</span>}
              </div>
            )}
            <div className="chat-msgs">
              {active.messages.length === 0 && <div className="muted small" style={{ textAlign: 'center' }}>No messages yet. Start the conversation.</div>}
              {active.messages.map((m) => {
                const mine = m.authorId === me?.id;
                const sys = m.authorId === 'system';
                const author = L.user(m.authorId);
                return (
                  <div key={m.id} className={`msg ${mine ? 'mine' : ''} ${sys ? 'sys' : ''}`}>
                    {!sys && <Avatar name={L.userName(m.authorId)} tone={author?.role === 'clinician' ? 'green' : 'navy'} size="sm" />}
                    <div>
                      {!sys && <div className="who"><span>{L.userName(m.authorId)}{author?.title ? ` | ${author.title}` : author?.disciplines?.length ? ` | ${author.disciplines.join('/')}` : ''}</span><span title={fmtDateTime(m.at)}>{fmtRelative(m.at)}</span></div>}
                      <div className="bubble">
                        {m.body}
                        {m.attachmentName && <div className="att"><I.paperclip size={13} /> {m.attachmentName}</div>}
                        {sys && <div className="small" style={{ marginTop: 2 }}>{fmtDateTime(m.at)}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            {active.channelType === 'announcements' && role === 'clinician' ? (
              <div className="chat-compose"><Pill tone="outline">Announcements are read-only for clinicians</Pill></div>
            ) : (
              <div className="chat-compose">
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => setAttach(e.target.files?.[0]?.name)} />
                <Button variant="subtle" icon="paperclip" onClick={() => fileRef.current?.click()} title="Attach a file (simulated)">{attach ? attach.slice(0, 14) : ''}</Button>
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${active.name}`} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Message" />
                <Button variant="primary" icon="send" onClick={send} disabled={!draft.trim()}>Send</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
export const _r = React;
