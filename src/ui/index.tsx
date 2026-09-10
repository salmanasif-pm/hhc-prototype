import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { I, Icon, type IconName } from './icons';
import { initials } from '../domain/format';

// ---------- Buttons ----------
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'success' | 'danger' | 'ghost' | 'subtle' | 'default'; size?: 'sm' | 'md' | 'lg'; icon?: IconName; block?: boolean; solid?: boolean };
export function Button({ variant = 'default', size = 'md', icon, block, solid, className = '', children, type = 'button', ...rest }: BtnProps) {
  const cls = ['btn', variant !== 'default' ? variant : '', size !== 'md' ? size : '', block ? 'block' : '', solid ? 'solid' : '', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}
export function IconButton({ icon, label, size = 'md', ...rest }: { icon: IconName; label: string; size?: 'sm' | 'md' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`btn icon ${size === 'sm' ? 'sm' : ''}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
}
export function LinkButton({ to, variant = 'default', size = 'md', icon, children, className = '' }: { to: string; variant?: BtnProps['variant']; size?: BtnProps['size']; icon?: IconName; children: React.ReactNode; className?: string }) {
  const cls = ['btn', variant !== 'default' ? variant : '', size !== 'md' ? size : '', className].filter(Boolean).join(' ');
  return (
    <Link to={to} className={cls}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </Link>
  );
}

// ---------- Pills ----------
export type Tone = 'gray' | 'blue' | 'navy' | 'green' | 'amber' | 'red' | 'periwinkle' | 'outline';
export function Pill({ tone = 'gray', dot, sm, children, title }: { tone?: Tone; dot?: boolean; sm?: boolean; children: React.ReactNode; title?: string }) {
  return <span className={`pill ${tone} ${dot ? 'dot' : ''} ${sm ? 'sm' : ''}`} title={title}>{children}</span>;
}
export function Tag({ kind, children }: { kind?: 'agency' | 'emr' | 'insurance' | 'discipline' | 'type'; children: React.ReactNode }) {
  return <span className={`tag ${kind ?? ''}`}>{children}</span>;
}
export function Avatar({ name, tone, size }: { name: string; tone?: 'green' | 'navy' | 'system'; size?: 'sm' | 'lg' }) {
  return <span className={`avatar ${tone ?? ''} ${size ?? ''}`} aria-hidden>{name === 'System' ? '⚙' : initials(name)}</span>;
}

// ---------- Layout ----------
export function PageHead({ title, lede, crumbs, actions, children }: { title: React.ReactNode; lede?: React.ReactNode; crumbs?: { to?: string; label: string }[]; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div className="titles">
        {crumbs && (
          <div className="crumbs">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <I.chevronRight size={12} />}
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
              </React.Fragment>
            ))}
          </div>
        )}
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {children}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
export function Card({ title, actions, children, className = '', pad = true, footer }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean; footer?: React.ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {actions && <div className="row wrap">{actions}</div>}
        </div>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
      {footer && <div className="card-foot">{footer}</div>}
    </section>
  );
}
export function Stat({ label, value, hint, tone, to }: { label: string; value: React.ReactNode; hint?: string; tone?: 'warn' | 'danger' | 'ok'; to?: string }) {
  const inner = (
    <>
      <span className="label">{label}</span>
      <span className={`value ${tone ?? ''}`}>{value}</span>
      {hint && <span className="hint">{hint}</span>}
    </>
  );
  return to ? <Link to={to} className="stat">{inner}</Link> : <div className="stat">{inner}</div>;
}
export function Callout({ tone = 'info', icon, children }: { tone?: 'info' | 'warn' | 'danger' | 'success' | 'neutral'; icon?: IconName; children: React.ReactNode }) {
  const ic: IconName = icon ?? (tone === 'warn' ? 'alert' : tone === 'danger' ? 'alert' : tone === 'success' ? 'check' : 'info');
  return (
    <div className={`callout ${tone}`}>
      <Icon name={ic} size={16} />
      <div className="grow">{children}</div>
    </div>
  );
}
export function Empty({ title, hint, icon = 'list', action }: { title: string; hint?: string; icon?: IconName; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="ico"><Icon name={icon} size={20} /></div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
export function KV({ items, tight }: { items: [React.ReactNode, React.ReactNode][]; tight?: boolean }) {
  return (
    <dl className={`kv ${tight ? 'tight' : ''}`}>
      {items.map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
export function DefGrid({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="def-grid">
      {items.map(([k, v]) => (
        <div key={k}>
          <div className="k">{k}</div>
          <div className="v">{v ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- Tabs ----------
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button key={it.key} role="tab" aria-selected={value === it.key} className={`tab ${value === it.key ? 'active' : ''}`} onClick={() => onChange(it.key)}>
          {it.label}
          {it.count !== undefined && <span className="n">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Segmented<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string }[] }) {
  return (
    <div className="seg" role="tablist">
      {items.map((it) => (
        <button key={it.key} role="tab" aria-selected={value === it.key} className={value === it.key ? 'active' : ''} onClick={() => onChange(it.key)}>{it.label}</button>
      ))}
    </div>
  );
}

// ---------- Forms ----------
export function Field({ label, required, help, error, children, className = '' }: { label: React.ReactNode; required?: boolean; help?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label>{label}{required && <span className="req">*</span>}</label>
      {children}
      {error ? <span className="error">{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  );
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { invalid, className = '', ...rest } = props;
  return <input className={`input ${invalid ? 'invalid' : ''} ${className}`} {...rest} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  const { invalid, className = '', ...rest } = props;
  return <textarea className={`input ${invalid ? 'invalid' : ''} ${className}`} {...rest} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  const { invalid, className = '', children, ...rest } = props;
  return <select className={`input ${invalid ? 'invalid' : ''} ${className}`} {...rest}>{children}</select>;
}
export function Check({ label, checked, onChange, disabled }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
export function Toggle({ label, checked, onChange, disabled }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span>{label}</span>
    </label>
  );
}
export function Chips({ options, value, onChange, single }: { options: string[]; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button type="button" key={o} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(single ? [o] : on ? value.filter((x) => x !== o) : [...value, o])}>
            {o}
            {on && !single && <I.x size={12} className="x" />}
          </button>
        );
      })}
    </div>
  );
}
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="search">
      <I.search size={16} className="muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Search'} aria-label={placeholder ?? 'Search'} />
      {value && <button type="button" className="btn icon sm ghost" onClick={() => onChange('')} aria-label="Clear"><I.x size={14} /></button>}
    </label>
  );
}
// Simulated file picker: we never read file contents, only the name.
export function FilePick({ value, onChange, accept = '.pdf,.jpg,.jpeg,.png', hint }: { value?: string; onChange: (name: string | undefined) => void; accept?: string; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={`upload ${value ? 'has' : ''}`} onClick={() => ref.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && ref.current?.click()}>
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => onChange(e.target.files?.[0]?.name)} />
      <div className="row" style={{ justifyContent: 'center' }}>
        <Icon name={value ? 'check' : 'upload'} size={16} />
        <span>{value ? value : hint ?? 'Choose a PDF or image (max 10 MB)'}</span>
      </div>
      {!value && <div className="small" style={{ marginTop: 4 }}>Simulated upload - only the file name is stored in this prototype.</div>}
    </div>
  );
}

// ---------- Modal / Drawer ----------
export function Modal({ title, onClose, children, footer, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
export function Drawer({ title, onClose, children, footer, sub }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <div className="small muted">{sub}</div>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </aside>
    </div>
  );
}
export function Confirm({ title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: { title: string; body: React.ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title={title} onClose={onCancel} footer={<><Button onClick={onCancel}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} solid={danger} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div>{body}</div>
    </Modal>
  );
}

// ---------- Toasts ----------
interface ToastItem { id: number; text: string; tone?: 'success' | 'error' | 'info' }
const ToastCtx = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone?: ToastItem['tone']) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3600);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone ?? ''}`}>
            <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'success' ? 'check' : 'info'} size={15} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  return useContext(ToastCtx);
}

// ---------- Timeline ----------
export function Timeline({ items }: { items: { at: string; who: string; text: string }[] }) {
  if (items.length === 0) return <p className="muted small">No history yet.</p>;
  return (
    <ul className="timeline">
      {[...items].sort((a, b) => b.at.localeCompare(a.at)).map((it, i) => (
        <li key={i}>
          <span className="dot" />
          <div>
            <div>{it.text}</div>
            <div className="when">{it.who} · {new Date(it.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
export function Steps({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="steps">
      {labels.map((l, i) => (
        <React.Fragment key={l}>
          {i > 0 && <span className="ln" />}
          <div className={`s ${i === current ? 'on' : ''} ${i < current ? 'done' : ''}`}>
            <span className="c">{i < current ? <I.check size={12} /> : i + 1}</span>
            <span>{l}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
export { Icon, I };
