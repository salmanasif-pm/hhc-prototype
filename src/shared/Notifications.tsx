import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { Button, I } from '../ui';
import { fmtRelative } from '../domain/format';

export function NotificationBell() {
  const { state, actions, me } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mine = state.notifications.filter((n) => n.userId === me?.id).slice(0, 12);
  const unread = mine.filter((n) => !n.read).length;
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="nav-user" style={{ padding: 6 }} onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <I.bell size={16} />
        {unread > 0 && <span className="count" style={{ background: 'var(--coral)', color: 'var(--navy)', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '0 6px' }}>{unread}</span>}
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: 40, width: 340, zIndex: 40, color: 'var(--text)' }}>
          <div className="card-head"><h3>Notifications</h3>{unread > 0 && me && <Button size="sm" variant="ghost" onClick={() => actions.markNotificationsRead(me.id)}>Mark all read</Button>}</div>
          <div className="list" style={{ maxHeight: 360, overflowY: 'auto' }}>
            {mine.length === 0 && <div className="empty small">You are all caught up.</div>}
            {mine.map((n) => (
              <button key={n.id} className="list-item click" style={{ textAlign: 'left', border: 0, background: n.read ? 'transparent' : 'var(--blue-soft)', width: '100%' }} onClick={() => { setOpen(false); nav(n.link); }}>
                <div className="main">
                  <div style={{ fontSize: 13 }}>{n.text}</div>
                  <div className="sub">{fmtRelative(n.at)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export const _r = React;
