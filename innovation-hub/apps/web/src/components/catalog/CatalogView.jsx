import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronLeft, ChevronRight, Sparkles, X, Layers } from 'lucide-react';
import { useCatalogStore } from '../../store/useCatalogStore';
import ToolForm from './ToolForm';
import BrandShapes from '../ui/BrandShapes';
import { api } from '../../api';

const STATUS_STYLE = {
  implemented: { bg: 'rgba(37,226,204,0.15)', fg: '#00897b' },
  not_implemented: { bg: 'rgba(255,132,0,0.15)', fg: '#ff8400' },
  '3rd_party': { bg: 'rgba(147,51,234,0.15)', fg: '#9333ea' },
};
const fmtMoney = (n) => (n ? '$' + Math.round(n).toLocaleString() : null);

const SECTIONS = [
  { id: 'IX Suite', label: 'IX Suite', hint: 'Core suite solutions' },
  { id: 'Tech Infusion', label: 'Tech Infusion', hint: 'Tools infused with new technology' },
  { id: 'Innovations Hub', label: 'Innovations Hub', hint: 'Experimental and innovative products' },
];

function ClientTags({ accountString, variant = 'card' }) {
  const [showAll, setShowAll] = useState(false);
  if (!accountString) return null;
  const clients = accountString.split(',').map(acc => acc.trim()).filter(Boolean);
  if (clients.length === 0) return null;
  const displayCount = variant === 'carousel' ? 1 : 2;
  const displayClients = clients.slice(0, displayCount);
  const extraCount = clients.length - displayCount;

  const isCard = variant === 'card';
  const tagStyle = isCard 
    ? { fontSize: 11, fontWeight: 600, color: 'var(--primary-text)', background: 'var(--secondary)', borderRadius: 999, padding: '4px 10px' }
    : { fontSize: '10px', fontWeight: 700, color: 'var(--primary-text)', background: 'var(--secondary)', padding: '2px 6px', borderRadius: '4px' };

  return (
    <>
      {displayClients.map((acc, idx) => (
        <span key={idx} style={tagStyle}>
          @ {acc}
        </span>
      ))}
      {extraCount > 0 && (
        <button 
          onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
          style={{ ...tagStyle, background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          +{extraCount} more
        </button>
      )}

      {showAll && (
        <div 
          onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,38,50,0.4)', display: 'grid', placeItems: 'center', padding: 20 }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-card-solid)', padding: 24, borderRadius: 16, width: 320, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Deployed Clients</h3>
              <button onClick={() => setShowAll(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {clients.map((acc, idx) => (
                <span key={idx} style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-text)', background: 'var(--secondary)', borderRadius: 999, padding: '6px 12px' }}>
                  @ {acc}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CardPreview({ t }) {
  const [html, setHtml] = useState('');
  const getDemo = useCatalogStore((s) => s.getDemo);
  
  useEffect(() => {
    if (!t.img_url && !t.demo_url && t.hasDemo) {
      getDemo(t.id).then(setHtml).catch(() => {});
    }
  }, [t.id, t.img_url, t.demo_url, t.hasDemo, getDemo]);

  if (t.img_url) {
    return <img src={t.img_url} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (t.demo_url) {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', background: 'var(--bg-card)' }}>
        <iframe 
          src={t.demo_url} 
          title="demo-preview"
          style={{ width: '360px', height: '440px', border: 'none', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none' }} 
        />
      </div>
    );
  }
  if (t.hasDemo && html) {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', background: 'var(--bg-card)' }}>
        <iframe 
          srcDoc={html} 
          title="demo-preview"
          style={{ width: '360px', height: '440px', border: 'none', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none' }} 
        />
      </div>
    );
  }
  return (
    <div style={{ 
      width: '100%', height: '100%', 
      background: t.hasDemo 
        ? 'linear-gradient(135deg, var(--deep), var(--primary))' 
        : 'linear-gradient(135deg, var(--primary), var(--accent))'
    }} />
  );
}

function ToolCard({ t, onOpen, compareIds, onToggleCompare, compareMode }) {
  let safeStatus = t.implementation_status || 'not_implemented';
  if (safeStatus === 'third_party') safeStatus = '3rd_party';
  
  const s = STATUS_STYLE[safeStatus] || STATUS_STYLE.active;
  const isSelected = compareIds.includes(t.id);
  const safeName = t.name || 'Untitled';
  
  let headerBg = '';
  if (safeStatus === 'not_implemented') {
    headerBg = 'linear-gradient(135deg, #ff9800, #ff5722)';
  } else if (safeStatus === 'implemented') {
    headerBg = 'linear-gradient(135deg, #25e2cc, #00897b)';
  } else if (safeStatus === '3rd_party') {
    headerBg = 'linear-gradient(135deg, #c084fc, #9333ea)';
  } else {
    const hue = (safeName.length * 25) % 360;
    headerBg = t.hasDemo
      ? `linear-gradient(135deg, hsl(${hue}, 70%, 40%), hsl(${hue + 40}, 80%, 30%))`
      : `linear-gradient(135deg, hsl(${hue}, 40%, 90%), hsl(${hue + 40}, 50%, 85%))`;
  }

  return (
    <div className="card-hover" onClick={onOpen} style={{ background: 'var(--bg-card)', border: (compareMode && isSelected) ? '2px solid var(--primary)' : '1px solid var(--border-color)', borderRadius: 16, display: 'flex', flexDirection: 'column', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
      <div style={{ height: 13, width: '100%', background: headerBg, flexShrink: 0 }} />
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {compareMode && (
          <input 
            type="checkbox" 
            checked={isSelected}
            onClick={(e) => e.stopPropagation()} 
            onChange={() => onToggleCompare(t.id)} 
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--primary-text)' }}>{t.category || 'Tool'}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', borderRadius: 6, padding: '3px 8px', background: s?.bg, color: s?.fg }}>{safeStatus.replace('_', ' ')}</span>
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{safeName}</h3>
      {t.badges && t.badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '2px 0' }}>
          {t.badges.map((b, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--secondary)', border: '1px solid rgba(0,115,127,0.15)', borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: 'var(--primary-text)' }}>
              {b.img_url && <img src={b.img_url} style={{ width: 11, height: 11, borderRadius: '50%', objectFit: 'cover' }} alt="" />}
              {b.title}
            </span>
          ))}
        </div>
      )}
      {t.impact && <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--primary-text)' }}>★ {t.impact}</div>}
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.problem}</div>
      {t.account && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          <ClientTags accountString={t.account} variant="card" />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--badge-fg-owner)', background: 'rgba(255,132,0,0.14)', borderRadius: 999, padding: '4px 10px' }}>{t.owner}</span>
        {fmtMoney(t.roi) && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>{fmtMoney(t.roi)}/yr</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: 'var(--primary-text)', cursor: 'pointer' }}>View Details &rarr;</span>
      </div>
      </div>
    </div>
  );
}

function FeaturedCarousel({ tools, onOpen, carouselSort, setCarouselSort }) {
  const carouselRef = React.useRef(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const isDown = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);
  const dragDistance = React.useRef(0);
  const isUserActive = React.useRef(false);
  const isChevronScrolling = React.useRef(false);

  const scrollSpeedRef = React.useRef(0);
  const currentSpeedRef = React.useRef(0);
  const animationFrameId = React.useRef(null);

  const playDirectionRef = React.useRef(0.6); // 0.6 or -0.6

  const scroll = (direction) => {
    if (carouselRef.current) {
      isChevronScrolling.current = true;
      scrollSpeedRef.current = 0;
      currentSpeedRef.current = 0;

      const scrollAmount = direction === 'left' ? -560 : 560;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });

      setTimeout(() => {
        isChevronScrolling.current = false;
      }, 600);
    }
  };

  const updateScroll = () => {
    const container = carouselRef.current;
    if (container) {
      if (!isChevronScrolling.current) {
        if (!isUserActive.current && !isDown.current) {
          scrollSpeedRef.current = 0;
        }

        currentSpeedRef.current += (scrollSpeedRef.current - currentSpeedRef.current) * 0.15;

        if (Math.abs(currentSpeedRef.current) > 0.02) {
          container.scrollLeft += currentSpeedRef.current;
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(updateScroll);
  };

  const handleMouseDown = (e) => {
    isDown.current = true;
    isUserActive.current = true;
    startX.current = e.pageX - carouselRef.current.offsetLeft;
    scrollLeft.current = carouselRef.current.scrollLeft;
    dragDistance.current = 0;
    scrollSpeedRef.current = 0;
    currentSpeedRef.current = 0;
  };

  const handleMouseLeave = () => {
    isDown.current = false;
    isUserActive.current = false;
    scrollSpeedRef.current = 0;
  };

  const handleMouseEnter = () => {
    isUserActive.current = true;
  };

  const handleMouseUp = () => {
    isDown.current = false;
  };

  const handleMouseMove = (e) => {
    isUserActive.current = true;

    const container = carouselRef.current;
    if (!container) return;

    if (isDown.current) {
      e.preventDefault();
      const walkX = e.pageX - container.offsetLeft;
      const walk = (walkX - startX.current) * 1.5;
      dragDistance.current = Math.abs(walk);
      container.scrollLeft = scrollLeft.current - walk;
      scrollSpeedRef.current = 0;
      currentSpeedRef.current = 0;
    }
  };

  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(updateScroll);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  if (!tools || tools.length === 0) return null;

  return (
    <div style={{ marginTop: '2.5rem', marginBottom: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: 'var(--warning)', fill: 'var(--warning)' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, margin: 0 }}>Featured Solutions</h2>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={carouselSort}
            onChange={(e) => setCarouselSort(e.target.value)}
            style={{
              height: '36px', padding: '0 12px', borderRadius: '8px', boxSizing: 'border-box',
              fontSize: 12.5, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)',
              width: 140, cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="newest">Newest First</option>
            <option value="roi_desc">ROI: High to Low</option>
            <option value="votes_desc">Most Popular</option>
            <option value="name_asc">Name: A-Z</option>
          </select>
          <button 
            onClick={() => scroll('left')} 
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              width: '36px', height: '36px', borderRadius: '50%', 
              border: '1px solid var(--border-color)', background: 'var(--bg-card)', 
              color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' 
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={() => scroll('right')} 
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              width: '36px', height: '36px', borderRadius: '50%', 
              border: '1px solid var(--border-color)', background: 'var(--bg-card)', 
              color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' 
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div 
        ref={carouselRef}
        onScroll={(e) => {
          const scrollLeft = e.target.scrollLeft;
          const index = Math.round(scrollLeft / 560);
          if (index !== activeIndex) {
            setActiveIndex(index);
          }
        }}
        onWheel={(e) => {
          // Allow natural scroll, do not preventDefault
          if (e.deltaX !== 0) {
            carouselRef.current.scrollLeft += e.deltaX;
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          display: 'flex',
          gap: '20px',
          overflowX: 'auto',
          padding: '20px 4px 30px',
          paddingLeft: '0px',
          paddingRight: '0px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: 'grab'
        }}
      >
        {tools.map((t) => (
          <div
            key={t.id}
            onClick={(e) => {
              if (dragDistance.current > 6) {
                e.preventDefault();
                return;
              }
              onOpen(t.id);
            }}
            className="card-hover glass"
            style={{
              flex: '0 0 auto',
              width: '540px',
              height: '220px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'row',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {/* Left Preview Column */}
            <div style={{ width: '180px', height: '100%', flexShrink: 0, position: 'relative', borderRight: '1px solid var(--border-color)' }}>
              <CardPreview t={t} />
            </div>

            {/* Right Details Column */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--primary-text)' }}>
                  {t.category}
                </span>
                <span style={{ 
                  marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, 
                  letterSpacing: '.07em', textTransform: 'uppercase', borderRadius: '6px', 
                  padding: '2px 6px', background: 'rgba(0,137,123,0.14)', color: 'var(--success-text)' 
                }}>
                  {t.status}
                </span>
              </div>

              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.name}
              </h3>
              
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {t.problem}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Owner</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', whiteSpace: 'nowrap' }}>
                      {t.owner}
                    </span>
                    <ClientTags accountString={t.account} variant="carousel" />
                  </div>
                </div>
                {t.roi > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Savings</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                      ${Math.round(t.roi).toLocaleString()}/yr
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '-12px', paddingBottom: '12px' }}>
        {tools.map((_, i) => (
          <div 
            key={i} 
            onClick={() => {
              if (carouselRef.current) {
                carouselRef.current.scrollTo({ left: i * 560, behavior: 'smooth' });
              }
            }}
            style={{
              width: activeIndex === i ? '16px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: activeIndex === i ? 'var(--primary)' : 'var(--border-color)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function CatalogView() {
  const nav = useNavigate();
  const { tools, query, activeCategory, setQuery, setCategory, categories, filtered, loading, load } = useCatalogStore();
  const [adding, setAdding] = useState(false);
  const [secQueries, setSecQueries] = useState({});
  const [secStatusFilter, setSecStatusFilter] = useState({});
  const [secDeptFilter, setSecDeptFilter] = useState({});
  const [secSortFilter, setSecSortFilter] = useState({});
  const [carouselSort, setCarouselSort] = useState('newest');
  const [compareIds, setCompareIds] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [activeTab, setActiveTab] = useState(SECTIONS[0].id);

  const toggleCompare = (id) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timers = Object.entries(secQueries).map(([secId, query]) => {
      if (!query.trim()) return null;
      return setTimeout(() => {
        api('/catalog/track-search', {
          method: 'POST',
          body: { query: query.trim() },
          auth: true
        }).catch(() => {});
      }, 1500);
    });

    return () => {
      timers.forEach(t => t && clearTimeout(t));
    };
  }, [secQueries]);
  const list = filtered();
  
  // High impact or pilot tools are featured, sorted by display rank ascending
  const featuredTools = tools.filter(t => t.featured).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ background: 'var(--bg-catalog-hero)', backdropFilter: 'var(--blur-catalog-hero, none)', WebkitBackdropFilter: 'var(--blur-catalog-hero, none)', borderBottom: 'var(--border-catalog-hero, none)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 40px' }}>
      <div style={{ position: 'relative', padding: '20px 0 8px', textAlign: 'center' }}>
        <BrandShapes variant="hero" />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 700, letterSpacing: '-.025em' }}>
            What problem are you <span style={{ color: 'var(--primary-text)' }}>solving</span>?
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Browse the marketplace before you build. Someone may have solved it already.</p>
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 680, margin: '22px auto 0' }}>
        <Search size={17} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “KPI”, “bottleneck”, “churn”…" style={{ width: '100%', padding: '15px 20px 15px 48px', borderRadius: 999, fontSize: 15, background: 'var(--bg-card-solid)' }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center', margin: '18px auto 0', maxWidth: 820 }}>
        {categories().map((c) => (
          <button key={c} onClick={() => setCategory(c)} style={{ border: '1px solid var(--border-color)', borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: c === activeCategory ? 'var(--text-primary)' : 'var(--bg-card-solid)', color: c === activeCategory ? 'var(--bg-card-solid)' : 'var(--text-secondary)' }}>{c}</button>
        ))}
      </div>

      {/* Featured Banner Carousel */}
      {!query && activeCategory === 'All' && (
        <FeaturedCarousel 
          tools={sortedFeatured} 
          onOpen={(id) => nav(`/tools/${id}`)} 
          carouselSort={carouselSort}
          setCarouselSort={setCarouselSort}
        />
      )}
      </div>
      </div>

      <div className="glass catalog-products-bg" style={{ background: 'var(--bg-catalog-products)', backdropFilter: 'var(--blur-catalog-products, none)', WebkitBackdropFilter: 'var(--blur-catalog-products, none)', paddingBottom: '80px', paddingTop: '32px', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <BrandShapes variant="catalog" />
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 6px', gap: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '.05em', textTransform: 'uppercase' }}>{loading ? 'LOADING…' : `${list.length} product${list.length === 1 ? '' : 's'} available`}</div>
        <button 
          onClick={() => {
            setCompareMode(!compareMode);
            if (compareMode) {
              setCompareIds([]);
            }
          }}
          style={{ 
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', 
            borderRadius: 10, border: '1px solid var(--border-color)', 
            background: compareMode ? 'var(--secondary)' : 'var(--bg-card)', 
            color: compareMode ? 'var(--primary)' : 'var(--text-primary)', 
            fontWeight: 600, fontSize: 13.5, cursor: 'pointer' 
          }}
        >
          <Layers size={15} /> {compareMode ? 'Exit Comparison' : 'Compare products'}
        </button>
        <button onClick={() => setAdding(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5 }}>
          <Plus size={16} /> Submit a tool
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
        {SECTIONS.map(sec => {
          const count = list.filter((t) => t.category === sec.id).length;
          const isActive = activeTab === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveTab(sec.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '12px 0', fontSize: '15px', fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s ease',
                marginBottom: '-1px',
                whiteSpace: 'nowrap'
              }}
            >
              {sec.label}
              <span style={{ 
                background: isActive ? 'var(--secondary)' : 'var(--bg-main)', 
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700 
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {SECTIONS.map((sec) => {
        if (sec.id !== activeTab) return null;

        const items = list.filter((t) => t.category === sec.id);
        const sQuery = secQueries[sec.id] || '';
        const sStatus = secStatusFilter[sec.id] || 'All';
        const sDept = secDeptFilter[sec.id] || 'All';
        const sSort = secSortFilter[sec.id] || 'newest';
        
        // Compute unique departments for this section's items
        const departments = ['All', ...new Set(items.map(t => t.department).filter(Boolean))];

        const filteredItems = items.filter((t) => {
          const tImpl = (t.implementation_status === 'third_party') ? '3rd_party' : (t.implementation_status || 'not_implemented');
          if (sStatus !== 'All' && tImpl !== sStatus) return false;
          if (sDept !== 'All' && t.department !== sDept) return false;
          if (!sQuery.trim()) return true;
          const q = sQuery.toLowerCase();
          const hay = [t.name, t.owner, t.department, t.problem, t.status, (t.tags || []).join(' '), t.account || ''].join(' ').toLowerCase();
          return hay.includes(q);
        });

        const sortedItems = [...filteredItems];
        if (sSort === 'roi_desc') {
          sortedItems.sort((a, b) => (b.roi || 0) - (a.roi || 0));
        } else if (sSort === 'roi_asc') {
          sortedItems.sort((a, b) => (a.roi || 0) - (b.roi || 0));
        } else if (sSort === 'name_asc') {
          sortedItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (sSort === 'votes_desc') {
          sortedItems.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        } else {
          sortedItems.sort((a, b) => (b.id || 0) - (a.id || 0));
        }

        if (items.length === 0) return null;
        return (
          <div key={sec.id} style={{ marginTop: 40 }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 28, 
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, margin: 0 }}>
                  {sec.label}
                </h2>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {sec.hint}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

                {/* Section search bar */}
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    value={sQuery}
                    onChange={(e) => setSecQueries({ ...secQueries, [sec.id]: e.target.value })}
                    placeholder={`Search products…`}
                    style={{ 
                      width: '100%', height: '36px', padding: '0 12px 0 30px', borderRadius: '8px', boxSizing: 'border-box',
                      fontSize: 12.5, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)'
                    }}
                  />
                </div>
                
                <select
                  value={sStatus}
                  onChange={(e) => setSecStatusFilter({ ...secStatusFilter, [sec.id]: e.target.value })}
                  style={{
                    height: '36px', padding: '0 12px', borderRadius: '8px', boxSizing: 'border-box',
                    fontSize: 12.5, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)',
                    cursor: 'pointer', outline: 'none'
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="implemented">Already Implemented</option>
                  <option value="not_implemented">Not Yet Implemented</option>
                  <option value="3rd_party">Third Party Resell</option>
                </select>

                {departments.length > 1 && (
                  <select
                    value={sDept}
                    onChange={(e) => setSecDeptFilter({ ...secDeptFilter, [sec.id]: e.target.value })}
                    style={{
                      height: '36px', padding: '0 12px', borderRadius: '8px', boxSizing: 'border-box',
                      fontSize: 12.5, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)',
                      cursor: 'pointer', outline: 'none'
                    }}
                  >
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
                    ))}
                  </select>
                )}

                <select
                  value={sSort}
                  onChange={(e) => setSecSortFilter({ ...secSortFilter, [sec.id]: e.target.value })}
                  style={{
                    height: '36px', padding: '0 12px', borderRadius: '8px', boxSizing: 'border-box',
                    fontSize: 12.5, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)',
                    cursor: 'pointer', outline: 'none'
                  }}
                >
                  <option value="newest">Newest First</option>
                  <option value="roi_desc">ROI: High to Low</option>
                  <option value="roi_asc">ROI: Low to High</option>
                  <option value="votes_desc">Most Popular</option>
                  <option value="name_asc">Name: A-Z</option>
                </select>
              </div>
            </div>
            
            {sortedItems.length === 0 ? (
              <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                No matching products in this section.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
                {[...filteredItems].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((t) => (
                  <ToolCard 
                    key={t.id} 
                    t={t} 
                    onOpen={() => nav(`/tools/${t.id}`)} 
                    compareIds={compareIds}
                    onToggleCompare={toggleCompare}
                    compareMode={compareMode}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {!loading && list.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <b>No matching tool yet</b><br />Nothing here solves this — which means it's safe to build.
        </div>
      )}

      {adding && <ToolForm onClose={() => setAdding(false)} />}

      {/* Floating Compare Bar */}
      {compareIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 90,
          background: 'var(--bg-card-solid)', border: '1.5px solid var(--primary)', borderRadius: 16,
          padding: '12px 24px', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 16,
          backdropFilter: 'blur(8px)'
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>
            {compareIds.length} {compareIds.length === 1 ? 'product' : 'products'} selected
          </span>
          <button 
            disabled={compareIds.length < 2}
            onClick={() => setComparing(true)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff',
              fontWeight: 700, fontSize: 13, cursor: compareIds.length >= 2 ? 'pointer' : 'not-allowed',
              opacity: compareIds.length >= 2 ? 1 : 0.5
            }}
          >
            Compare Now
          </button>
          <button 
            onClick={() => setCompareIds([])}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)',
              color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Comparison Modal */}
      {comparing && (
        <div 
          onClick={() => setComparing(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,38,50,0.45)', backdropFilter: 'blur(6px)',
            zIndex: 100, display: 'grid', placeItems: 'center', padding: '40px 20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(1280px, 95%)', maxHeight: '90vh', background: 'var(--bg-card-solid)',
              borderRadius: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-xl)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, margin: 0 }}>Product Comparison Matrix</h2>
              <button 
                onClick={() => setComparing(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={22} />
              </button>
            </div>
            
            {/* Matrix Body */}
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
                <thead>
                  <tr style={{ borderBottom: '2.5px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, width: 220, color: 'var(--text-muted)' }}>Specification</th>
                    {compareIds.map((id) => {
                      const item = list.find((x) => x.id === id);
                      if (!item) return null;
                      return (
                        <th key={id} style={{ padding: '12px 16px', fontWeight: 800, fontSize: 16, width: 300 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ color: 'var(--primary-text)' }}>{item.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{item.category}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Status & Maturity', fn: (item) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-text)' }}>{item.status.replace('_', ' ')}</span> },
                    { label: 'Owner & Contact', fn: (item) => item.owner },
                    { label: 'Department', fn: (item) => item.department || '—' },
                    { label: 'Deployed Client', fn: (item) => item.account || 'None' },
                    { label: 'Annual ROI Savings', fn: (item) => item.roi ? `$${Math.round(item.roi).toLocaleString()}/yr` : '$0/yr' },
                    { label: 'Awards & Verifications', fn: (item) => (item.badges || []).length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {item.badges.map((b, i) => (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--secondary)', border: '1px solid rgba(0,115,127,0.15)', borderRadius: 12, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, color: 'var(--primary-text)' }}>
                            {b.img_url && <img src={b.img_url} style={{ width: 12, height: 12, borderRadius: '50%', objectFit: 'cover' }} alt="" />}
                            {b.title}
                          </span>
                        ))}
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12.5 }}>None</span> },
                    { label: 'Problem Statement', fn: (item) => <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, minWidth: 220 }}>{item.problem}</div> },
                    { label: 'Capabilities & Features', fn: (item) => (item.capabilities || []).length > 0 ? <ul style={{ paddingLeft: 16, margin: 0, fontSize: 12.5 }}>{item.capabilities.map((c, i) => <li key={i}>{c}</li>)}</ul> : '—' },
                    { label: 'Deliverables', fn: (item) => item.delivers || '—' },
                    { label: 'Expected Benefits', fn: (item) => item.benefits || '—' },
                    { label: 'Actions', fn: (item) => (
                      <button 
                        onClick={() => { setComparing(false); nav(`/tools/${item.id}`); }}
                        style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                      >
                        View Full Details
                      </button>
                    )}
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                      <td style={{ padding: '16px', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</td>
                      {compareIds.map((id) => {
                        const item = list.find((x) => x.id === id);
                        if (!item) return null;
                        return (
                          <td key={id} style={{ padding: '16px', fontSize: 13.5, verticalAlign: 'top', color: 'var(--text-primary)' }}>
                            {row.fn(item)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
