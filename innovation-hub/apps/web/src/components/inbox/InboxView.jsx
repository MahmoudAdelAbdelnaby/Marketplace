import React, { useEffect, useState } from 'react';
import { Inbox, HandHeart, CalendarClock, Download } from 'lucide-react';
import { api } from '../../api';

const KIND = {
  sponsor: { label: 'Sponsorship', icon: HandHeart, c: '#00737f' },
  adopt: { label: 'Adoption', icon: Download, c: '#00897b' },
  meeting: { label: 'Meeting request', icon: CalendarClock, c: '#ff8400' },
};
const ago = (t) => { const d = Math.floor((Date.now() / 1000 - t) / 86400); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`; };

export default function InboxView() {
  const [items, setItems] = useState([]);
  useEffect(() => { api('/alerts').then(setItems).catch(() => {}); }, []);

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><Inbox /> Requests inbox</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Adopt / sponsor / meeting requests on your tools. Reach out and set up a discussion.</p>
      {items.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No requests yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((a) => {
          const k = KIND[a.kind] || KIND.sponsor; const I = k.icon;
          return (
            <div key={a.id} style={{ display: 'flex', gap: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, background: k.c + '1f', color: k.c, flexShrink: 0 }}><I size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{k.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>on <b>{a.tool_name}</b></span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>{ago(a.created_at)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>from {a.user_name}</div>
                {a.note && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', background: 'var(--secondary)', borderRadius: 8, padding: '6px 10px' }}>{a.note}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
