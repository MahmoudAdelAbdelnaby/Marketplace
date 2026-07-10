import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, Upload, Search, Laptop,
  CheckCircle, ShieldAlert, BarChart2,
  Megaphone, User, Building, Clock, DollarSign, Sparkles,
  Zap, Target, TrendingUp, Globe, Award, Rocket
} from 'lucide-react';

/* ─────────────────────────────────────────────
   INTERSTITIAL TITLE CARDS  
   Catchy phrases that pop on a dark screen 
   between major visual phases
   ───────────────────────────────────────────── */
const INTERSTITIALS = [
  { start: 0, end: 3.5, lines: ['What if we could', 'stop rebuilding?'], accent: '#00d2ff' },
  { start: 16.5, end: 19.5, lines: ['One Marketplace.', 'Every Solution.'], accent: '#10b981' },
  { start: 36, end: 39, lines: ['Real Impact.', 'Measured.'], accent: '#f59e0b' },
  { start: 60, end: 63, lines: ['Complete Visibility.', 'Total Control.'], accent: '#8b5cf6' },
  { start: 76, end: 79, lines: ['The Future of', 'Innovation.'], accent: '#f43f5e' },
];

export default function PromoWalkthrough() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(85);
  const [audioUrl, setAudioUrl] = useState('/cnx-marketplace-promo.mp3');
  const [useSimulatedTimer, setUseSimulatedTimer] = useState(true);
  const [showAudioError, setShowAudioError] = useState(false);

  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const lastFrameRef = useRef(null);
  const t = currentTime; // shorthand

  // Timer / audio sync — requestAnimationFrame for buttery 60fps
  useEffect(() => {
    if (isPlaying) {
      if (!useSimulatedTimer && audioRef.current) {
        audioRef.current.play().catch(() => setUseSimulatedTimer(true));
      } else {
        lastFrameRef.current = performance.now();
        const tick = (now) => {
          const delta = (now - lastFrameRef.current) / 1000;
          lastFrameRef.current = now;
          setCurrentTime(prev => {
            const next = prev + delta;
            if (next >= duration) { setIsPlaying(false); return 0; }
            return next;
          });
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    } else {
      if (audioRef.current) audioRef.current.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, useSimulatedTimer, duration]);

  const handleAudioTimeUpdate = () => {
    if (audioRef.current && !useSimulatedTimer) setCurrentTime(audioRef.current.currentTime);
  };
  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) { setDuration(audioRef.current.duration || 85); setUseSimulatedTimer(false); setShowAudioError(false); }
  };
  const handleAudioError = () => { setUseSimulatedTimer(true); setShowAudioError(true); };
  const handleTogglePlay = () => setIsPlaying(!isPlaying);
  const handleRestart = () => { setCurrentTime(0); if (audioRef.current) audioRef.current.currentTime = 0; setIsPlaying(true); };
  const handleTimelineChange = e => { const v = parseFloat(e.target.value); setCurrentTime(v); if (audioRef.current) audioRef.current.currentTime = v; };
  const handleAudioUpload = e => { const f = e.target.files[0]; if (f) { setAudioUrl(URL.createObjectURL(f)); setUseSimulatedTimer(false); setShowAudioError(false); setCurrentTime(0); setIsPlaying(true); } };
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // Phase logic (adjusted for interstitials)
  const phase = t < 3.5 ? 'intro' : t < 16.5 ? 'silos' : t < 19.5 ? 'transition1' : t < 36 ? 'catalog' : t < 39 ? 'transition2' : t < 60 ? 'details' : t < 63 ? 'transition3' : t < 76 ? 'roadmap' : t < 79 ? 'transition4' : 'outro';
  const isInterstitial = phase.startsWith('intro') || phase.startsWith('transition');

  // Active interstitial
  const activeInterstitial = INTERSTITIALS.find(i => t >= i.start && t < i.end);

  // Interstitial progress (0-1) for animation
  const interstitialProgress = activeInterstitial
    ? Math.min((t - activeInterstitial.start) / (activeInterstitial.end - activeInterstitial.start), 1)
    : 0;

  // Search typing simulation (catalog phase: 19.5 - 36)
  const searchText = useMemo(() => {
    if (t < 21) return '';
    const full = 'process mining engine';
    const elapsed = t - 21;
    const charsToShow = Math.min(Math.floor(elapsed * 3.5), full.length);
    return full.slice(0, charsToShow);
  }, [Math.floor(t * 4)]);

  const showSearchResults = searchText.length >= 8;
  const cardClicked = t >= 31;

  // Cursor
  const cursor = useMemo(() => {
    let x = '50%', y = '50%', opacity = 0, scale = 1;
    if (t >= 21 && t < 24) { x = '52%'; y = '20%'; opacity = 1; }
    else if (t >= 24 && t < 28) { x = '58%'; y = '20%'; opacity = 1; }
    else if (t >= 28 && t < 30) { x = '38%'; y = '55%'; opacity = 1; }
    else if (t >= 30 && t < 33) { x = '38%'; y = '55%'; opacity = 1; scale = t >= 31 ? 0.75 : 1; }
    else if (t >= 42 && t < 45) { x = '88%'; y = '14%'; opacity = 1; scale = t >= 44 ? 0.75 : 1; }
    else if (t >= 50 && t < 53) { x = '55%'; y = '54%'; opacity = 1; }
    else if (t >= 53 && t < 56) { x = '55%'; y = '68%'; opacity = 1; scale = t >= 55 ? 0.75 : 1; }
    return { left: x, top: y, opacity, transform: `translate(-50%,-50%) scale(${scale})` };
  }, [Math.floor(t * 5)]);

  return (
    <div style={S.page}>
      <audio ref={audioRef} src={audioUrl} onTimeUpdate={handleAudioTimeUpdate} onLoadedMetadata={handleAudioLoadedMetadata} onError={handleAudioError} />

      {/* Ambient floating orbs */}
      <div style={S.orb1} />
      <div style={S.orb2} />
      <div style={S.orb3} />

      <div style={S.grid}>

        {/* ═══════ LEFT CONTROLS ═══════ */}
        <div style={S.controls}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={18} color="#00d2ff" />
            <h2 style={S.ctrlTitle}>Promo Player</h2>
          </div>
          <p style={S.ctrlSub}>Cinematic walkthrough with voice-sync timeline</p>

          {showAudioError ? (
            <div style={S.alert}>
              <ShieldAlert size={14} color="#00d2ff" />
              <span style={{ fontSize: 11 }}><b>Simulation Mode</b> — Upload your voiceover below</span>
            </div>
          ) : (
            <div style={{ ...S.alert, borderColor: 'rgba(16,185,129,.3)', background: 'rgba(16,185,129,.05)', color: '#10b981' }}>
              <CheckCircle size={14} />
              <span style={{ fontSize: 11 }}><b>Audio Synced</b> — Timeline calibrated</span>
            </div>
          )}

          <div style={S.btnRow}>
            <button onClick={handleTogglePlay} style={S.playBtn}>
              {isPlaying ? <Pause size={15} fill="#fff" /> : <Play size={15} fill="#fff" />}
              <span>{isPlaying ? 'Pause' : 'Play Video'}</span>
            </button>
            <button onClick={handleRestart} style={S.iconBtn}><RotateCcw size={13} /></button>
            <label style={S.iconBtn}><Upload size={13} /><input type="file" accept="audio/*" onChange={handleAudioUpload} hidden /></label>
          </div>

          {/* Timeline scrubber */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', fontFamily: 'monospace', marginBottom: 4 }}>
              <span>{fmt(t)}</span><span>{fmt(duration)}</span>
            </div>
            <div style={S.scrubTrack}>
              <div style={{ ...S.scrubFill, width: `${(t / duration) * 100}%` }} />
              <input type="range" min={0} max={duration} step={0.1} value={t} onChange={handleTimelineChange} style={S.scrubInput} />
            </div>
          </div>

          {/* Phase indicator pills */}
          <div style={S.phaseBar}>
            {[
              { id: 'intro', label: 'Intro', start: 0 },
              { id: 'silos', label: 'Problem', start: 3.5 },
              { id: 'catalog', label: 'Catalog', start: 19.5 },
              { id: 'details', label: 'Impact', start: 39 },
              { id: 'roadmap', label: 'Roadmap', start: 63 },
              { id: 'outro', label: 'Outro', start: 79 },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => { setCurrentTime(p.start); if (audioRef.current) audioRef.current.currentTime = p.start; }}
                style={{
                  ...S.phasePill,
                  background: (phase === p.id || (p.id === 'intro' && phase === 'intro') || (p.id === 'catalog' && phase === 'transition1') || (p.id === 'details' && phase === 'transition2') || (p.id === 'roadmap' && phase === 'transition3') || (p.id === 'outro' && phase === 'transition4'))
                    ? 'rgba(0,210,255,.15)' : 'transparent',
                  color: (phase === p.id || phase === 'intro' && p.id === 'intro') ? '#00d2ff' : '#64748b',
                  borderColor: (phase === p.id) ? 'rgba(0,210,255,.3)' : 'rgba(255,255,255,.04)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Script tracker */}
          <div style={S.scriptWrap}>
            <h3 style={S.scriptHead}>Script Tracker</h3>
            <div style={S.scriptBox}>
              {[
                { p: 'silos', time: '0:00–0:18', text: '"Imagine a world where we stop wasting countless hours building the same tools over and over…"' },
                { p: 'catalog', time: '0:18–0:38', text: '"The CNX Marketplace changes that. It\'s our new, AI-powered internal marketplace…"' },
                { p: 'details', time: '0:38–1:02', text: '"This isn\'t just about tidiness; it\'s about massive productivity gains…"' },
                { p: 'roadmap', time: '1:02–1:18', text: '"It provides leadership with unparalleled visibility into our capabilities…"' },
                { p: 'outro', time: '1:18–1:25', text: '"The CNX Marketplace isn\'t just a tool; it\'s a strategic shift… Let\'s unlock our full potential."' },
              ].map(s => {
                const active = phase === s.p || (s.p === 'silos' && (phase === 'intro' || phase === 'silos')) || (s.p === 'catalog' && phase === 'transition1');
                return (
                  <p key={s.p} style={{ ...S.scriptLine, opacity: active ? 1 : 0.25, borderLeftColor: active ? '#00d2ff' : 'transparent', color: active ? '#e2e8f0' : '#475569' }}>
                    <span style={S.timeTag}>[{s.time}]</span> {s.text}
                  </p>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════ RIGHT VIEWPORT ═══════ */}
        <div style={S.viewport}>
          {/* Browser chrome */}
          <div style={S.chrome}>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ ...S.dot, background: '#ef4444' }} />
              <span style={{ ...S.dot, background: '#f59e0b' }} />
              <span style={{ ...S.dot, background: '#10b981' }} />
            </div>
            <span style={S.chromeUrl}>cnx-marketplace.concentrix.com</span>
            <span style={S.chromeBadge}>LIVE DEMO</span>
          </div>

          <div style={S.stage}>
            {/* Cursor overlay */}
            <div style={{ ...S.cursor, ...cursor, transition: 'left 1.2s cubic-bezier(.25,1,.5,1), top 1.2s cubic-bezier(.25,1,.5,1), opacity .4s, transform .12s' }} />

            {/* ─── INTERSTITIAL TITLE CARDS ─── */}
            {activeInterstitial && (
              <div style={{
                ...S.interstitialOverlay,
                opacity: interstitialProgress < 0.15 ? interstitialProgress / 0.15
                  : interstitialProgress > 0.8 ? (1 - interstitialProgress) / 0.2
                  : 1,
                zIndex: 500,
              }}>
                <div style={S.interstitialGlow(activeInterstitial.accent)} />
                {activeInterstitial.lines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      ...S.interstitialLine,
                      color: i === activeInterstitial.lines.length - 1 ? activeInterstitial.accent : '#ffffff',
                      transform: interstitialProgress > 0.1
                        ? `translateY(0) scale(1)`
                        : `translateY(${30 + i * 20}px) scale(0.9)`,
                      opacity: interstitialProgress > (0.08 + i * 0.08) ? 1 : 0,
                      transition: `transform 0.8s cubic-bezier(.16,1,.3,1) ${i * 0.15}s, opacity 0.6s ease ${i * 0.15}s`,
                      textShadow: i === activeInterstitial.lines.length - 1
                        ? `0 0 60px ${activeInterstitial.accent}40, 0 0 120px ${activeInterstitial.accent}20`
                        : '0 0 40px rgba(255,255,255,0.08)',
                    }}
                  >
                    {line}
                  </div>
                ))}
                {/* Decorative line */}
                <div style={{
                  width: interstitialProgress > 0.2 ? 80 : 0,
                  height: 3,
                  background: `linear-gradient(90deg, transparent, ${activeInterstitial.accent}, transparent)`,
                  borderRadius: 2,
                  marginTop: 20,
                  transition: 'width 0.8s cubic-bezier(.25,1,.5,1) 0.3s',
                }} />
              </div>
            )}

            {/* ─── PHASE: SILOS ─── */}
            <div className={phaseClass(phase === 'silos', phase, 'silos')}>
              <div style={S.glassPanel}>
                <div style={S.siloRadial} />
                <h3 style={S.phTitle}>Scattered Efforts & Isolated Silos</h3>
                <p style={S.phSub}>Redundant builds, disjointed demos, lost capabilities.</p>

                <div style={S.siloField}>
                  {[
                    { label: 'Duplicate Tool', name: 'PDF Form Parser', waste: '60h wasted', x: '5%', y: '8%', delay: '0s' },
                    { label: 'Siloed Product', name: 'CX Feedback Indexer', waste: 'Hidden locally', x: '8%', y: '58%', delay: '1.2s' },
                    { label: 'Re-built Widget', name: 'Excel Collate Script', waste: '40h wasted', x: '62%', y: '5%', delay: '0.6s' },
                    { label: 'Redundant Engine', name: 'Sentiment Model v2', waste: '80h wasted', x: '65%', y: '55%', delay: '1.8s' },
                  ].map((n, i) => (
                    <div key={i} style={{ ...S.floatNode, left: n.x, top: n.y, animationDelay: n.delay }}>
                      <span style={S.floatLabel}>{n.label}</span>
                      <span style={S.floatName}>{n.name}</span>
                      <span style={S.floatWaste}>{n.waste}</span>
                    </div>
                  ))}
                  {/* Connection lines */}
                  <svg style={S.connectionSvg} viewBox="0 0 600 260">
                    <line x1="110" y1="55" x2="295" y2="130" stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
                    <line x1="110" y1="185" x2="295" y2="130" stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
                    <line x1="490" y1="55" x2="305" y2="130" stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
                    <line x1="490" y1="185" x2="305" y2="130" stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
                  </svg>
                  <div style={S.centralOrb}>
                    <ShieldAlert size={36} color="#f43f5e" className="pulse-icon" />
                    <span style={S.orbLabel}>Silo Effect</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── PHASE: CATALOG ─── */}
            <div className={phaseClass(phase === 'catalog', phase, 'catalog')}>
              <div style={S.appShell}>
                <NavBar active="Catalog" />
                <div style={S.appBody}>
                  <div style={S.heroZone}>
                    <h2 style={S.heroH}>Our Internal App Store</h2>
                    <p style={S.heroP}>Find solutions instantly, or showcase your own to the org.</p>
                    
                    {/* Search bar */}
                    <div style={S.searchWrap}>
                      <Search size={15} style={{ position: 'absolute', left: 14, color: '#475569', zIndex: 2 }} />
                      <div style={S.searchInput}>
                        <span style={{ color: searchText ? '#fff' : '#475569', fontWeight: searchText ? 600 : 400 }}>
                          {searchText || 'Search tools, products, or capabilities...'}
                        </span>
                        {t >= 21 && t < 28 && <span style={S.caret}>|</span>}
                      </div>
                      {searchText.length >= 14 && (
                        <div style={S.aiPill}>
                          <Sparkles size={10} /> AI Matching
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product cards — ALWAYS visible when in catalog phase */}
                  <div style={S.cardGrid}>
                    {!cardClicked ? (
                      <>
                        <CatalogCard
                          cat="Automation" title="PDF Form Parser"
                          desc="Extracts form values from scans using OCR models."
                          badge="Active" savings="$12K/yr" delay={0}
                          dimmed={showSearchResults}
                          visible={t >= 20}
                        />
                        <CatalogCard
                          cat="Analytics" title="Process Mining Engine"
                          desc="Discovers and maps operational bottlenecks from log workflows."
                          badge="Pilot" savings="$34K/yr" delay={0.12}
                          highlighted={showSearchResults}
                          visible={t >= 20}
                        />
                        <CatalogCard
                          cat="Generative AI" title="Client Pitch Builder"
                          desc="Auto-creates customized slides based on client industry."
                          badge="Active" savings="$40K/yr" delay={0.24}
                          dimmed={showSearchResults}
                          visible={t >= 20}
                        />
                      </>
                    ) : (
                      <div style={S.soloCardWrap}>
                        <CatalogCard
                          cat="Analytics" title="Process Mining Engine"
                          desc="Discovers and maps operational bottlenecks from log workflows."
                          badge="Pilot" savings="$34K/yr" delay={0}
                          highlighted solo visible
                        />
                        <div style={S.soloArrow}>
                          <Zap size={14} color="#00d2ff" />
                          <span>Opening tool details...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── PHASE: DETAILS ─── */}
            <div className={phaseClass(phase === 'details', phase, 'details')}>
              <div style={S.appShell}>
                <NavBar active="" />
                <div style={S.detailBody}>
                  <div style={S.detailHead}>
                    <div>
                      <span style={S.catLabel}>Analytics</span>
                      <h2 style={S.detailTitle}>Process Mining Engine</h2>
                      <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, color: '#64748b' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={10} /> Mahmoud Abdelnaby</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building size={10} /> Transformation Team</span>
                      </div>
                    </div>
                    <button style={{
                      ...S.adoptBtn,
                      background: t >= 44 ? 'rgba(16,185,129,.15)' : '#00d2ff',
                      color: t >= 44 ? '#10b981' : '#fff',
                      border: t >= 44 ? '1px solid #10b981' : 'none',
                    }}>
                      {t >= 44 ? '✓ Adopted' : 'Adopt this Tool'}
                    </button>
                  </div>

                  <div style={S.detailGrid}>
                    <div style={S.detailLeft}>
                      <h4 style={S.secLabel}>Problem Statement</h4>
                      <p style={S.secText}>Operations teams spend thousands of hours weekly manually mapping logs to find bottlenecks.</p>
                      <h4 style={S.secLabel}>Capabilities</h4>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['Log Parsing', 'Process Graph', 'Delay Pinning', 'Auto-Report'].map(c => (
                          <span key={c} style={S.capTag}>{c}</span>
                        ))}
                      </div>
                      {/* ROI card */}
                      <div style={{
                        ...S.roiCard,
                        borderColor: t >= 56 ? '#10b981' : 'rgba(255,255,255,.06)',
                        boxShadow: t >= 56 ? '0 0 25px rgba(16,185,129,.12)' : 'none',
                      }}>
                        <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.04em' }}>Realized Business Value</span>
                        <div style={S.roiVal}>{t < 56 ? '$0' : '$34,840'}<span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>/yr</span></div>
                        <span style={{ fontSize: 10, color: t >= 56 ? '#10b981' : '#334155' }}>{t < 56 ? '0 hrs saved' : '10 hrs/wk across 1 team'}</span>
                      </div>
                    </div>
                    <div style={S.sandboxWrap}>
                      <div style={S.sandboxHead}><Laptop size={12} /> Sandbox Simulation</div>
                      <div style={S.sandboxInner}>
                        {/* Flow nodes */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {['Import', 'Analyze', 'Map'].map((n, i) => (
                            <React.Fragment key={n}>
                              {i > 0 && <div style={{ width: 24, height: 2, background: t > (42 + i * 2) ? '#00d2ff' : 'rgba(255,255,255,.08)', borderRadius: 1, transition: 'background .6s' }} />}
                              <div style={{
                                padding: '6px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                border: t > (40 + i * 2) ? '1px solid #00d2ff' : '1px solid rgba(255,255,255,.08)',
                                background: t > (40 + i * 2) ? 'rgba(0,210,255,.06)' : 'transparent',
                                color: t > (40 + i * 2) ? '#fff' : '#475569',
                                transition: 'all .6s cubic-bezier(.25,1,.5,1)',
                              }}>
                                {n}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                        {/* Bottleneck bar */}
                        {t > 46 && (
                          <div style={S.bottleneckBox}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                              <span>Bottleneck: Step 3 Review</span>
                              <span style={{ color: '#00d2ff', fontWeight: 800 }}>90% Delay</span>
                            </div>
                            <div style={S.barTrack}>
                              <div style={{ ...S.barFill, animation: 'growBar 1.2s cubic-bezier(.25,1,.5,1) forwards' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Adopt Modal */}
                  {t >= 48 && t < 57 && (
                    <div style={S.modalBackdrop}>
                      <div style={{
                        ...S.modalCard,
                        animation: 'modalIn .5s cubic-bezier(.34,1.56,.64,1) forwards',
                      }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' }}>Adopt Tool & Log Savings</h4>
                        <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>How many hours will this tool save your team weekly?</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                          <span>Hours Saved</span>
                          <span style={{ color: '#00d2ff' }}>{t < 52 ? '0' : '10'} hrs/wk</span>
                        </div>
                        <input type="range" min={0} max={40} value={t < 52 ? 0 : 10} readOnly style={S.modalSlider} />
                        <div style={S.roiFormula}>
                          <span>Projected Annual Value</span>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981', marginTop: 2 }}>{t < 52 ? '$0' : '$34,840'}</div>
                          <span style={{ fontSize: 9, color: '#475569' }}>Standard loaded hourly rate</span>
                        </div>
                        <button style={{
                          ...S.modalConfirm,
                          background: t >= 55 ? '#10b981' : '#00d2ff',
                        }}>
                          {t < 55 ? 'Confirm Adoption' : '✓ Saved Successfully'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── PHASE: ROADMAP ─── */}
            <div className={phaseClass(phase === 'roadmap', phase, 'roadmap')}>
              <div style={S.appShell}>
                <NavBar active="Roadmap" />
                <div style={S.appBody}>
                  {t < 70 ? (
                    <>
                      <div style={S.roadmapHead}>
                        <h3 style={S.roadmapH}><TrendingUp size={16} style={{ marginRight: 6 }} /> Unified Portfolio Roadmap</h3>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Total Savings: <b style={{ color: '#10b981' }}>$485,300/yr</b></span>
                      </div>
                      <div style={S.gantt}>
                        <div style={S.ganttHead}>
                          <div style={{ width: '30%' }}>Tool</div>
                          <div style={{ width: '23%', textAlign: 'center' }}>Q1</div>
                          <div style={{ width: '23%', textAlign: 'center' }}>Q2</div>
                          <div style={{ width: '24%', textAlign: 'center' }}>Q3</div>
                        </div>
                        {[
                          { name: 'Process Mining Engine', w: '55%', l: '10%', bg: 'linear-gradient(90deg,#3b82f6,#10b981)', d: '0s' },
                          { name: 'PDF Parser Extractor', w: '40%', l: '40%', bg: '#3b82f6', d: '.12s' },
                          { name: 'Client Pitch Builder', w: '30%', l: '0%', bg: '#10b981', d: '.24s' },
                          { name: 'Quality Scorer', w: '45%', l: '25%', bg: 'linear-gradient(90deg,#8b5cf6,#3b82f6)', d: '.36s' },
                        ].map(r => (
                          <div key={r.name} style={S.ganttRow}>
                            <div style={{ width: '30%', fontSize: 11, fontWeight: 600 }}>{r.name}</div>
                            <div style={{ width: '70%', position: 'relative', height: 14 }}>
                              <div style={{ position: 'absolute', left: r.l, width: r.w, height: 12, borderRadius: 6, background: r.bg, top: 1, animation: `growBar .8s cubic-bezier(.25,1,.5,1) ${r.d} forwards`, transformOrigin: 'left', transform: 'scaleX(0)' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={S.roadmapHead}>
                        <h3 style={S.roadmapH}><Megaphone size={16} style={{ marginRight: 6 }} /> Voice of Clients</h3>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Active Ideation Pipeline</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {[
                          { dept: 'Operations', votes: 24, title: 'Automated Quality Scoring', desc: 'Score call quality metrics directly from transcript pipelines.' },
                          { dept: 'Sales', votes: 18, title: 'Pitch Case Recommender', desc: 'Search case studies based on client RFPs for instant pitch attachment.' },
                        ].map((v, i) => (
                          <div key={i} style={{ ...S.vocCard, animation: `slideUp .6s cubic-bezier(.16,1,.3,1) ${i * .12}s forwards`, opacity: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                              <span style={S.vocDept}>{v.dept}</span>
                              <span style={{ color: '#64748b' }}>{v.votes} Votes</span>
                            </div>
                            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>{v.title}</h4>
                            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{v.desc}</p>
                            <button style={S.ideateBtn}><Lightbulb size={11} /> Ideate Solution</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ─── PHASE: OUTRO ─── */}
            <div className={phaseClass(phase === 'outro', phase, 'outro')}>
              <div style={S.outroWrap}>
                <div style={S.outroCard}>
                  <div style={S.outroLogo}>CNX</div>
                  <h1 style={S.outroH1}>CNX Marketplace</h1>
                  <p style={S.outroSub}>Unified Innovation · Maximum Efficiency · Stronger Client Outcomes</p>
                  <div style={S.outroStats}>
                    {[
                      { Icon: Clock, val: 'Save 2+ Hours', desc: 'Per User Weekly' },
                      { Icon: Target, val: 'Centralized Hub', desc: 'Eliminate Silos' },
                      { Icon: DollarSign, val: 'Measurable ROI', desc: 'Dynamic Value Tracking' },
                    ].map((s, i) => (
                      <div key={i} style={{ ...S.outroStat, animation: `slideUp .6s cubic-bezier(.16,1,.3,1) ${i * .12}s forwards`, opacity: 0 }}>
                        <s.Icon size={20} color="#00d2ff" />
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{s.val}</div>
                        <div style={{ fontSize: 9, color: '#64748b' }}>{s.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={S.outroCta}>Let's unlock our full potential.</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Global keyframes + GPU-accelerated phase transitions */}
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes growBar { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes modalIn { from{opacity:0;transform:translateY(24px) scale(.92)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .pulse-icon { animation: pulse 1.4s ease-in-out infinite; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#00d2ff; cursor:pointer; box-shadow:0 0 8px rgba(0,210,255,.5); }

        /* Phase layer GPU compositing */
        .phase-layer {
          position:absolute; inset:0; display:flex; flex-direction:column;
          will-change:transform,opacity;
          transition: opacity .9s cubic-bezier(.25,1,.5,1), transform 1s cubic-bezier(.25,1,.5,1);
          transform-style:preserve-3d;
          backface-visibility:hidden;
          pointer-events:none;
          opacity:0;
          transform:translate3d(0,50px,0) scale(.96);
        }
        .phase-layer.active {
          opacity:1; pointer-events:auto; z-index:10;
          transform:translate3d(0,0,0) scale(1);
        }
        .phase-layer.behind {
          transform:translate3d(0,-40px,0) scale(.96);
        }
        .phase-layer.ahead {
          transform:translate3d(0,40px,0) scale(.96);
        }
      `}</style>
    </div>
  );
}

/* ─── Sub-components ─── */

function NavBar({ active }) {
  return (
    <div style={S.navbar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 900, color: '#00d2ff', fontSize: 14, letterSpacing: '.03em' }}>CNX</span>
        <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,.12)' }} />
        <span style={{ fontWeight: 700, color: '#fff', fontSize: 12 }}>Marketplace</span>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        {['Catalog', 'Idea Pipeline', 'Roadmap', 'Settings'].map(l => (
          <span key={l} style={{ fontSize: 12, fontWeight: 700, color: active === l ? '#00d2ff' : '#475569', borderBottom: active === l ? '2px solid #00d2ff' : 'none', paddingBottom: 3, cursor: 'pointer' }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function CatalogCard({ cat, title, desc, badge, savings, delay = 0, highlighted, dimmed, solo, visible }) {
  return (
    <div style={{
      background: highlighted ? 'rgba(0,210,255,.04)' : 'rgba(15,23,42,.3)',
      border: highlighted ? '1.5px solid rgba(0,210,255,.5)' : '1px solid rgba(255,255,255,.06)',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      opacity: visible ? (dimmed ? 0.35 : 1) : 0,
      transform: visible ? (solo ? 'scale(1.03)' : 'translateY(0)') : 'translateY(14px)',
      transition: `all .7s cubic-bezier(.25,1,.5,1) ${delay}s`,
      boxShadow: highlighted ? '0 8px 40px rgba(0,210,255,.18)' : 'none',
      maxWidth: solo ? 380 : 'none',
      margin: solo ? '0 auto' : 0,
      width: solo ? '100%' : 'auto',
    }}>
      <span style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: '#00d2ff', letterSpacing: '.04em' }}>{cat}</span>
      <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#fff' }}>{title}</h4>
      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>{desc}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
        <span style={{ fontSize: 9, background: highlighted ? 'rgba(0,210,255,.1)' : 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', padding: '2px 8px', borderRadius: 5, fontWeight: 700, color: highlighted ? '#00d2ff' : '#94a3b8' }}>{badge}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>{savings}</span>
      </div>
    </div>
  );
}

// Shared Lightbulb import for VOC section
function Lightbulb({ size, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" /><path d="M10 22h4" />
    </svg>
  );
}

/* ─── Phase CSS class helper (no inline recalc) ─── */
function phaseClass(active, currentPhase, thisPhase) {
  const phases = ['silos', 'catalog', 'details', 'roadmap', 'outro'];
  const ci = phases.indexOf(
    currentPhase.startsWith('transition')
      ? phases[Math.min(parseInt(currentPhase.slice(-1)), phases.length - 1)] || currentPhase
      : currentPhase
  );
  const ti = phases.indexOf(thisPhase);
  if (active) return 'phase-layer active';
  if (ti < ci) return 'phase-layer behind';
  return 'phase-layer ahead';
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const S = {
  page: {
    width: '100%', minHeight: '100vh', background: '#060911', color: '#f1f5f9',
    display: 'flex', flexDirection: 'column', padding: 20, boxSizing: 'border-box',
    fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    overflow: 'hidden', position: 'relative',
  },
  orb1: { position: 'absolute', width: 500, height: 500, top: '-8%', left: '5%', borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,210,255,.07) 0%,transparent 70%)', pointerEvents: 'none' },
  orb2: { position: 'absolute', width: 600, height: 600, bottom: '-12%', right: '8%', borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,.05) 0%,transparent 70%)', pointerEvents: 'none' },
  orb3: { position: 'absolute', width: 400, height: 400, top: '40%', left: '50%', borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,.04) 0%,transparent 70%)', pointerEvents: 'none', transform: 'translateX(-50%)' },

  grid: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, flex: 1, height: 'calc(100vh - 40px)', position: 'relative', zIndex: 1 },

  // Controls
  controls: { background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  ctrlTitle: { fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: '-.02em' },
  ctrlSub: { fontSize: 11.5, color: '#64748b', margin: '0 0 14px', lineHeight: 1.4 },
  alert: { display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,210,255,.15)', background: 'rgba(0,210,255,.04)', marginBottom: 18, fontSize: 11 },
  btnRow: { display: 'flex', gap: 8, marginBottom: 18 },
  playBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#00d2ff', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,210,255,.35)' },
  iconBtn: { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', color: '#94a3b8', borderRadius: 10, cursor: 'pointer' },

  // Scrubber
  scrubTrack: { position: 'relative', width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'visible' },
  scrubFill: { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#00d2ff,#3b82f6)', transition: 'width .1s linear' },
  scrubInput: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 },

  // Phase pills
  phaseBar: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 },
  phasePill: { fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid', cursor: 'pointer', background: 'transparent', transition: 'all .2s' },

  // Script
  scriptWrap: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
  scriptHead: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: '#475569', marginBottom: 8 },
  scriptBox: { flex: 1, background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.03)', borderRadius: 10, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 },
  scriptLine: { fontSize: 11, lineHeight: 1.5, margin: 0, paddingLeft: 8, borderLeft: '3px solid transparent', transition: 'all .4s ease' },
  timeTag: { fontWeight: 700, marginRight: 4, fontFamily: 'monospace', fontSize: 9, color: '#00d2ff' },

  // Viewport
  viewport: { background: '#0a0e18', border: '1px solid rgba(255,255,255,.05)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,.6)', position: 'relative' },
  chrome: { background: '#0e1225', borderBottom: '1px solid rgba(255,255,255,.04)', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14 },
  dot: { width: 9, height: 9, borderRadius: '50%', display: 'inline-block' },
  chromeUrl: { fontSize: 10.5, color: '#334155', fontFamily: 'monospace', fontWeight: 600 },
  chromeBadge: { marginLeft: 'auto', fontSize: 8.5, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', padding: '2px 8px', borderRadius: 4, letterSpacing: '.06em' },
  stage: { flex: 1, position: 'relative', overflow: 'hidden', background: '#070a13' },

  // Cursor
  cursor: { position: 'absolute', width: 20, height: 20, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='rgba(0,0,0,.6)' stroke-width='1.5'%3E%3Cpath d='M3 3l7.07 16.97 2.51-5.66 5.66-2.51L3 3z'/%3E%3C/svg%3E")`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', zIndex: 999, pointerEvents: 'none', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.4))' },

  // Interstitials
  interstitialOverlay: { position: 'absolute', inset: 0, background: '#060911', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 },
  interstitialGlow: (color) => ({ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`, pointerEvents: 'none' }),
  interstitialLine: { fontSize: 42, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.15, textAlign: 'center' },

  // App shell
  appShell: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%' },
  navbar: { height: 48, background: 'rgba(10,14,24,.92)', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', flexShrink: 0 },
  appBody: { flex: 1, padding: '20px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' },

  // Silos
  glassPanel: { flex: 1, margin: 24, background: 'rgba(12,18,32,.85)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 16, padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  siloRadial: { position: 'absolute', width: 350, height: 350, background: 'radial-gradient(circle,rgba(244,63,94,.06) 0%,transparent 70%)', pointerEvents: 'none' },
  phTitle: { fontSize: 20, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-.02em', position: 'relative' },
  phSub: { fontSize: 12.5, color: '#94a3b8', margin: '0 0 16px', textAlign: 'center', position: 'relative' },
  siloField: { width: '100%', flex: 1, position: 'relative', minHeight: 220 },
  floatNode: { position: 'absolute', background: 'rgba(15,20,35,.85)', border: '1px solid rgba(244,63,94,.18)', boxShadow: '0 8px 24px rgba(244,63,94,.06)', borderRadius: 12, padding: '11px 14px', width: 165, display: 'flex', flexDirection: 'column', gap: 2, animation: 'float 4.5s ease-in-out infinite', zIndex: 2 },
  floatLabel: { color: '#f43f5e', fontWeight: 800, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '.04em' },
  floatName: { fontSize: 11, fontWeight: 600, color: '#e2e8f0' },
  floatWaste: { fontSize: 10, color: '#475569', fontStyle: 'italic' },
  connectionSvg: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
  centralOrb: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(15,23,42,.7)', border: '1.5px solid rgba(244,63,94,.25)', borderRadius: '50%', width: 88, height: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  orbLabel: { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#f43f5e', marginTop: 4, letterSpacing: '.03em' },

  // Catalog
  heroZone: { textAlign: 'center', marginBottom: 14 },
  heroH: { fontSize: 18, fontWeight: 800, margin: '0 0 3px', letterSpacing: '-.02em' },
  heroP: { fontSize: 12, color: '#94a3b8', margin: '0 0 12px' },
  searchWrap: { maxWidth: 440, margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { width: '100%', padding: '10px 14px 10px 38px', borderRadius: 11, border: '1.5px solid rgba(0,210,255,.5)', background: 'rgba(15,23,42,.5)', fontSize: 12.5, height: 40, boxSizing: 'border-box', display: 'flex', alignItems: 'center', boxShadow: '0 0 18px rgba(0,210,255,.08)' },
  caret: { color: '#00d2ff', fontWeight: 700, marginLeft: 1, animation: 'pulse .7s infinite' },
  aiPill: { position: 'absolute', right: 10, background: 'rgba(0,210,255,.12)', border: '1px solid rgba(0,210,255,.3)', color: '#00d2ff', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 4 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 16, marginTop: 8 },
  soloCardWrap: { gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  soloArrow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#00d2ff', fontWeight: 600, animation: 'pulse 1.5s ease-in-out infinite' },

  // Details
  detailBody: { flex: 1, padding: '18px 26px', overflowY: 'auto', position: 'relative' },
  detailHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.04)', paddingBottom: 14, marginBottom: 14 },
  catLabel: { fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: '#00d2ff', letterSpacing: '.04em' },
  detailTitle: { fontSize: 19, fontWeight: 800, margin: 0, letterSpacing: '-.02em' },
  adoptBtn: { borderRadius: 10, padding: '8px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .3s' },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 },
  detailLeft: { display: 'flex', flexDirection: 'column', gap: 8 },
  secLabel: { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '.05em', margin: '8px 0 2px' },
  secText: { fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 },
  capTag: { fontSize: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', padding: '3px 10px', borderRadius: 16, color: '#cbd5e1' },
  roiCard: { background: 'rgba(15,23,42,.4)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 14, marginTop: 10, transition: 'all .8s cubic-bezier(.25,1,.5,1)' },
  roiVal: { fontSize: 22, fontWeight: 900, color: '#10b981', margin: '2px 0' },

  sandboxWrap: { background: 'rgba(15,23,42,.2)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 230 },
  sandboxHead: { background: 'rgba(15,23,42,.4)', padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,.03)', display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' },
  sandboxInner: { flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' },
  bottleneckBox: { background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.03)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, animation: 'slideUp .5s cubic-bezier(.16,1,.3,1) forwards' },
  barTrack: { width: '100%', height: 8, background: 'rgba(255,255,255,.04)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#00d2ff,#10b981)', transformOrigin: 'left' },

  // Modal
  modalBackdrop: { position: 'absolute', inset: 0, background: 'rgba(6,9,17,.8)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', zIndex: 100 },
  modalCard: { background: '#0f1424', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 24, width: 300, boxShadow: '0 24px 60px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', gap: 12 },
  modalSlider: { width: '100%', accentColor: '#00d2ff', height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2 },
  roiFormula: { background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.03)', padding: 12, borderRadius: 8, fontSize: 11 },
  modalConfirm: { color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'background .3s' },

  // Roadmap
  roadmapHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.04)', paddingBottom: 10, marginBottom: 14 },
  roadmapH: { fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center' },
  gantt: { background: 'rgba(15,23,42,.3)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, padding: 16 },
  ganttHead: { display: 'flex', borderBottom: '1px solid rgba(255,255,255,.03)', paddingBottom: 6, marginBottom: 10, fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em' },
  ganttRow: { display: 'flex', alignItems: 'center', height: 34, borderBottom: '1px solid rgba(255,255,255,.02)' },

  vocCard: { background: 'rgba(15,23,42,.3)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  vocDept: { fontSize: 10, background: 'rgba(255,255,255,.05)', padding: '2px 7px', borderRadius: 4, fontWeight: 700 },
  ideateBtn: { alignSelf: 'flex-start', background: 'rgba(0,210,255,.08)', color: '#00d2ff', border: '1px solid rgba(0,210,255,.2)', borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 },

  // Outro
  outroWrap: { flex: 1, display: 'grid', placeItems: 'center', padding: 30 },
  outroCard: { textAlign: 'center', background: 'rgba(12,18,32,.92)', border: '1px solid rgba(255,255,255,.06)', boxShadow: '0 30px 80px rgba(0,0,0,.6)', borderRadius: 20, padding: '40px 36px', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'slideUp .8s cubic-bezier(.16,1,.3,1) forwards' },
  outroLogo: { width: 52, height: 52, background: '#00d2ff', color: '#fff', borderRadius: 14, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 17, boxShadow: '0 0 30px rgba(0,210,255,.4)' },
  outroH1: { fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: '-.03em' },
  outroSub: { fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 },
  outroStats: { display: 'flex', gap: 12, width: '100%', marginTop: 10 },
  outroStat: { flex: 1, background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.03)', borderRadius: 10, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  outroCta: { fontSize: 14, fontWeight: 700, color: '#00d2ff', marginTop: 10, letterSpacing: '-.01em' },
};
