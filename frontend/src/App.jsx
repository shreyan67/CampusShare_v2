import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import * as api from './api.js'
import Admin from "./pages/Admin"

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const T = {
  navy: '#0F172A',
  coral: '#E8445A',
  cream: '#FFF8F0',
  coralDim: '#E8445A22',
  coralMid: '#E8445A44',
  glass: 'rgba(255,248,240,0.72)',
  glassDk: 'rgba(15,23,42,0.82)',
  border: 'rgba(232,68,90,0.18)',
  borderSoft: 'rgba(15,23,42,0.08)',
  text: '#0F172A',
  textMid: '#475569',
  textSoft: '#94A3B8',
  success: '#10B981',
  successBg: '#D1FAE5',
  warn: '#F59E0B',
  warnBg: '#FEF3C7',
  error: '#EF4444',
  errorBg: '#FEE2E2',
  info: '#3B82F6',
  infoBg: '#DBEAFE',
}

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --navy: #0F172A;
  --coral: #E8445A;
  --cream: #FFF8F0;
  --glass: rgba(255,248,240,0.72);
  --border: rgba(232,68,90,0.18);
  --border-soft: rgba(15,23,42,0.08);
  --radius: 16px;
  --radius-sm: 10px;
  --radius-xs: 7px;
  --shadow: 0 4px 24px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04);
  --shadow-lg: 0 16px 48px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.08);
  --shadow-coral: 0 4px 24px rgba(232,68,90,0.24);
  --font-head: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
}

body { background: var(--cream); font-family: var(--font-body); color: var(--navy); -webkit-font-smoothing: antialiased; }

/* Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(232,68,90,0.3); border-radius: 4px; }

/* Animations */
@keyframes slideUp   { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
@keyframes popIn     { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
@keyframes shimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
@keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.5} }
@keyframes toastIn   { from{opacity:0;transform:translateY(16px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes spin      { to { transform: rotate(360deg) } }

.slide-up    { animation: slideUp 0.32s cubic-bezier(0.22,1,0.36,1) both; }
.pop-in      { animation: popIn  0.28s cubic-bezier(0.22,1,0.36,1) both; }
.fade-in     { animation: fadeIn 0.24s ease both; }

/* Card stagger entrance */
@keyframes cardIn { from { opacity:0; transform:translateY(18px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
.item-card {
  transition: transform 0.22s ease, box-shadow 0.22s ease;
  animation: cardIn 0.38s cubic-bezier(0.22,1,0.36,1) both;
}
.item-card:hover { transform: translateY(-4px) scale(1.01); box-shadow: var(--shadow-lg) !important; }
/* Stagger delays for grid children */
.item-card:nth-child(1)  { animation-delay: 0.03s }
.item-card:nth-child(2)  { animation-delay: 0.07s }
.item-card:nth-child(3)  { animation-delay: 0.11s }
.item-card:nth-child(4)  { animation-delay: 0.15s }
.item-card:nth-child(5)  { animation-delay: 0.19s }
.item-card:nth-child(6)  { animation-delay: 0.23s }
.item-card:nth-child(7)  { animation-delay: 0.27s }
.item-card:nth-child(8)  { animation-delay: 0.31s }
.item-card:nth-child(n+9){ animation-delay: 0.35s }

/* Button press */
.btn-press { 
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); 
  -webkit-tap-highlight-color: transparent; 
  touch-action: manipulation; 
  user-select: none; 
}
@media (hover: hover) and (pointer: fine) {
  .btn-press:hover { 
    transform: scale(1.05) translateY(-1px); 
    filter: brightness(1.03); 
    box-shadow: 0 4px 12px rgba(15,23,42,0.12); 
    z-index: 10; 
    position: relative; 
  }
}
.btn-press:active { 
  transform: scale(0.85) !important; 
  box-shadow: 0 1px 2px rgba(15,23,42,0.08) !important; 
  filter: brightness(0.85) !important; 
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1) !important; 
}

/* ── RESPONSIVE MOBILE ── */
@media (max-width: 768px) {
  .desktop-only { display: none !important; }

  /* Prevent ALL horizontal overflow on mobile */
  body, #root { overflow-x: hidden !important; max-width: 100vw !important; }

  /* Main content padding + bottom nav clearance */
  .main-content {
    padding: 14px 12px 80px !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  /* Item grid — 2 columns on mobile, full container width */
  .item-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 10px !important;
    width: 100% !important;
  }

  /* Modal full width bottom sheet */
  .modal-sheet { max-width: 100% !important; border-radius: 20px 20px 0 0 !important; }

  /* Hero — stack vertically, no overflow */
  .hero-pad {
    padding: 14px 16px 12px !important;
    flex-wrap: wrap !important;
    gap: 10px !important;
    align-items: flex-start !important;
  }
  .stats-chips {
    width: 100% !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
  }
  .hero-bottom {
    padding: 0 16px 12px !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
  }
  .hero-tabs { width: 100% !important; }
  .hero-tabs button { flex: 1 !important; }
  .search-bar {
    width: 100% !important;
    min-width: unset !important;
    max-width: 100% !important;
    flex: unset !important;
  }

  /* Activity cards */
  .req-actions { flex-wrap: wrap !important; }
  .req-actions button { flex: 1 !important; min-width: 100px !important; }

  /* Profile grid */
  .profile-grid { grid-template-columns: 1fr 1fr !important; }
}

@media (max-width: 400px) {
  .item-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
  .profile-grid { grid-template-columns: 1fr !important; }
}

@media (min-width: 769px) {
  .mobile-only { display: none !important; }
}

/* Search placeholder on dark hero */
.dark-search::placeholder { color: rgba(255,255,255,0.38) !important; }
.dark-search { caret-color: #fff; }

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, #f0e8e0 25%, #f8f2ec 50%, #f0e8e0 75%);
  background-size: 400px 100%;
  animation: shimmer 1.4s ease infinite;
  border-radius: 8px;
}
`

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const TRUST_TIERS = {
  newcomer: { label: 'Newcomer', color: '#64748B', bg: '#F1F5F9', limit: 1 },
  regular: { label: 'Regular', color: '#3B82F6', bg: '#DBEAFE', limit: 3 },
  trusted: { label: 'Trusted', color: '#10B981', bg: '#D1FAE5', limit: 5 },
  rep: { label: 'Campus Rep', color: '#8B5CF6', bg: '#EDE9FE', limit: 8 },
}
const CATEGORIES = ['Books', 'Lab Equipment', 'Electronics', 'Notes & Guides', 'Accessories', 'Other']
const EMOJIS = { 'Books': '📗', 'Lab Equipment': '🔬', 'Electronics': '🔌', 'Notes & Guides': '📝', 'Accessories': '🎒', 'Other': '📦', 'lost_found': '🔍' }
const STATUS_MAP = {
  available: { bg: '#D1FAE5', color: '#065F46', label: 'Available' },
  borrowed: { bg: '#FEF3C7', color: '#92400E', label: 'Borrowed' },
  pending: { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  selected: { bg: '#DBEAFE', color: '#1E40AF', label: 'Selected' },
  active: { bg: '#DBEAFE', color: '#1E40AF', label: 'Active' },
  returned: { bg: '#D1FAE5', color: '#065F46', label: 'Returned' },
  declined: { bg: '#FEE2E2', color: '#991B1B', label: 'Declined' },
  overdue: { bg: '#FEE2E2', color: '#991B1B', label: 'Overdue' },
  completed: { bg: '#D1FAE5', color: '#065F46', label: 'Claimed' },
}

// ── STYLE HELPERS ─────────────────────────────────────────────────────────────
const btn = (primary = false, sm = false) => ({
  fontFamily: 'var(--font-body)', fontWeight: 600,
  fontSize: sm ? 12 : 14,
  padding: sm ? '6px 14px' : '10px 20px',
  borderRadius: 'var(--radius-xs)',
  cursor: 'pointer', border: 'none',
  background: primary ? 'var(--coral)' : 'rgba(15,23,42,0.06)',
  color: primary ? '#fff' : 'var(--navy)',
  transition: 'all 0.18s ease',
  letterSpacing: primary ? '0.01em' : 0,
  boxShadow: primary ? 'var(--shadow-coral)' : 'none',
})

const INP = {
  width: '100%', padding: '11px 14px', fontSize: 14,
  border: '1.5px solid var(--border-soft)',
  borderRadius: 'var(--radius-xs)',
  background: 'rgba(255,255,255,0.8)',
  color: 'var(--navy)', outline: 'none',
  fontFamily: 'var(--font-body)',
  transition: 'border-color 0.18s',
}
const LBL = { display: 'block', fontSize: 12, fontWeight: 600, color: T.textMid, marginBottom: 6, letterSpacing: '0.01em' }
const ERR = { padding: '10px 14px', background: T.errorBg, color: '#991B1B', borderRadius: 'var(--radius-xs)', fontSize: 13, marginBottom: 12, border: `1px solid ${T.error}22` }
const OK = { padding: '10px 14px', background: T.successBg, color: '#065F46', borderRadius: 'var(--radius-xs)', fontSize: 13, marginBottom: 12 }
const row = (gap = 8) => ({ display: 'flex', alignItems: 'center', gap })
const card = { background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }

// ── CONTEXT ───────────────────────────────────────────────────────────────────
const Ctx = createContext(null)
const useApp = () => useContext(Ctx)

// ── TOAST ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState('')
  const show = useCallback((m, native = false) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3200);
    if (native && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if (navigator.serviceWorker) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('CampusShare', {
              body: m,
              icon: '/android-chrome-192x192.png',
              badge: '/favicon-32x32.png',
              vibrate: [200, 100, 200, 100, 200]
            }).catch(() => new Notification('CampusShare', { body: m, vibrate: [200, 100, 200] }))
          })
        } else {
          new Notification('CampusShare', { body: m, vibrate: [200, 100, 200] })
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
      } catch (e) {
        new Notification('CampusShare', { body: m })
      }
    }
  }, [])
  return [msg, show]
}
function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', bottom: 84, left: 0, right: 0, zIndex: 9999, pointerEvents: 'none', animation: 'toastIn 0.3s cubic-bezier(0.22,1,0.36,1) both', display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ background: T.navy, color: '#fff', padding: '12px 24px', borderRadius: 40, fontSize: 14, fontWeight: 500, maxWidth: 340, textAlign: 'center', boxShadow: '0 8px 32px rgba(15,23,42,0.24)', wordBreak: 'break-word' }}>{msg}</div>
    </div>
  )
}

let deferredPromptGlobal = null;
let promptListeners = [];
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPromptGlobal = e;
    promptListeners.forEach(listener => listener(e));
  });
}

function usePwaInstall() {
  const [prompt, setPrompt] = useState(deferredPromptGlobal);

  useEffect(() => {
    setPrompt(deferredPromptGlobal);
    const listener = (p) => setPrompt(p);
    promptListeners.push(listener);
    return () => { promptListeners = promptListeners.filter(l => l !== listener); };
  }, []);

  const installApp = async () => {
    if (!deferredPromptGlobal) return;
    deferredPromptGlobal.prompt();
    const { outcome } = await deferredPromptGlobal.userChoice;
    if (outcome === 'accepted') {
      deferredPromptGlobal = null;
      promptListeners.forEach(listener => listener(null));
    }
  };

  return { showInstall: !!prompt, installApp };
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, children, wide = false }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: '0', overflowY: 'hidden' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="slide-up modal-sheet" style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: wide ? 680 : 480, maxHeight: '90vh', overflowY: 'auto', padding: '8px 0 0' }}>
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, background: 'rgba(15,23,42,0.12)', borderRadius: 4, margin: '12px auto 20px' }} />
        <div style={{ padding: '0 24px 32px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── SMALL UI ATOMS ────────────────────────────────────────────────────────────
function TierBadge({ tier }) {
  const t = TRUST_TIERS[tier] || TRUST_TIERS.newcomer
  return <span style={{ background: t.bg, color: t.color, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.01em' }}>{t.label}</span>
}
function SBadge({ status, inline = false }) {
  const s = STATUS_MAP[status] || STATUS_MAP.available
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, ...(inline ? {} : { position: 'absolute', top: 10, right: 10 }) }}>{s.label}</span>
}
function Av({ user, size = 26 }) {
  const init = user?.avatar || user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: user?.color || 'linear-gradient(135deg,#E8445A,#0F172A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .38), fontWeight: 700, color: '#fff', flexShrink: 0, letterSpacing: '-0.02em' }}>{init}</div>
  )
}
function Divider() { return <div style={{ height: 1, background: 'var(--border-soft)', margin: '14px 0' }} /> }
function ModalTitle({ children }) { return <div style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.5px', color: T.navy }}>{children}</div> }
function ModalSub({ children }) { return <div style={{ fontSize: 14, color: T.textMid, marginBottom: 18, lineHeight: 1.5 }}>{children}</div> }

function InfoBanner({ type = 'info', children }) {
  const styles = {
    info: { bg: T.infoBg, color: T.info, border: `1px solid ${T.info}33` },
    success: { bg: T.successBg, color: T.success, border: `1px solid ${T.success}33` },
    warn: { bg: T.warnBg, color: '#92400E', border: `1px solid ${T.warn}44` },
    error: { bg: T.errorBg, color: T.error, border: `1px solid ${T.error}33` },
  }
  const s = styles[type] || styles.info
  return (
    <div style={{ padding: '10px 14px', background: s.bg, color: s.color, borderRadius: 'var(--radius-xs)', fontSize: 13, marginBottom: 10, border: s.border, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const { showInstall, installApp } = usePwaInstall();

  const [mode, setMode] = useState('login')
  const [pending, setPending] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [consoleOtp, setConsoleOtp] = useState('')
  const [fields, setFields] = useState({ name: '', email: '', roll: '', otp: '' })
  const set = key => e => setFields(prev => ({ ...prev, [key]: e.target.value }))

  async function doLogin() {
    setErr('')
    if (!fields.email.trim()) return setErr('Please enter your college email.')
    setLoading(true)
    const r = await api.login(fields.email.trim())
    setLoading(false)
    if (r.error) return setErr(r.error)
    setPending({ userId: r.userId })
    if (r._otp) setConsoleOtp(r._otp)
    setMode('otp')
  }

  console.log("SIGNUP CLICKED")
  async function doSignup() {
    setErr('')
    const name = fields.name?.trim()
    const email = fields.email?.trim()
    const roll = fields.roll?.trim()
    if (!name || !email || !roll) return setErr('All fields are required.')
    setLoading(true)
    try {
      const r = await api.signup(name, email, roll)
      if (r.error) { setLoading(false); return setErr(r.error) }
      setPending({ userId: r.userId })
      if (r._devOtp) setConsoleOtp(r._devOtp)
      setMode('otp')
    } catch (e) { setErr('Request failed') }
    setLoading(false)
  }

  async function doOtp() {
    setErr('')
    if (!fields.otp.trim()) return setErr('Please enter the 6-digit code.')
    setLoading(true)
    const r = await api.verifyOtp(pending.userId, fields.otp.trim())
    setLoading(false)
    if (r.error) return setErr(r.error)
    api.saveSession(r.token, r.user)
    onLogin(r.user)
  }

  function switchMode(m) { setErr(''); setMode(m) }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${T.navy} 0%, #1E293B 50%, #0F172A 100%)`, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
      <style>{FONTS}</style>

      {/* Decorative blobs */}
      <div style={{ position: 'fixed', top: -100, right: -100, width: 400, height: 400, background: `radial-gradient(circle, ${T.coral}22 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -100, left: -100, width: 300, height: 300, background: `radial-gradient(circle, ${T.coral}18 0%, transparent 70%)`, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', }}>
        <Logo light />
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>College-verified peer sharing</div>

      </div>
      {showInstall && (
        <div style={{ padding: '0 32px', marginTop: '8px' }}>
          <button
            onClick={installApp}
            style={{
              padding: "8px 14px",
              background: "#E8445A",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "13px"
            }}
          >
            Install App 🚀
          </button>
        </div>
      )}

      {/* Card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div className="pop-in" style={{ background: 'rgba(255,255,255,0.97)', borderRadius: 24, width: '100%', maxWidth: 400, padding: '36px 32px', boxShadow: '0 32px 80px rgba(0,0,0,0.32)' }}>

          {mode === 'login' && <>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 }}>Welcome back 👋</div>
            <div style={{ fontSize: 14, color: T.textMid, marginBottom: 24 }}>Sign in with your college email</div>
            {err && <div style={ERR}>{err}</div>}
            <div style={{ marginBottom: 16 }}>
              <label style={LBL}>College email</label>
              <input style={INP} placeholder="cs2021001@mail.iitb.ac.in" value={fields.email} onChange={set('email')} onKeyDown={e => e.key === 'Enter' && doLogin()} autoComplete="email" />
            </div>
            <button className="btn-press" style={{ ...btn(true), width: '100%', padding: '13px', fontSize: 15 }} onClick={doLogin} disabled={loading}>
              {loading ? 'Sending code…' : 'Continue →'}
            </button>
            <p style={{ fontSize: 13, color: T.textMid, textAlign: 'center', marginTop: 16 }}>
              No account? <span style={{ color: T.coral, cursor: 'pointer', fontWeight: 600 }} onClick={() => switchMode('signup')}>Sign up</span>
            </p>
            <Divider />
            <p style={{ fontSize: 11, color: T.textSoft, textAlign: 'center' }}>Demo: <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>cs2021001@mail.iitb.ac.in</code></p>
          </>}

          {mode === 'signup' && <>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 }}>Join CampusShare ✦</div>
            <div style={{ fontSize: 13, color: T.textMid, marginBottom: 24, lineHeight: 1.6 }}>
              Use your college email — each college sees only their own listings.
            </div>
            {err && <div style={ERR}>{err}</div>}
            {['Full name|name|Rahul Mehta|name', 'College email|email|cs2021001@mail.iitb.ac.in|email', 'Roll number|roll|CS2021001|off'].map(s => {
              const [label, key, ph, ac] = s.split('|')
              return (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={LBL}>{label}</label>
                  <input style={INP} placeholder={ph} value={fields[key]} onChange={set(key)} autoComplete={ac} onKeyDown={e => e.key === 'Enter' && key === 'roll' && doSignup()} />
                </div>
              )
            })}
            <button className="btn-press" type="button" style={{ ...btn(true), width: '100%', padding: '13px', fontSize: 15 }} onClick={doSignup} disabled={loading}>
              {loading ? 'Sending code…' : 'Create account →'}
            </button>
            <p style={{ fontSize: 13, color: T.textMid, textAlign: 'center', marginTop: 16 }}>
              Have an account? <span style={{ color: T.coral, cursor: 'pointer', fontWeight: 600 }} onClick={() => switchMode('login')}>Sign in</span>
            </p>
          </>}

          {mode === 'otp' && <>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📬</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 }}>Check your inbox</div>
              <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.6 }}>Enter the 6-digit code sent to your college email.</div>
            </div>
            {err && <div style={{ ...ERR, marginTop: 16 }}>{err}</div>}
            {consoleOtp && (
              <div style={{ ...OK, marginTop: 16, textAlign: 'center' }}>
                Dev mode — OTP: <strong style={{ letterSpacing: '0.15em', fontSize: 18 }}>{consoleOtp}</strong>
              </div>
            )}
            <div style={{ marginTop: 20, marginBottom: 16 }}>
              <input
                style={{ ...INP, letterSpacing: '0.4em', fontSize: 28, textAlign: 'center', padding: '16px', fontFamily: 'var(--font-head)', fontWeight: 700 }}
                placeholder="——————" maxLength={6} value={fields.otp} onChange={set('otp')}
                onKeyDown={e => e.key === 'Enter' && doOtp()} autoComplete="one-time-code" inputMode="numeric"
              />
              {window.__DEV_OTP__ && <p style={{ marginTop: 8, color: T.textSoft, fontSize: 12, textAlign: 'center' }}>Dev OTP: <b>{window.__DEV_OTP__}</b></p>}
            </div>
            <button className="btn-press" style={{ ...btn(true), width: '100%', padding: '13px', fontSize: 15 }} onClick={doOtp} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & enter →'}
            </button>
            <p style={{ fontSize: 12, color: T.textSoft, textAlign: 'center', marginTop: 14, cursor: 'pointer' }} onClick={() => switchMode('login')}>← Use a different email</p>
          </>}
        </div>
      </div>
    </div>
  )
}

// ── LOGO ──────────────────────────────────────────────────────────────────────
function Logo({ light = false }) {
  return (
    <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 'clamp(15px,4vw,20px)', letterSpacing: '-0.5px', color: light ? '#fff' : T.navy, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ width: 26, height: 26, background: T.coral, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 13 }}>◈</span>
      </div>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Campus<span style={{ color: T.coral }}>Share</span></span>
    </div>
  )
}

// ── LIST ITEM MODAL ───────────────────────────────────────────────────────────
function ListItemModal({ open, onClose, onSuccess, editItemData = null }) {
  const { user, setUser } = useApp()
  const titleRef = useRef(editItemData?.title || '')
  const notesRef = useRef(editItemData?.condition_notes || '')
  const [category, setCat] = useState(editItemData?.category || 'Books')
  const [maxDays, setMaxDays] = useState(editItemData?.max_borrow_days?.toString() || '7')
  const [ltype, setLtype] = useState(editItemData?.listing_type || 'borrow')
  const [txType, setTxType] = useState(editItemData?.transaction_type || 'lend')  // rent|sell|donate|lend
  const [ppd, setPpd] = useState(editItemData?.price_per_day?.toString() || '')
  const [upiId, setUpiId] = useState(user?.upi_id || '')
  const [allowMulti, setAllowMulti] = useState(editItemData?.allow_multiple || false)
  const [photos, setPhotos] = useState([])
  const [previews, setPreviews] = useState(editItemData?.images || [])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    titleRef.current = editItemData?.title || ''
    notesRef.current = editItemData?.condition_notes || ''
    setCat(editItemData?.category || 'Books')
    setMaxDays(editItemData?.max_borrow_days?.toString() || '7')
    setLtype(editItemData?.listing_type || 'borrow')
    setTxType(editItemData?.transaction_type || 'lend')
    setPpd(editItemData?.price_per_day?.toString() || '')
    setAllowMulti(editItemData?.allow_multiple || false)
    setPhotos([])
    setPreviews(editItemData?.images || [])
    setErr('')
  }, [editItemData, open])

  const isPaid = ['rent', 'sell'].includes(txType)
  const isSell = txType === 'sell'
  const noReturn = ['sell', 'donate'].includes(txType)

  function onPhotoPick(e) {
    const files = Array.from(e.target.files).slice(0, 4)
    setPhotos(files); setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function submit() {
    setErr(''); setLoading(true)
    if (isPaid) {
      const trimmedUpi = upiId.trim()
      const UPI_RE = /^[a-zA-Z0-9._\-+]+@[a-zA-Z0-9]+$/
      if (!trimmedUpi) { setErr('Please enter your UPI ID to receive payments.'); setLoading(false); return }
      if (!UPI_RE.test(trimmedUpi)) { setErr('Invalid UPI ID. Expected: name@bank'); setLoading(false); return }
      if (trimmedUpi !== user?.upi_id) {
        const upiRes = await api.updateUpi(trimmedUpi)
        if (upiRes?.error) { setErr(upiRes.error); setLoading(false); return }
        if (upiRes?.user) { setUser(upiRes.user); api.persistUser(upiRes.user) }
      }
    }
    const payload = {
      title: titleRef.current, category,
      conditionNotes: notesRef.current,
      maxBorrowDays: noReturn ? '1' : maxDays,
      listingType: ltype,
      isPaid: isPaid ? 'true' : 'false',
      pricePerDay: isPaid ? ppd : '',
      transactionType: txType,
      allowMultiple: (!noReturn && ltype === 'borrow') ? String(allowMulti) : 'false',
      photos: photos.length > 0 ? photos : undefined,
    }
    const r = editItemData ? await api.editItem(editItemData.id, payload) : await api.listItem(payload)
    setLoading(false)
    if (r.error) return setErr(r.error)
    onSuccess(); onClose()
  }

  const LTypeBtn = ({ val, icon, label }) => (
    <button onClick={() => setLtype(val)} style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: `2px solid ${ltype === val ? T.coral : 'var(--border-soft)'}`, background: ltype === val ? `${T.coral}10` : 'transparent', color: ltype === val ? T.coral : T.textMid, fontWeight: 600, cursor: 'pointer', fontSize: 13, textAlign: 'center', transition: 'all 0.18s' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>{label}
    </button>
  )

  const TX_OPTIONS = isPaid
    ? [{ val: 'rent', icon: '🔄', label: 'Rent it', desc: 'Borrower returns it. Earn per day.' },
    { val: 'sell', icon: '💰', label: 'Sell it', desc: 'No return. One-time payment.' }]
    : [{ val: 'lend', icon: '🤝', label: 'Lend it', desc: 'Free. Borrower returns it.' },
    { val: 'donate', icon: '🎁', label: 'Donate it', desc: 'Free. No return expected.' }]

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ margin: '-8px -24px 20px', padding: '20px 24px 16px', background: `linear-gradient(135deg, ${T.navy} 0%, #1E293B 100%)`, borderRadius: '16px 16px 0 0' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 4 }}>{editItemData ? 'Edit item ✦' : 'List an item ✦'}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Share what you're not using</div>
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-xs)', fontSize: 12, color: 'rgba(255,255,255,0.7)', ...row(6) }}>
          <span>✓</span><span>{user?.name} · {user?.roll_number} · {user?.college_name}</span>
        </div>
      </div>
      {err && <div style={ERR}>{err}</div>}

      <div style={{ ...row(8), marginBottom: 16 }}>
        <LTypeBtn val="borrow" icon="📦" label="Marketplace" />
        <LTypeBtn val="lost_found" icon="🔍" label="Lost & Found" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={LBL}>Item name</label>
        <input style={INP} placeholder="e.g. Casio FX-991EX" defaultValue={titleRef.current} onChange={e => titleRef.current = e.target.value} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={LBL}>Category</label>
        <select style={INP} value={category} onChange={e => setCat(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={LBL}>Condition notes</label>
        <input style={INP} placeholder="e.g. Good condition, minor cover wear" onChange={e => notesRef.current = e.target.value} />
      </div>

      {ltype === 'borrow' && <>
        {/* Paid / Free selector */}
        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>Arrangement</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[['free', '🆓 Free'], ['paid', '💳 Paid']].map(([v, l]) => (
              <button key={v} onClick={() => setTxType(v === 'paid' ? 'rent' : 'lend')} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: `2px solid ${(v === 'paid' ? isPaid : !isPaid) ? T.coral : 'var(--border-soft)'}`, background: (v === 'paid' ? isPaid : !isPaid) ? `${T.coral}10` : 'transparent', color: (v === 'paid' ? isPaid : !isPaid) ? T.coral : T.textMid, fontWeight: 600, cursor: 'pointer', fontSize: 13, transition: 'all 0.18s' }}>{l}</button>
            ))}
          </div>
          {/* Sub-options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {TX_OPTIONS.map(opt => (
              <button key={opt.val} onClick={() => setTxType(opt.val)} style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: `2px solid ${txType === opt.val ? T.coral : 'var(--border-soft)'}`, background: txType === opt.val ? `${T.coral}08` : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: txType === opt.val ? T.coral : T.navy }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: T.textMid, marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {!noReturn && (
          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Max duration</label>
            <select style={INP} value={maxDays} onChange={e => setMaxDays(e.target.value)}>
              {[['1', '1 day'], ['3', '3 days'], ['7', '1 week'], ['14', '2 weeks']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}

        {isPaid && (
          <div style={{ marginBottom: 14, padding: '14px', background: `${T.coral}08`, borderRadius: 'var(--radius-sm)', border: `1.5px solid ${T.coral}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: T.coral }}>{isSell ? '💰 Selling price' : '💳 Price per day'}</div>
            <div style={{ ...row(8), marginBottom: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: T.coral }}>₹</span>
              <input style={{ ...INP, flex: 1 }} type="number" min="1" placeholder={isSell ? 'Total selling price' : 'Amount per day'} value={ppd} onChange={e => setPpd(e.target.value)} />
            </div>
            <div style={{ fontSize: 11, color: T.textMid, marginBottom: 12 }}>{isSell ? 'Buyer pays this amount.' : 'Borrower pays this per day.'}</div>
            <label style={LBL}>Your UPI ID *</label>
            <input style={{ ...INP, borderColor: upiId ? 'var(--border-soft)' : T.coral }} placeholder="name@okicici" value={upiId} onChange={e => setUpiId(e.target.value)} />
          </div>
        )}

        {txType === 'lend' && (
          <div style={{ ...row(10), padding: '12px 14px', background: 'rgba(15,23,42,0.04)', borderRadius: 'var(--radius-xs)', marginBottom: 14, cursor: 'pointer' }} onClick={() => setAllowMulti(m => !m)}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Allow multiple borrowers?</div>
              <div style={{ fontSize: 12, color: T.textMid, marginTop: 2 }}>{allowMulti ? 'Multiple can borrow simultaneously' : 'Only 1 at a time'}</div>
            </div>
            <div style={{ width: 44, height: 24, borderRadius: 12, background: allowMulti ? T.coral : 'rgba(15,23,42,0.12)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: allowMulti ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        )}
      </>}

      <div style={{ marginBottom: 16 }}>
        <label style={LBL}>Photos (up to 4)</label>
        <input type="file" accept="image/*" multiple onChange={onPhotoPick} style={{ fontSize: 13, color: T.textMid }} />
        {previews.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {previews.map((p, i) => (<img key={i} src={p} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-soft)' }} />))}
          </div>
        )}
      </div>

      <div style={{ ...row(8), justifyContent: 'flex-end' }}>
        <button className="btn-press" style={btn(false)} onClick={onClose}>Cancel</button>
        <button className="btn-press" style={btn(true)} onClick={submit} disabled={loading}>{loading ? 'Listing…' : 'List Item ✦'}</button>
      </div>
    </Modal>
  )
}

function BorrowModal({ open, item, onClose, onSuccess, showToast }) {
  const { user } = useApp()
  const msgRef = useRef('')
  const [days, setDays] = useState('3')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const tier = TRUST_TIERS[user?.trust_tier] || TRUST_TIERS.newcomer
  const isLostFound = item?.listing_type === 'lost_found'
  const PLATFORM_FEE_PERCENT = 3
  const rentalCost = item?.is_paid ? parseFloat((parseFloat(item.price_per_day) * parseInt(days)).toFixed(2)) : 0
  const platformFee = item?.is_paid ? parseFloat((rentalCost * PLATFORM_FEE_PERCENT / 100).toFixed(2)) : 0
  const totalCost = item?.is_paid ? parseFloat((rentalCost + platformFee).toFixed(2)) : null

  useEffect(() => { if (open) { setErr(''); setDays('3') } }, [open])

  async function submit() {
    setErr(''); setLoading(true)
    const r = await api.requestBorrow({ itemId: item.id, requestedDays: isLostFound ? 1 : parseInt(days), message: msgRef.current })
    setLoading(false)
    if (r.error) return setErr(r.error)
    onSuccess()
    showToast(isLostFound ? 'Claim sent! Owner will review.' : item.is_paid ? `Request sent! You'll pay ₹${totalCost} after approval.` : `Request sent to ${item.owner_name}!`)
    onClose()
  }

  if (!item) return null
  return (
    <Modal open={open} onClose={onClose}>
      <ModalTitle>{isLostFound ? '🔍 Claim this item' : '📦 Request to borrow'}</ModalTitle>
      <ModalSub>{item.title} · from {item.owner_name}</ModalSub>
      {!isLostFound && <InfoBanner type="success">✓ {tier.label} tier · {tier.limit} borrow slots</InfoBanner>}
      {err && <div style={ERR}>{err}</div>}

      {!isLostFound && (
        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>Duration (max {item.max_borrow_days} days)</label>
          <select style={INP} value={days} onChange={e => setDays(e.target.value)}>
            {[1, 2, 3, 5, 7, 14].filter(d => d <= item.max_borrow_days).map(d => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
          </select>
        </div>
      )}

      {item.is_paid && !isLostFound && (
        <div style={{ marginBottom: 14, padding: '14px', background: `${T.warn}15`, borderRadius: 'var(--radius-sm)', border: `1px solid ${T.warn}44` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 6 }}>💰 Paid rental breakdown</div>
          <div style={{ fontSize: 13, color: '#92400E' }}>₹{item.price_per_day}/day × {days} days</div>
          <div style={{ fontSize: 15, color: '#92400E', fontWeight: 700, marginTop: 6 }}>Total: ₹{totalCost}</div>
          <div style={{ fontSize: 11, color: '#92400E', marginTop: 4, opacity: 0.8 }}>Pay securely via UPI after approval.</div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label style={LBL}>{isLostFound ? 'Why do you think this is yours?' : 'Message (optional)'}</label>
        <input style={INP} placeholder={isLostFound ? 'Describe your item to prove ownership…' : 'e.g. Need for Wednesday exam'} onChange={e => msgRef.current = e.target.value} />
      </div>

      <div style={{ ...row(8), justifyContent: 'flex-end' }}>
        <button className="btn-press" style={btn(false)} onClick={onClose}>Cancel</button>
        <button className="btn-press" style={btn(true)} onClick={submit} disabled={loading}>{loading ? 'Sending…' : isLostFound ? 'Send Claim' : 'Send Request'}</button>
      </div>
    </Modal>
  )
}

// ── LF PICKUP PANEL ───────────────────────────────────────────────────────────
// Draft text is preserved across 8-second polls via a module-level cache.
const _lfPickupDraftCache = {}

function LFPickupPanel({ r, reload, showToast }) {
  const [msg, setMsg] = useState(() => _lfPickupDraftCache[r.id] ?? r.pickup_message ?? '')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(!!r.pickup_message)

  function handleChange(val) {
    _lfPickupDraftCache[r.id] = val
    setMsg(val)
  }

  async function send() {
    if (!msg.trim()) { showToast('Please enter a pickup message.'); return }
    setSaving(true)
    const res = await api.sendPickupMessage(r.id, msg.trim())
    setSaving(false)
    if (res?.error) { showToast(res.error); return }
    setSent(true)
    delete _lfPickupDraftCache[r.id]
    showToast('Pickup message sent!')
    await reload()
  }

  if (sent) return (
    <InfoBanner type="success">✅ Pickup message sent: <strong>"{r.pickup_message || msg}"</strong><br /><span style={{ opacity: 0.8 }}>Waiting for lender to hand over.</span></InfoBanner>
  )

  return (
    <InfoBanner type="info">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>📍 Send pickup message to lender</div>
      <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.8 }}>Tell them where/when you can collect the item.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...INP, flex: 1, fontSize: 13, padding: '8px 12px' }} placeholder="e.g. Hostel B gate, free 4–6pm" value={msg} onChange={e => handleChange(e.target.value)} />
        <button className="btn-press" style={{ ...btn(true, true), whiteSpace: 'nowrap' }} onClick={send} disabled={saving}>{saving ? '…' : 'Send'}</button>
      </div>
    </InfoBanner>
  )
}

// ── PICKUP DETAILS PANEL ──────────────────────────────────────────────────────
// Draft text is stored in a module-level map keyed by request ID so that
// the 8-second auto-refresh of the activity modal does NOT clear what the
// lender is currently typing.
const _pickupDraftCache = {}

function PickupDetailsPanel({ r, reload, showToast }) {
  const [details, setDetails] = useState(() => _pickupDraftCache[r.id] ?? r.pickup_details ?? '')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(!!r.pickup_details)

  // Keep draft cache in sync so a re-mount (caused by poll refresh) restores text
  function handleChange(val) {
    _pickupDraftCache[r.id] = val
    setDetails(val)
  }

  async function send() {
    if (!details.trim()) { showToast('Please enter pickup details.'); return }
    setSaving(true)
    const res = await api.sendPickupDetails(r.id, details.trim())
    setSaving(false)
    if (res?.error) { showToast(res.error); return }
    setSent(true)
    delete _pickupDraftCache[r.id]
    showToast('Pickup details sent!')
    await reload()
  }

  if (sent) return (
    <InfoBanner type="success">
      📍 You told borrower: <strong>"{r.pickup_details || details}"</strong>
      {!r.item_given && <div style={{ marginTop: 4, opacity: 0.8 }}>Once handed over, click "Item Given ✓" below.</div>}
    </InfoBanner>
  )

  return (
    <InfoBanner type="warn">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        {r.is_paid ? '📍 Borrower has paid to admin , send pickup details' : '📍 Send pickup details to borrower'}
      </div>
      <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.8 }}>
        {r.is_paid ? 'You will be paid after item handover is confirmed' : 'Tell them where and when to collect.'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...INP, flex: 1, fontSize: 13, padding: '8px 12px' }} placeholder="e.g. Hostel C room 301, 5–7pm" value={details} onChange={e => handleChange(e.target.value)} />
        <button className="btn-press" style={{ ...btn(true, true), whiteSpace: 'nowrap' }} onClick={send} disabled={saving}>{saving ? '…' : 'Send'}</button>
      </div>
    </InfoBanner>
  )
}

// ── UPI FIELD ─────────────────────────────────────────────────────────────────
function UpiField({ user, setUser, showToast }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(user?.upi_id || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setErr('')
    if (!val.trim()) { setErr('UPI ID cannot be empty.'); return }
    setSaving(true)
    const res = await api.updateUpi(val.trim())
    setSaving(false)
    if (res?.error) { setErr(res.error); return }
    setUser(res.user)
    api.persistUser(res.user)
    setEditing(false)
    showToast('UPI ID saved!')
  }

  const hasUpi = !!user?.upi_id
  return (
    <div style={{ marginBottom: 14, padding: '14px', background: hasUpi ? T.successBg : T.warnBg, borderRadius: 'var(--radius-sm)', border: `1.5px solid ${hasUpi ? T.success : T.warn}33` }}>
      <div style={{ ...row(8), marginBottom: editing ? 12 : 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: hasUpi ? '#065F46' : '#92400E' }}>
            {hasUpi ? '✅ Payout UPI ID' : '⚠️ Add UPI ID to receive payouts'}
          </div>
          {!editing && <div style={{ fontSize: 12, color: T.textMid, marginTop: 2 }}>{hasUpi ? user.upi_id : 'Required for rental earnings'}</div>}
        </div>
        <button className="btn-press" style={{ ...btn(false, true), whiteSpace: 'nowrap' }} onClick={() => { setEditing(e => !e); setVal(user?.upi_id || ''); setErr('') }}>
          {editing ? 'Cancel' : hasUpi ? 'Edit' : 'Add'}
        </button>
      </div>
      {editing && (
        <>
          {err && <div style={{ ...ERR, marginBottom: 8 }}>{err}</div>}
          <div style={{ ...row(8) }}>
            <input style={{ ...INP, flex: 1 }} placeholder="name@okicici" value={val} onChange={e => setVal(e.target.value)} />
            <button className="btn-press" style={btn(true, true)} onClick={save} disabled={saving}>{saving ? '…' : 'Save'}</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── ACTIVITY MODAL ────────────────────────────────────────────────────────────

// ── LIFECYCLE VISUALIZER ──────────────────────────────────────────────────────
// Shows current stage of item lifecycle in a beautiful visual timeline.
// Supports all 4 transaction types: rent, sell, donate, lend

function LifecycleVisualizer({ r, isBorrowing, onClose }) {
  const txType = r.transaction_type || (r.is_paid ? 'rent' : 'lend')
  const isLF = r.listing_type === 'lost_found'

  // Define stages per transaction type
  const STAGES = {
    rent: [
      { id: 'requested', icon: '📝', label: 'Requested', desc: 'Borrower sent request', role: 'both' },
      { id: 'selected', icon: '✅', label: 'Approved', desc: 'Lender approved, payment pending', role: 'both' },
      { id: 'paid', icon: '💳', label: 'Payment Made', desc: 'Borrower paid via UPI/Razorpay', role: 'borrower' },
      { id: 'active', icon: '📍', label: 'Pickup Details Sent', desc: 'Lender shared where to collect', role: 'lender' },
      { id: 'handover', icon: '🤝', label: 'Handover Verified', desc: 'Verified securely via PIN', role: 'both' },
      { id: 'returned', icon: '📦', label: 'Return Confirmed', desc: 'Item returned, slot freed', role: 'lender' },
    ],
    sell: [
      { id: 'requested', icon: '📝', label: 'Requested', desc: 'Buyer sent purchase request', role: 'both' },
      { id: 'selected', icon: '✅', label: 'Approved', desc: 'Seller approved, payment pending', role: 'both' },
      { id: 'paid', icon: '💳', label: 'Payment Made', desc: 'Buyer paid via UPI/Razorpay', role: 'borrower' },
      { id: 'active', icon: '📍', label: 'Meetup Details Sent', desc: 'Seller shared where to handover', role: 'lender' },
      { id: 'handover', icon: '🤝', label: 'Handover Verified', desc: 'Verified securely via PIN', role: 'both' },
      { id: 'returned', icon: '🏁', label: 'Sale Complete', desc: 'Transaction done, no return needed', role: 'both' },
    ],
    donate: [
      { id: 'requested', icon: '📝', label: 'Requested', desc: 'Receiver sent request', role: 'both' },
      { id: 'selected', icon: '✅', label: 'Approved', desc: 'Donor approved the request', role: 'both' },
      { id: 'active', icon: '📍', label: 'Pickup Details Sent', desc: 'Donor shared where to collect', role: 'lender' },
      { id: 'handover', icon: '🤝', label: 'Handover Verified', desc: 'Verified securely via PIN', role: 'both' },
      { id: 'returned', icon: '🎁', label: 'Donation Complete', desc: 'Item received, no return needed', role: 'both' },
    ],
    lend: [
      { id: 'requested', icon: '📝', label: 'Requested', desc: 'Borrower sent request', role: 'both' },
      { id: 'selected', icon: '✅', label: 'Approved', desc: 'Lender approved the request', role: 'both' },
      { id: 'active', icon: '📍', label: 'Pickup Details Sent', desc: 'Lender shared where to collect', role: 'lender' },
      { id: 'handover', icon: '🤝', label: 'Handover Verified', desc: 'Verified securely via PIN', role: 'both' },
      { id: 'returned', icon: '📦', label: 'Return Confirmed', desc: 'Item returned, slot freed', role: 'lender' },
    ],
    lost_found: [
      { id: 'requested', icon: '📝', label: 'Claimed', desc: 'Someone filed a claim', role: 'both' },
      { id: 'selected', icon: '✅', label: 'Claim Accepted', desc: 'Poster accepted the claim', role: 'both' },
      { id: 'active', icon: '📍', label: 'Pickup Arranged', desc: 'Pickup message exchanged', role: 'both' },
      { id: 'returned', icon: '✅', label: 'Item Claimed', desc: 'Item returned to owner', role: 'both' },
    ],
  }

  const stages = isLF ? STAGES.lost_found : (STAGES[txType] || STAGES.lend)

  // Determine current stage index (points to the next pending action)
  function getCurrentStageIndex() {
    if (r.status === 'returned' || r.status === 'completed' || r.status === 'declined' || r.status === 'closed') return stages.length // all done

    if (r.borrower_received || r.item_given || r.handed_over) {
      const i = stages.findIndex(s => s.id === 'returned')
      return i > -1 ? i : stages.length
    }
    if (r.status === 'active' && r.pickup_details) {
      const i = stages.findIndex(s => s.id === 'handover')
      return i > -1 ? i : stages.findIndex(s => s.id === 'returned')
    }
    if (r.status === 'active') {
      return stages.findIndex(s => s.id === 'active')
    }
    if (r.payment_confirmed && r.status === 'selected') {
      return stages.findIndex(s => s.id === 'active')
    }
    if (r.status === 'selected') {
      if (r.is_paid && !r.payment_confirmed) {
        const i = stages.findIndex(s => s.id === 'paid')
        return i > -1 ? i : stages.findIndex(s => s.id === 'active')
      }
      return stages.findIndex(s => s.id === 'active')
    }
    // r.status === 'pending'
    return stages.findIndex(s => s.id === 'selected') // wait for approval
  }

  const currentIdx = getCurrentStageIndex()

  const TX_META = {
    rent: { label: 'Rental', color: '#3B82F6', icon: '🔄' },
    sell: { label: 'Sale', color: '#10B981', icon: '💰' },
    donate: { label: 'Donation', color: '#8B5CF6', icon: '🎁' },
    lend: { label: 'Lending', color: '#F59E0B', icon: '🤝' },
    lost_found: { label: 'L&F', color: '#64748B', icon: '🔍' },
  }
  const meta = isLF ? TX_META.lost_found : (TX_META[txType] || TX_META.lend)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: 0 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="slide-up" style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', paddingBottom: 32 }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: 'rgba(15,23,42,0.12)', borderRadius: 4, margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${T.navy} 0%, #1E293B 100%)`, margin: '12px 0 0', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Item Journey</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                {r.item_title} · {isBorrowing ? 'Your borrowing' : 'Your lending'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${meta.color}33`, border: `1px solid ${meta.color}55`, borderRadius: 20, padding: '4px 10px' }}>
              <span style={{ fontSize: 14 }}>{meta.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.12)', borderRadius: 8, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(((currentIdx + 1) / stages.length) * 100)}%`, background: T.success, borderRadius: 8, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Start</span>
            <span style={{ fontSize: 11, color: T.success, fontWeight: 600 }}>{Math.round(((currentIdx + 1) / stages.length) * 100)}% complete</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Done</span>
          </div>
        </div>

        {/* Stage timeline */}
        <div style={{ padding: '20px 20px 0' }}>
          {stages.map((stage, idx) => {
            const isDone = idx < currentIdx
            const isCurrent = idx === currentIdx
            const isFuture = idx > currentIdx

            const stageColor = isDone ? T.success : isCurrent ? '#64748B' : 'rgba(15,23,42,0.15)'
            const textColor = isDone ? T.success : isCurrent ? '#475569' : T.textSoft

            return (
              <div key={stage.id} style={{ display: 'flex', gap: 12, marginBottom: idx < stages.length - 1 ? 0 : 0 }}>
                {/* Left: circle + line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: isDone ? T.success : isCurrent ? '#F1F5F9' : 'rgba(15,23,42,0.04)',
                    border: `2px solid ${stageColor}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    color: isDone ? '#fff' : isCurrent ? '#64748B' : '#94A3B8',
                    boxShadow: isCurrent ? `0 0 0 4px rgba(100,116,139,0.12)` : 'none',
                    transition: 'all 0.3s',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    {isDone ? '✓' : (idx + 1)}
                  </div>
                  {idx < stages.length - 1 && (
                    <div style={{ width: 2, flex: 1, minHeight: 24, background: isDone ? T.success : 'rgba(15,23,42,0.08)', margin: '2px 0', transition: 'background 0.3s' }} />
                  )}
                </div>

                {/* Right: label + desc */}
                <div style={{ paddingBottom: 20, flex: 1, paddingTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: isCurrent ? 700 : isDone ? 600 : 400, color: textColor, transition: 'all 0.2s' }}>
                      {stage.label}
                    </div>
                    {isCurrent && (
                      <div style={{ fontSize: 10, fontWeight: 700, background: `#F1F5F9`, color: '#64748B', border: `1px solid #CBD5E1`, borderRadius: 20, padding: '1px 8px', letterSpacing: '0.04em' }}>
                        YOU ARE HERE
                      </div>
                    )}
                    {isDone && <span style={{ fontSize: 11, color: T.success }}>✓ Done</span>}
                  </div>
                  <div style={{ fontSize: 12, color: isFuture ? T.textSoft : textColor, marginTop: 2, lineHeight: 1.4, opacity: isFuture ? 0.6 : 1 }}>
                    {stage.desc}
                  </div>
                  {/* Role badge */}
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: stage.role === 'admin' ? '#8B5CF6' : T.textSoft, background: 'rgba(15,23,42,0.05)', borderRadius: 20, padding: '2px 8px' }}>
                      {stage.role === 'lender' ? (txType === 'sell' ? 'Seller action' : 'Lender action')
                        : stage.role === 'borrower' ? (txType === 'sell' ? 'Buyer action' : 'Borrower action')
                          : stage.role === 'admin' ? '⚙️ Admin action'
                            : 'Both parties'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '0 20px' }}>
          <button className="btn-press" style={{ ...btn(false), width: '100%', marginTop: 8 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── ITEM REQUEST MODAL (Borrower posts "I need X") ────────────────────────────
const _itemRequestCache = {}   // preserve draft across re-renders

function RequestsModal({ open, onClose, onSuccess, showToast, editData = null, initialTab = 'browse', markRequestsSeen, reloadActivity, activeHandovers = [], historyHandovers = [], unreadMap = {}, openJourney, closeJourney, lifecycleMap, setChatRequest, targetId, onClearTarget }) {
  const { user } = useApp()
  const [tab, setTab] = useState(initialTab) // 'browse', 'post', 'mine'

  useEffect(() => {
    if (open && targetId) {
      setTimeout(() => {
        const el = document.getElementById(targetId)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (onClearTarget) onClearTarget()
      }, 400)
    }
  }, [open, targetId, onClearTarget])
  
  // Post/Edit form state
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [urgency, setUrgency] = useState('medium')
  const [category, setCategory] = useState('Any')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  // Pre-populate if editing
  useEffect(() => {
    if (editData) {
      setTitle(editData.title || '')
      setDesc(editData.description || '')
      setUrgency(editData.urgency || 'medium')
      setCategory(editData.category || 'Any')
      setTab('post')
    } else {
      setTitle(_itemRequestCache.title || '')
      setDesc(_itemRequestCache.desc || '')
      setUrgency(_itemRequestCache.urgency || 'medium')
      setCategory(_itemRequestCache.category || 'Any')
    }
  }, [editData, open])

  function save(key, val) {
    if (!editData) _itemRequestCache[key] = val
    if (key === 'title') setTitle(val)
    else if (key === 'desc') setDesc(val)
    else if (key === 'urgency') setUrgency(val)
    else if (key === 'category') setCategory(val)
  }

  async function submit() {
    if (!title.trim()) { setErr('Please describe what you need.'); return }
    setLoading(true); setErr('')
    
    const payload = { title: title.trim(), description: desc.trim(), urgency, category }
    const r = editData 
      ? await api.editItemRequest(editData.id, payload)
      : await api.postItemRequest(payload)
      
    setLoading(false)
    if (r?.error) { setErr(r.error); return }
    
    if (!editData) {
      Object.keys(_itemRequestCache).forEach(k => delete _itemRequestCache[k])
    }
    
    showToast(editData ? 'Request updated!' : 'Request posted! Others will be notified.')
    onSuccess(); 
    if (editData) onClose() 
    else setTab('browse')
  }

  const URGENCY_OPTS = [
    { val: 'low', icon: '🟢', label: 'Low', desc: 'No rush' },
    { val: 'medium', icon: '🟡', label: 'Medium', desc: 'Within a day or two' },
    { val: 'high', icon: '🔴', label: 'High', desc: 'Need urgently!' },
  ]

  return (
    <Modal open={open} onClose={onClose} wide={tab === 'browse'}>
      <div style={{ margin: '-8px -24px 20px', padding: '20px 24px 0', background: `linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)`, borderRadius: '16px 16px 0 0' }}>
        <div style={{ ...row(0), justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
            {editData ? 'Edit Request ✏️' : '🙋 Community Requests'}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>
          {tab === 'post' ? 'Post what you need — classmates can offer to help.' : 'Help your classmates by offering items they need.'}
        </div>

        {!editData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: 'rgba(0,0,0,0.25)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
            <button onClick={() => setTab('browse')} style={{
              padding: '14px 8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
              background: tab === 'browse' ? '#fff' : 'transparent',
              color: tab === 'browse' ? '#7C3AED' : 'rgba(255,255,255,0.7)',
              borderRadius: tab === 'browse' ? '10px 10px 0 0' : 0,
            }}>
              🔍 Browse Requests
            </button>
            <button onClick={() => setTab('post')} style={{
              padding: '14px 8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
              background: tab === 'post' ? '#fff' : 'transparent',
              color: tab === 'post' ? '#7C3AED' : 'rgba(255,255,255,0.7)',
              borderRadius: tab === 'post' ? '10px 10px 0 0' : 0,
            }}>
              ✏️ Post a Request
            </button>
          </div>
        )}
      </div>

      {tab === 'browse' && (
        <div className="slide-up">
          <InfoBanner type="info">
            🙋 <strong>Need something?</strong> Switch to the "Post" tab to ask the community.
          </InfoBanner>
          
          <ItemRequestsSection 
            showToast={showToast} 
            currentUserId={user?.id} 
            onMarkSeen={markRequestsSeen} 
            reload={reloadActivity} 
            onEdit={(req) => { setTab('post'); }} // Note: actual editing handled by editData prop from parent
            activeHandovers={activeHandovers}
            historyHandovers={historyHandovers}
            openJourney={openJourney}
            closeJourney={closeJourney}
            lifecycleMap={lifecycleMap}
            setChatRequest={setChatRequest}
            unreadMap={unreadMap}
            user={user}
          />
        </div>
      )}

      {tab === 'post' && (
        <div className="pop-in">
          {err && <div style={ERR}>{err}</div>}

          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>What do you need? *</label>
            <input style={INP} placeholder="e.g. 1 packet Maggi, DSA notes, calculator…" value={title} onChange={e => save('title', e.target.value)} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Category</label>
            <select style={INP} value={category} onChange={e => save('category', e.target.value)}>
              <option>Any</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Details (optional)</label>
            <textarea style={{ ...INP, minHeight: 72, resize: 'vertical', lineHeight: 1.5 }} placeholder="Any specifics? Edition, brand, when you need by…" value={desc} onChange={e => save('desc', e.target.value)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={LBL}>Urgency</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {URGENCY_OPTS.map(o => (
                <button key={o.val} onClick={() => save('urgency', o.val)} style={{ padding: '10px 8px', borderRadius: 'var(--radius-sm)', border: `2px solid ${urgency === o.val ? T.coral : 'var(--border-soft)'}`, background: urgency === o.val ? `${T.coral}10` : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.18s' }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{o.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: urgency === o.val ? T.coral : T.navy }}>{o.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...row(8), justifyContent: 'flex-end' }}>
            <button className="btn-press" style={btn(false)} onClick={() => { if (editData) onClose(); else setTab('browse'); }}>{editData ? 'Cancel' : 'Back to Browse'}</button>
            <button className="btn-press" style={{ ...btn(true), background: '#7C3AED' }} onClick={submit} disabled={loading}>{loading ? 'Saving…' : editData ? 'Update Request' : 'Post Request 🙋'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── ITEM REQUESTS SECTION ─────────────────────────────────────────────────────
// module-level offer note draft cache — survives polls
const _offerNoteDraftCache = {}

function ItemRequestsSection({ showToast, currentUserId, reload: reloadActivity, onMarkSeen, onEdit, activeHandovers = [], historyHandovers = [], openJourney, closeJourney, lifecycleMap = {}, setChatRequest, unreadMap = {}, user }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [offers, setOffers] = useState({})
  // borrowReqs keyed by item_request id — for inline lifecycle after acceptance
  const [borrowReqs, setBorrowReqs] = useState({})
  const [showOffer, setShowOffer] = useState(null)
  const [offerTxType, setOfferTxType] = useState('lend')
  const [offerPrice, setOfferPrice] = useState('')
  const [offerErr, setOfferErr] = useState('')
  const [offerSaving, setOfferSaving] = useState(false)
  const pollRef = useRef(null)
  const reqsRefIRS = useRef([])  // stable ref to avoid re-mounting on poll

  // preserve offer note drafts across polls
  const offerNoteRef = useRef(_offerNoteDraftCache[showOffer] || '')
  useEffect(() => { offerNoteRef.current = _offerNoteDraftCache[showOffer] || '' }, [showOffer])

  async function load(q = search) {
    const r = await api.getItemRequests(q)
    if (r?.error) { setLoading(false); return }
    const newReqs = r.requests || []
    // Smart merge — only update if something changed so inputs aren't disrupted
    const prev = JSON.stringify(reqsRefIRS.current.map(x => ({ id: x.id, status: x.status, offer_count: x.offer_count })))
    const next = JSON.stringify(newReqs.map(x => ({ id: x.id, status: x.status, offer_count: x.offer_count })))
    if (prev !== next) { reqsRefIRS.current = newReqs; setRequests(newReqs) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    pollRef.current = setInterval(() => load(), 15000)
    return () => clearInterval(pollRef.current)
  }, []) // eslint-disable-line

  async function loadOffers(reqId) {
    const r = await api.getItemRequestOffers(reqId)
    if (!r?.error) setOffers(prev => ({ ...prev, [reqId]: r.offers || [] }))
  }

  // Load borrow request for an accepted offer — used to show inline lifecycle
  async function loadBorrowReq(reqId, borrowRequestId) {
    if (!borrowRequestId) return
    const r = await api.getMyRequests()
    if (!r?.error) {
      const br = (r.requests || []).find(x => x.id === borrowRequestId)
      if (br) setBorrowReqs(prev => ({ ...prev, [reqId]: br }))
    }
  }

  async function toggleExpand(req) {
    const reqId = req.id
    if (expanded === reqId) { setExpanded(null); return }
    setExpanded(reqId)
    await loadOffers(reqId)
    // If accepted, also load the borrow request for inline lifecycle
    if (req.status === 'closed' && req.accepted_offer_id) {
      await loadBorrowReq(reqId, req.linked_borrow_request_id)
    }
  }

  async function submitOffer() {
    setOfferErr(''); setOfferSaving(true)
    const isPaid = ['rent', 'sell'].includes(offerTxType)
    const price = offerPrice
    if (isPaid && (!price || parseFloat(price) <= 0)) {
      setOfferErr('Please enter a price.'); setOfferSaving(false); return
    }
    const note = offerNoteRef.current
    const r = await api.makeOffer(showOffer, { transactionType: offerTxType, note, price })
    setOfferSaving(false)
    if (r?.error) { setOfferErr(r.error); return }
    showToast('Offer sent! Requester will review.')
    delete _offerNoteDraftCache[showOffer]
    setShowOffer(null)
    setOfferTxType('lend'); setOfferPrice(''); setOfferErr('')
    await loadOffers(showOffer)
    load()
  }

  async function acceptOffer(reqId, offerId, req) {
    if (!window.confirm('Accept this offer? The lifecycle will continue here — no need to go to marketplace.')) return
    const r = await api.acceptOffer(reqId, offerId)
    if (r?.error) { showToast(r.error); return }
    showToast('✅ Offer accepted! Continue the handover below.')
    load()
    await loadOffers(reqId)
    if (r.borrowRequestId) {
      await loadBorrowReq(reqId, r.borrowRequestId)
    }
    if (reloadActivity) reloadActivity()
  }

  async function declineOffer(reqId, offerId) {
    const r = await api.declineOffer(reqId, offerId)
    if (r?.error) { showToast(r.error); return }
    showToast('Offer declined.')
    await loadOffers(reqId)
  }

  async function closeRequest(reqId) {
    if (!window.confirm('Close this request?')) return
    const r = await api.closeItemRequest(reqId)
    if (r?.error) { showToast(r.error); return }
    showToast('Request closed.')
    load()
  }

  const URGENCY_COLOR = { low: T.success, medium: T.warn, high: T.error }
  const TX_ICONS = { rent: '🔄', sell: '💰', donate: '🎁', lend: '🤝' }
  const TX_LABELS = { rent: 'Rent', sell: 'Sell', donate: 'Donate', lend: 'Lend' }

  return (
    <div>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>🔎</span>
        <input style={{ ...INP, paddingLeft: 36, borderRadius: 40, fontSize: 13 }}
          placeholder="Search requests…"
          value={search} onChange={e => { setSearch(e.target.value); load(e.target.value) }} />
      </div>

      {loading && [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 190, borderRadius: 12 }} />)}
      {!loading && requests.length === 0 && activeHandovers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: T.textSoft }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🙋</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No open requests yet</div>
          <div style={{ fontSize: 13 }}>Switch to "Post a Request" to ask the community!</div>
        </div>
      )}

      {/* 2-column card grid matching marketplace */}
      <div className="item-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
        {requests.map(req => {
          const isOwn = req.requester_id === currentUserId
          const isOpen = req.status === 'open'
          const reqOffers = offers[req.id] || []
          const isExp = expanded === req.id
          const accepted = reqOffers.find(o => o.status === 'accepted') || (req.status === 'closed' && req.accepted_offer_id ? { offerer_name: 'Matched User', transaction_type: 'lend' } : null)
          const urgencyColor = URGENCY_COLOR[req.urgency] || T.textSoft
          const urgencyLabel = req.urgency === 'high' ? '🔴 Urgent' : req.urgency === 'medium' ? '🟡 Medium' : '🟢 Low'

          // Find if there's an active handover for this request
          const inlineBR = activeHandovers.find(ah => ah.item_title === req.title && (ah.borrower_id === req.requester_id || ah.owner_id === req.requester_id))

          // Hide closed requests if they no longer have an active handover
          if (req.status === 'closed' && !inlineBR) return null

          return (
            <div key={req.id} className="item-card" style={{ ...card, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', cursor: 'pointer' }}>
              {/* Top colour strip — replaces image */}
              <div style={{ height: 100, background: `linear-gradient(135deg, ${urgencyColor}18 0%, ${urgencyColor}08 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative', borderBottom: `1px solid ${urgencyColor}22` }}>
                <Av user={{ name: req.requester_name, avatar: req.requester_avatar, color: req.requester_color }} size={38} />
                <span style={{ fontSize: 11, background: `${urgencyColor}22`, color: urgencyColor, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{urgencyLabel}</span>
                {req.status === 'closed' && (
                  <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, background: `${T.success}20`, color: T.success, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>✅ Matched</span>
                )}
                {isOwn && (
                  <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, background: `${T.coral}22`, color: T.coral, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>Yours</span>
                )}
                {req.offer_count > 0 && req.status === 'open' && (
                  <span style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, background: `${T.info}20`, color: T.info, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{req.offer_count} offer{req.offer_count > 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Card body */}
              <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 700, marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{req.title}</div>
                <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {req.requester_name?.split(' ')[0]}{req.category && req.category !== 'Any' ? ` · ${req.category}` : ''}
                </div>
                {req.description && (
                  <div style={{ fontSize: 11, color: T.textMid, marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontStyle: 'italic' }}>"{req.description}"</div>
                )}

                {/* CTA */}
                <div style={{ marginTop: 'auto' }}>
                  {!isOwn && isOpen && (
                    <button className="btn-press" style={{ ...btn(true, true), background: '#7C3AED', width: '100%', fontSize: 12, marginBottom: 4 }}
                      onClick={e => { e.stopPropagation(); setShowOffer(req.id); setOfferErr('') }}>
                      🤝 Offer to Help
                    </button>
                  )}
                  {isOwn && isOpen && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-press" style={{ ...btn(false, true), flex: 1, color: T.info, border: `1px solid ${T.info}33`, fontSize: 11 }}
                        onClick={e => { e.stopPropagation(); onEdit && onEdit(req) }}>✏️ Edit</button>
                      <button className="btn-press" style={{ ...btn(false, true), flex: 1, color: T.error, border: `1px solid ${T.error}33`, fontSize: 11 }}
                        onClick={e => { e.stopPropagation(); closeRequest(req.id) }}>Close</button>
                    </div>
                  )}
                  {!isOpen && !inlineBR && (
                    <div style={{ fontSize: 11, color: T.textSoft, textAlign: 'center', padding: '4px 0' }}>
                      {accepted ? `Matched with ${accepted.offerer_name}` : 'Closed'}
                    </div>
                  )}
                  {/* Inline Handover actions if available */}
                  {inlineBR && (
                    <div style={{ margin: '8px -12px -12px' }} onClick={e => e.stopPropagation()}>
                      <ReqCard r={inlineBR} isBorrowing={inlineBR.borrower_id === currentUserId} user={user} showToast={showToast} reload={reloadActivity} openJourney={openJourney} closeJourney={closeJourney} lifecycleMap={lifecycleMap} openChat={setChatRequest} unreadCount={unreadMap[inlineBR.id] || 0} inlineReq={true} />
                    </div>
                  )}

                  {/* Expand to see offers */}
                  {(isOwn || req.offer_count > 0) && isOpen && (
                    <button onClick={e => { e.stopPropagation(); toggleExpand(req) }} style={{ background: 'none', border: 'none', fontSize: 11, color: T.info, cursor: 'pointer', padding: '2px 0', width: '100%', textAlign: 'center' }}>
                      {isExp ? '▲ Hide offers' : `▼ View offers (${req.offer_count || 0})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded offers panel */}
              {isExp && isOpen && (
                <div style={{ borderTop: `1px solid var(--border-soft)`, padding: '10px 12px', background: 'rgba(15,23,42,0.02)' }}>
                  {reqOffers.length === 0 && <div style={{ fontSize: 12, color: T.textSoft, textAlign: 'center' }}>No offers yet.</div>}
                  {reqOffers.map(offer => (
                    <div key={offer.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(15,23,42,0.03)', borderRadius: 'var(--radius-xs)', marginBottom: 5 }}>
                      <Av user={{ name: offer.offerer_name, color: offer.offerer_color }} size={24} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{TX_ICONS[offer.transaction_type]} {offer.offerer_name} — {TX_LABELS[offer.transaction_type]}{offer.price > 0 && <span style={{ color: T.coral }}> ₹{offer.price}</span>}</div>
                        {offer.note && <div style={{ fontSize: 11, color: T.textMid }}>"{offer.note}"</div>}
                      </div>
                      {offer.status === 'accepted' && <span style={{ fontSize: 11, color: T.success, fontWeight: 700 }}>✓</span>}
                      {offer.status === 'declined' && <span style={{ fontSize: 11, color: T.error }}>✗</span>}
                      {isOwn && isOpen && offer.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 3 }}>
                          <button className="btn-press" style={{ ...btn(true, true), fontSize: 10, padding: '3px 8px' }} onClick={() => acceptOffer(req.id, offer.id, req)}>Accept</button>
                          <button className="btn-press" style={{ ...btn(false, true), fontSize: 10, padding: '3px 8px', color: T.error }} onClick={() => declineOffer(req.id, offer.id)}>Decline</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Offer bottom sheet (using Portal to escape modal overflow clipping) */}
      {showOffer && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowOffer(null) }}>
          <div className="slide-up" style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '20px 24px 32px' }}>
            <div style={{ width: 40, height: 4, background: 'rgba(15,23,42,0.12)', borderRadius: 4, margin: '-8px auto 20px' }} />
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Make an Offer</div>
            {offerErr && <div style={ERR}>{offerErr}</div>}

            <label style={LBL}>How do you want to share it?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
              {[{ val: 'lend', icon: '🤝', l: 'Lend (free)' }, { val: 'donate', icon: '🎁', l: 'Donate' }, { val: 'rent', icon: '🔄', l: 'Rent (paid)' }, { val: 'sell', icon: '💰', l: 'Sell' }].map(o => (
                <button key={o.val} onClick={() => setOfferTxType(o.val)} style={{ padding: '10px', borderRadius: 'var(--radius-xs)', border: `2px solid ${offerTxType === o.val ? T.coral : 'var(--border-soft)'}`, background: offerTxType === o.val ? `${T.coral}08` : 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: offerTxType === o.val ? T.coral : T.navy }}>
                  {o.icon} {o.l}
                </button>
              ))}
            </div>
            {['rent', 'sell'].includes(offerTxType) && (
              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>{offerTxType === 'sell' ? 'Selling price (₹)' : 'Price per day (₹)'}</label>
                <input style={INP} type="number" min="1" placeholder="Enter amount" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={LBL}>Note (optional)</label>
              <input style={INP} placeholder="Condition, availability, any details…"
                defaultValue={_offerNoteDraftCache[showOffer] || ''}
                onChange={e => { _offerNoteDraftCache[showOffer] = e.target.value; offerNoteRef.current = e.target.value }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-press" style={btn(false)} onClick={() => setShowOffer(null)}>Cancel</button>
              <button className="btn-press" style={{ ...btn(true), flex: 1, background: '#7C3AED' }} onClick={submitOffer} disabled={offerSaving}>
                {offerSaving ? 'Sending…' : 'Send Offer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── INLINE LIFECYCLE PANEL ────────────────────────────────────────────────────
// Removed as it is now handled by ReqCard inside the Activity tab.

function ReqCard({ r, isBorrowing, user, showToast, reload, openJourney, closeJourney, lifecycleMap, openChat, unreadCount = 0, inlineReq = false }) {
  const isPaid = r.is_paid
  const isLF = r.listing_type === 'lost_found'
  const showLifecycle = !!lifecycleMap[r.id]
  const [pin, setPin] = useState('')

  const statusColors = { pending: '#F59E0B', selected: T.coral, active: T.navy, returned: T.success, declined: T.error, overdue: T.error }
  const accentColor = statusColors[r.status] || T.navy

  async function act(fn, ...args) {
    try {
      const res = await fn(...args)
      if (res?.error) { showToast(res.error); return res }
      await reload()
      return res
    } catch (err) { console.error(err); return { error: 'Something went wrong' } }
  }

  return (
    <div id={`req-${r.id}`} className={inlineReq ? '' : 'fade-in'} style={{ 
      borderRadius: inlineReq ? 0 : 'var(--radius-sm)', 
      marginBottom: inlineReq ? 0 : 12, 
      background: inlineReq ? 'transparent' : '#fff', 
      boxShadow: inlineReq ? 'none' : 'var(--shadow)', 
      overflow: 'hidden', 
      border: inlineReq ? 'none' : `1px solid ${accentColor}22`, 
      borderLeft: inlineReq ? 'none' : `4px solid ${accentColor}`,
      borderTop: inlineReq ? `1px solid var(--border-soft)` : undefined
    }}>
      {/* Card header with navy background */}
      {!inlineReq && (
        <div style={{ background: `linear-gradient(135deg, ${T.navy} 0%, #1E293B 100%)`, padding: '12px 14px', ...row(10) }}>
          <Av user={isBorrowing ? { name: r.owner_name } : { avatar: r.borrower_avatar, color: r.borrower_color }} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff', fontFamily: 'var(--font-head)' }}>{r.item_title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              {isBorrowing ? `from ${r.owner_name}` : r.borrower_name}
              {!isLF && ` · ${r.requested_days}d`}
              {isPaid && <span style={{ color: T.coral, fontWeight: 600 }}> · ₹{r.total_amount}</span>}
              {r.message ? ` · "${r.message}"` : ''}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <SBadge status={r.status} inline />
          </div>
        </div>
      )}

      {/* Journey strip — elegant soft blue gradient */}
      <div
        onClick={() => openJourney(r.id)}
        className="btn-press"
        style={{ background: 'linear-gradient(90deg, #EFF6FF 0%, #DBEAFE 100%)', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #BFDBFE', borderBottom: '1px solid #BFDBFE', borderRadius: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>
            {r.status === 'pending' ? '📝' : r.status === 'selected' ? '✅' : r.status === 'active' ? '🤝' : r.status === 'returned' ? '📦' : r.status === 'declined' ? '❌' : '⚠️'}
          </span>
          <div>
            <div style={{ fontSize: 10, color: '#3B82F6', letterSpacing: '0.04em', fontWeight: 800, textTransform: 'uppercase' }}>Current Stage</div>
            <div style={{ fontSize: 14, color: '#1E3A8A', fontWeight: 800 }}>
              {r.status === 'pending' ? 'Waiting for approval' : r.status === 'selected' ? 'Approved' : r.status === 'active' ? 'Active' : ['returned', 'completed', 'closed'].includes(r.status) ? 'Complete ✓' : r.status === 'declined' ? 'Declined' : 'Overdue'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1D4ED8', borderRadius: 20, padding: '6px 14px', color: '#fff', boxShadow: '0 2px 8px rgba(29,78,216,0.3)' }}>
          <span style={{ fontSize: 12 }}>📍</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Track Journey</span>
        </div>
      </div>

      {showLifecycle && <LifecycleVisualizer r={r} isBorrowing={isBorrowing} onClose={() => closeJourney(r.id)} />}

      <div style={{ padding: '10px 10px 12px' }}>

        {/* ── CONTEXTUAL GUIDE: what to do right now ── */}
        {(() => {
          const guide = getGuide(r, isBorrowing)

          if (!guide) return null
          return (
            <div style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#F8FAFC', borderRadius: 'var(--radius-xs)', border: '1px solid #E2E8F0', marginBottom: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{guide.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 2 }}>{guide.title}</div>
                <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>{guide.body}</div>
              </div>
            </div>
          )
        })()}

        {r.status === 'active' && r.due_at && (
          <div style={{ fontSize: 12, color: T.textMid, marginBottom: 8, ...row(6) }}>
            <span>📅</span>
            <span>Due: {new Date(r.due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {new Date() > new Date(r.due_at) && <span style={{ color: T.error, fontWeight: 600 }}>⚠ Overdue</span>}
          </div>
        )}

        {/* LF flow */}
        {isLF && isBorrowing && r.status === 'selected' && <LFPickupPanel r={r} reload={reload} showToast={showToast} />}
        {isLF && !isBorrowing && r.status === 'selected' && (
          <InfoBanner type="info">
            {r.pickup_message ? <>📍 Claimer says: <strong>"{r.pickup_message}"</strong></> : '⏳ Waiting for claimer to send pickup location…'}
          </InfoBanner>
        )}
        {isLF && isBorrowing && r.status === 'active' && <InfoBanner type="success">✅ Lender handed over the item. Confirm receipt below.</InfoBanner>}

        {/* Marketplace handover */}
        {!isLF && !isBorrowing && r.status === 'active' && <PickupDetailsPanel r={r} reload={reload} showToast={showToast} />}
        {/* Paid info */}
        {isBorrowing && ['selected', 'active'].includes(r.status) && isPaid && r.payment_confirmed && !r.item_given && (
          <div style={{ fontSize: 11, color: '#059669', marginBottom: 8, textAlign: 'center', fontWeight: 500 }}>
            ✅ You have paid, admin has received, and will pay lender after handover.
          </div>
        )}

        {/* Payout banners */}
        {!isBorrowing && isPaid && r.payout_status === 'admin_paid' && (
          <InfoBanner type="warn">💸 Admin sent your payment. Check UPI and confirm below.</InfoBanner>
        )}
        {!isBorrowing && isPaid && r.payout_status === 'disputed' && (
          <InfoBanner type="error">⚠️ Dispute raised — admin notified and will resolve shortly.</InfoBanner>
        )}
        {!isBorrowing && isPaid && r.payout_status === 'done' && r.status !== 'returned' && (
          <InfoBanner type="success">✅ Payment received. Confirm return when item is back.</InfoBanner>
        )}

        {/* ACTION BUTTONS */}
        <div className="req-actions" style={{ ...row(8), flexWrap: 'wrap', marginTop: 8 }}>

          {/* Chat button */}
          {['active', 'overdue'].includes(r.status) && (
            <button className="btn-press" style={{ ...btn(false, true), background: '#25D366', color: '#fff', border: 'none', flex: 1, position: 'relative' }} onClick={() => openChat(r)}>
              💬 Chat
              {unreadCount > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: T.coral, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{unreadCount}</span>}
            </button>
          )}

          {/* Report Lender Button (borrower only, active phase, not yet handed over) */}
          {isBorrowing && r.status === 'active' && !r.item_given && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                className="btn-press"
                style={{ ...btn(false, true), background: r.borrower_complaint ? '#FCEBEB' : '#fff', color: r.borrower_complaint ? '#c0392b' : '#666', border: '1px solid #e74c3c', width: '100%' }}
                onClick={async () => {
                  if (r.borrower_complaint) { showToast('Admin has been informed. Please wait.'); return }
                  if (!window.confirm("Lender not responding? Report to admin for help/refund.")) return
                  const res = await api.reportLender(r.id)
                  if (res?.error) { showToast(res.error); return }
                  showToast('Admin has been notified. We will resolve this shortly.')
                  await reload()
                }}
                disabled={r.borrower_complaint}
              >
                {r.borrower_complaint ? '⚠️ Reported to Admin' : '🚩 Report Lender'}
              </button>
              {!r.borrower_complaint && (
                <div style={{ fontSize: 10, color: '#999', textAlign: 'center', lineHeight: 1.2 }}>
                  (Admin will nudge lender or refund)
                </div>
              )}
            </div>
          )}

          {/* Pay button */}
          {isBorrowing && r.status === 'selected' && isPaid && !r.payment_confirmed && (
            <button className="btn-press" style={{ ...btn(true, true), flex: 1 }} onClick={async () => {
              const orderRes = await api.createPaymentOrder(r.id)
              if (orderRes?.error) { showToast(orderRes.error); return }
              if (!window.Razorpay) {
                await new Promise((resolve, reject) => {
                  const s = document.createElement('script')
                  s.src = 'https://checkout.razorpay.com/v1/checkout.js'
                  s.onload = resolve; s.onerror = reject
                  document.body.appendChild(s)
                })
              }
              const rzp = new window.Razorpay({
                key: orderRes.keyId, amount: orderRes.amount, currency: orderRes.currency,
                name: 'CampusShare', description: `Rental: ${r.item_title}`,
                order_id: orderRes.orderId, theme: { color: T.coral },
                handler: async (response) => {
                  const verifyRes = await api.verifyPayment({
                    requestId: r.id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  })
                  if (verifyRes?.error) { showToast('Verification failed. Contact support.'); return }
                  const activateRes = await api.activateAfterPayment(r.id)
                  if (activateRes?.error) {
                    console.warn('Activate warning:', activateRes.error)
                  }
                  showToast('Payment successful! Lender has been notified to send pickup details.')
                  await reload()
                },
                modal: { ondismiss: () => showToast('Payment cancelled.') },
              })
              rzp.open()
            }}>
              Pay ₹{r.total_amount} via UPI
            </button>
          )}

          {/* Approve/Decline */}
          {!isBorrowing && r.status === 'pending' && (
            <>
              {isPaid && !user?.upi_id && (
                <InfoBanner type="error">⚠️ Add UPI ID in Profile tab before approving paid requests.</InfoBanner>
              )}
              <button className="btn-press" style={{ ...btn(true, true) }} onClick={async () => {
                if (isPaid && !user?.upi_id) { showToast('Add UPI ID in Profile first.'); return }
                try {
                  const res = await api.approveRequest(r.id)
                  if (res?.error) { showToast(res.error); return }
                  showToast('Approved!')
                  await reload()
                } catch (err) { console.error(err); showToast('Approval failed') }
              }}>Approve</button>
              <button className="btn-press" style={btn(false, true)} onClick={async () => { await act(api.declineRequest, r.id); showToast('Declined.') }}>Decline</button>
            </>
          )}

          {/* Confirm & proceed (non-paid) */}
          {!isBorrowing && r.status === 'selected' && !isPaid && !isLF && (
            <button className="btn-press" style={btn(true, true)} onClick={async () => {
              const res = await act(api.finalizeBorrow, r.id)
              if (res && !res.error) { showToast('Confirmed! Send pickup details.'); await reload() }
            }}>Confirm &amp; Proceed</button>
          )}

          {/* Revoke */}
          {isBorrowing && r.status === 'pending' && (
            <button className="btn-press" style={{ ...btn(false, true), color: T.error, border: `1px solid ${T.error}44` }} onClick={async () => {
              if (!window.confirm('Revoke this request?')) return
              const res = await api.revokeRequest(r.id)
              if (res?.error) { showToast(res.error); return }
              showToast('Request revoked.')
              await reload()
            }}>Revoke</button>
          )}

          {/* Handover PIN Display (Borrower) */}
          {!isLF && isBorrowing && r.status === 'active' && !r.item_given && r.handover_pin && (
            <div style={{ width: '100%', background: '#F8FAFC', padding: '12px', borderRadius: 8, border: `1px solid ${T.navy}33`, textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Your Secret Handover PIN</div>
              <div style={{ fontSize: 32, letterSpacing: '8px', color: T.navy, fontWeight: 800 }}>{r.handover_pin}</div>
              <div style={{ fontSize: 11, color: T.textMid, marginTop: 4 }}>Give this PIN to the lender when they hand you the item.</div>
            </div>
          )}

          {/* Item given (Lender PIN Verify) */}
          {!isLF && !isBorrowing && r.status === 'active' && r.pickup_details && !r.item_given && (
            <div style={{ width: '100%', background: '#F8FAFC', padding: '12px', borderRadius: 8, border: `1px solid ${T.navy}33` }}>
              <div style={{ fontSize: 12, color: T.navy, marginBottom: 8, fontWeight: 600, textAlign: 'center' }}>
                🔒 Ask the borrower for their 4-digit PIN to confirm handover
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="PIN" 
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  style={{ ...INP, flex: 1, letterSpacing: '4px', textAlign: 'center', fontSize: 16, fontWeight: 700 }} 
                />
                <button 
                  className="btn-press" 
                  style={{ ...btn(true, true), opacity: pin.length === 4 ? 1 : 0.5 }} 
                  disabled={pin.length !== 4}
                  onClick={async () => {
                    const res = await api.verifyHandover(r.id, pin)
                    if (res?.error) { showToast(res.error); return }
                    showToast('Handover Verified! Status updated.')
                    await reload()
                  }}
                >
                  Verify
                </button>
              </div>
            </div>
          )}

          {/* LF handover buttons */}
          {isLF && !isBorrowing && r.status === 'selected' && r.pickup_message && (
            <button className="btn-press" style={btn(true, true)} onClick={async () => {
              const res = await api.confirmHandover(r.id)
              if (res?.error) { showToast(res.error); return }
              showToast('Handed over! Waiting for claimer.')
              await reload()
            }}>Handed Over ✓</button>
          )}
          {isLF && isBorrowing && r.status === 'active' && (
            <button className="btn-press" style={btn(true, true)} onClick={async () => {
              if (!window.confirm('Confirm you received this item?')) return
              const res = await api.confirmLFReceived(r.id)
              if (!res || res.error) { showToast(res?.error || 'Something went wrong.'); return }
              showToast('Item received! Lost & found case closed.')
              await reload()
            }}>I've Received It ✓</button>
          )}

          {/* Payout confirm/dispute */}
          {!isBorrowing && isPaid && r.payout_status === 'admin_paid' && (
            <>
              <button className="btn-press" style={{ ...btn(true, true), flex: 1, background: T.success }} onClick={async () => {
                const res = await api.confirmPaymentReceived(r.id)
                if (res?.error) { showToast(res.error); return }
                showToast('Payment confirmed!')
                await reload()
              }}>Payment Received ✓</button>
              <button className="btn-press" style={{ ...btn(false, true), flex: 1, color: T.error, border: `1px solid ${T.error}44` }} onClick={async () => {
                if (!window.confirm('Raise dispute? Admin will be notified.')) return
                const res = await api.raiseDispute(r.id)
                if (res?.error) { showToast(res.error); return }
                showToast('Dispute raised. Admin notified.')
                await reload()
              }}>Raise Dispute ⚠️</button>
            </>
          )}

          {/* Confirm return */}
          {!isBorrowing && r.listing_type !== 'lost_found' && ['active', 'overdue'].includes(r.status) && r.borrower_received && (
            <button className="btn-press" style={btn(true, true)} onClick={async () => {
              const res = await act(api.confirmReturn, r.id)
              if (!res || res.error) { showToast("Return failed"); return }
              showToast(res.onTime === false ? 'Return confirmed (late).' : 'Return confirmed!')
            }}>Confirm Return</button>
          )}
          {/* Waiting banner removed as guide handles it */}
        </div>
      </div>{/* end card body */}
    </div>
  )
}

function getGuide(r, isBorrowing) {
  if (!r) return null;
  const isPaid = r.is_paid
  const txType = r.transaction_type || (isPaid ? 'rent' : 'lend')
  const noReturn = ['sell', 'donate'].includes(txType)
  let guide = null

  if (isBorrowing) {
    if (r.status === 'pending')
      guide = { icon: '⏳', title: 'Waiting for approval', body: 'Lender will review your request.' }
    else if (r.status === 'selected' && isPaid && !r.payment_confirmed)
      guide = { icon: '💳', title: 'Action needed: Pay now', body: 'Tap "Pay via UPI" below to confirm.' }
    else if (r.status === 'selected' && (!isPaid || r.payment_confirmed))
      guide = { icon: '📍', title: 'Awaiting pickup details', body: 'Lender will share where to collect.' }
    else if (r.status === 'active' && !r.pickup_details)
      guide = { icon: '📍', title: 'Waiting for pickup details', body: 'Lender will share where to collect.' }
    else if (r.status === 'active' && r.pickup_details && !r.item_given)
      guide = { icon: '🚶', title: 'Go collect the item!', body: `Collect from: "${r.pickup_details}".` }
    else if (r.status === 'active' && r.item_given && !r.borrower_received)
      guide = { icon: '🤝', title: 'Action needed: Confirm receipt', body: 'Lender handed over the item. Tap to confirm.' }
    else if (r.status === 'active' && r.borrower_received && !noReturn)
      guide = { icon: '📦', title: 'Return it when done', body: 'Return before due date.' }
    else if (r.status === 'returned')
      guide = { icon: '✅', title: 'All done!', body: 'Transaction complete.' }
  } else {
    if (r.status === 'pending')
      guide = { icon: '📝', title: 'Review request', body: 'Approve or decline below.' }
    else if (r.status === 'selected' && !isPaid)
      guide = { icon: '📍', title: 'Action needed: Send pickup details', body: 'Tap "Confirm & Proceed".' }
    else if (r.status === 'active' && !r.pickup_details)
      guide = { icon: '📍', title: 'Action needed: Send pickup details', body: 'Type where and when to hand over.' }
    else if (r.status === 'active' && r.pickup_details && !r.item_given)
      guide = { icon: '🤝', title: 'Hand it over', body: 'Once physically handed over, tap "Item Given ✓".' }
    else if (r.status === 'active' && r.item_given && !r.borrower_received)
      guide = { icon: '⏳', title: 'Waiting for borrower', body: 'Borrower needs to confirm receipt.' }
    else if (r.status === 'active' && r.borrower_received && isPaid && r.payout_status === 'na')
      guide = { icon: '💸', title: 'Payout coming', body: 'Admin will process payout shortly.' }
    else if (r.payout_status === 'admin_paid')
      guide = { icon: '💰', title: 'Confirm payment', body: 'Check UPI and tap "Payment Received ✓".' }
    else if (r.status === 'active' && r.borrower_received && !isPaid && !noReturn)
      guide = { icon: '📦', title: 'Waiting for return', body: 'When returned, tap "Confirm Return".' }
    else if (r.status === 'returned')
      guide = { icon: '✅', title: 'All done!', body: 'Transaction complete.' }
  }
  return guide
}

function getActionRequired(r, isBorrowing) {
  if (!r) return false;
  if (['returned', 'declined', 'closed'].includes(r.status)) return false;
  const isPaid = r.is_paid;
  const txType = r.transaction_type || (isPaid ? 'rent' : 'lend');
  const noReturn = ['sell', 'donate'].includes(txType);
  if (isBorrowing) {
    if (r.status === 'selected' && isPaid && !r.payment_confirmed) return true;
    if (r.status === 'active' && r.item_given && !r.borrower_received) return true;
    return false;
  } else {
    if (r.status === 'pending') return true;
    if (r.status === 'selected' && !isPaid) return true;
    if (r.status === 'active' && !r.pickup_details) return true;
    if (r.status === 'active' && r.pickup_details && !r.item_given) return true;
    if (r.status === 'active' && r.borrower_received && !noReturn && !isPaid) return true;
    if (r.payout_status === 'admin_paid') return true;
    return false;
  }
}

function ActivityModal({ open, onClose, refresh, showToast, defaultTab, targetId, onClearTarget, newRequestCount = 0, myOffersCount = 0, markRequestsSeen, unreadMap = {}, onMarkRead, lifecycleMap, openJourney, closeJourney, setChatRequest }) {
  const { user, setUser } = useApp()
  const [tab, setTab] = useState(defaultTab || 'borrowing')
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const pollRef = useRef(null)
  const reqsRef = useRef([])   // holds latest data without triggering remounts

  // Smart merge: only update state if something actually changed.
  // This prevents React from remounting child components (which resets text inputs)
  // when the poll returns identical data.
  function mergeReqs(newReqs) {
    const prev = JSON.stringify(reqsRef.current.map(r => ({
      id: r.id, status: r.status, pickup_details: r.pickup_details,
      pickup_message: r.pickup_message, item_given: r.item_given,
      borrower_received: r.borrower_received, payout_status: r.payout_status,
      payment_confirmed: r.payment_confirmed,
    })))
    const next = JSON.stringify(newReqs.map(r => ({
      id: r.id, status: r.status, pickup_details: r.pickup_details,
      pickup_message: r.pickup_message, item_given: r.item_given,
      borrower_received: r.borrower_received, payout_status: r.payout_status,
      payment_confirmed: r.payment_confirmed,
    })))
    if (prev !== next) {
      reqsRef.current = newReqs
      setReqs(newReqs)
    }
    setLastUpdated(new Date())
  }

  async function fetchReqs(silent = false) {
    if (!silent) setLoading(true)
    const r = await api.getMyRequests()
    if (!silent) setLoading(false)
    if (!r.error) mergeReqs(r.requests || [])
  }

  // Track whether an input is focused — pause poll during typing
  const pausePollRef = useRef(false)
  useEffect(() => {
    function onFocusIn(e) { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') pausePollRef.current = true }
    function onFocusOut(e) { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') setTimeout(() => { pausePollRef.current = false }, 2000) }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => { document.removeEventListener('focusin', onFocusIn); document.removeEventListener('focusout', onFocusOut) }
  }, [])

  useEffect(() => {
    if (defaultTab) setTab(defaultTab)
  }, [defaultTab])

  useEffect(() => {
    if (open && targetId) {
      setTimeout(() => {
        const el = document.getElementById(targetId)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (onClearTarget) onClearTarget()
      }, 400)
    }
  }, [open, targetId, onClearTarget])

  useEffect(() => {
    if (!open) {
      clearInterval(pollRef.current)
      return
    }
    fetchReqs(false)
    // Only poll when no input is focused (pause ref). Also skip if Journey modal open.
    pollRef.current = setInterval(() => {
      if (!pausePollRef.current) fetchReqs(true)
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [open]) // eslint-disable-line

  async function reload() { await fetchReqs(true); refresh() }
  async function act(fn, ...args) {
    try {
      const res = await fn(...args)
      if (res?.error) return res
      await reload()
      return res
    } catch (err) { console.error(err); return { error: 'Something went wrong' } }
  }

  const isHistory = (r) => ['returned', 'declined', 'closed'].includes(r.status)

  const borrowing = reqs.filter(r => r.borrower_id === user?.id && !r.from_item_request)
  const activeBorrowing = borrowing.filter(r => !isHistory(r))
  const historyBorrowing = borrowing.filter(r => isHistory(r))

  const lending = reqs.filter(r => r.owner_id === user?.id && !r.from_item_request)
  const activeLending = lending.filter(r => !isHistory(r))
  const historyLending = lending.filter(r => isHistory(r))

  const requestHandovers = reqs.filter(r => r.from_item_request)
  const activeHandovers = requestHandovers.filter(r => !isHistory(r))
  const historyHandovers = requestHandovers.filter(r => isHistory(r))

  const bCount = activeBorrowing.filter(r => getActionRequired(r, true)).length
  const lCount = activeLending.filter(r => getActionRequired(r, false)).length
  const rCount = activeHandovers.filter(r => getActionRequired(r, r.borrower_id === user?.id)).length

  const tier = TRUST_TIERS[user?.trust_tier] || TRUST_TIERS.newcomer
  const activeCount = activeBorrowing.filter(r => ['active', 'selected'].includes(r.status)).length

  const tabs = [
    { id: 'borrowing', label: 'Borrowing', count: activeBorrowing.length, icon: '📥', actionBadge: bCount },
    { id: 'lending', label: 'Lending', count: activeLending.length, icon: '📤', actionBadge: lCount },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ]


  return (
    <Modal open={open} onClose={onClose} wide>
      {/* Navy header */}
      <div style={{ margin: '-8px -24px 20px', padding: '20px 24px 16px', background: `linear-gradient(135deg, ${T.navy} 0%, #1E293B 100%)`, borderRadius: '16px 16px 0 0' }}>
        <div style={{ ...row(0), justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>My Activity</div>
          <div style={{ ...row(6) }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>Updates every 8 seconds</div>

        {/* Tabs on navy */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'requests') markRequestsSeen() }} style={{
              padding: '9px 4px', borderRadius: 'var(--radius-xs)', border: `1.5px solid ${tab === t.id ? T.coral : 'rgba(255,255,255,0.12)'}`,
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: tab === t.id ? T.coral : 'rgba(255,255,255,0.06)',
              color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.6)',
              transition: 'all 0.18s',
            }}>
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {t.icon} {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
                {t.badge > 0 && <span style={{ background: T.coral, color: '#fff', fontSize: 8, fontWeight: 800, borderRadius: 20, minWidth: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{t.badge > 9 ? '9+' : t.badge}</span>}
                {t.actionBadge > 0 && <span style={{ position: 'absolute', top: -12, right: -16, background: T.coral, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{t.actionBadge}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      )}

      {!loading && tab === 'borrowing' && (
        <>
          <div style={{ ...row(8), marginBottom: 12 }}>
            <TierBadge tier={user?.trust_tier} />
            <span style={{ fontSize: 13, color: T.textMid }}>{activeCount}/{tier.limit} slots used</span>
          </div>
          {activeBorrowing.length === 0
            ? <div style={{ textAlign: 'center', padding: '2rem 0', color: T.textSoft }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <div>Nothing active right now.</div>
            </div>
            : activeBorrowing.map(r => <ReqCard key={r.id} r={r} isBorrowing user={user} showToast={showToast} reload={reload} openJourney={openJourney} closeJourney={closeJourney} lifecycleMap={lifecycleMap} openChat={setChatRequest} unreadCount={unreadMap[r.id] || 0} />)
          }

          {historyBorrowing.length > 0 && (
            <details style={{ marginTop: 24 }}>
              <summary style={{ fontSize: 15, fontWeight: 600, color: T.navy, cursor: 'pointer', padding: '10px 0', borderTop: `1px solid var(--border-soft)`, outline: 'none', userSelect: 'none' }}>
                History ({historyBorrowing.length > 10 ? '10+' : historyBorrowing.length})
              </summary>
              <div style={{ paddingTop: 12 }}>
                {historyBorrowing.slice(0, 10).map(r => <ReqCard key={r.id} r={r} isBorrowing user={user} showToast={showToast} reload={reload} openJourney={openJourney} closeJourney={closeJourney} lifecycleMap={lifecycleMap} openChat={setChatRequest} unreadCount={unreadMap[r.id] || 0} />)}
              </div>
            </details>
          )}
        </>
      )}

      {!loading && tab === 'lending' && (
        <>
          {activeLending.length === 0
            ? <div style={{ textAlign: 'center', padding: '2rem 0', color: T.textSoft }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
              <div>No active lending right now. <span style={{ color: T.coral, cursor: 'pointer', fontWeight: 600 }} onClick={onClose}>List an item!</span></div>
            </div>
            : activeLending.map(r => <ReqCard key={r.id} r={r} isBorrowing={false} user={user} showToast={showToast} reload={reload} openJourney={openJourney} closeJourney={closeJourney} lifecycleMap={lifecycleMap} openChat={setChatRequest} unreadCount={unreadMap[r.id] || 0} />)
          }

          {historyLending.length > 0 && (
            <details style={{ marginTop: 24 }}>
              <summary style={{ fontSize: 15, fontWeight: 600, color: T.navy, cursor: 'pointer', padding: '10px 0', borderTop: `1px solid var(--border-soft)`, outline: 'none', userSelect: 'none' }}>
                History ({historyLending.length > 10 ? '10+' : historyLending.length})
              </summary>
              <div style={{ paddingTop: 12 }}>
                {historyLending.slice(0, 10).map(r => <ReqCard key={r.id} r={r} isBorrowing={false} user={user} showToast={showToast} reload={reload} openJourney={openJourney} closeJourney={closeJourney} lifecycleMap={lifecycleMap} openChat={setChatRequest} unreadCount={unreadMap[r.id] || 0} />)}
              </div>
            </details>
          )}
        </>
      )}

      {/* Requests tab removed and moved to Requests button */}

      {!loading && tab === 'profile' && (
        <>
          <div style={{ ...row(12), marginBottom: 20, padding: '16px', background: `${T.coral}08`, borderRadius: 'var(--radius-sm)', border: `1px solid ${T.coral}20` }}>
            <Av user={user} size={52} />
            <div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 800 }}>{user?.name}</div>
              <div style={{ fontSize: 13, color: T.textMid }}>{user?.email}</div>
              <div style={{ fontSize: 12, color: T.textSoft, marginTop: 2 }}>{user?.college_name}</div>
            </div>
          </div>

          <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              ['Trust tier', <TierBadge tier={user?.trust_tier} />],
              ['Borrow limit', `${tier.limit} items`],
              ['On-time returns', user?.return_count ?? 0],
              ['Roll number', user?.roll_number],
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'rgba(15,23,42,0.03)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', border: '1px solid var(--border-soft)' }}>
                <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 4, fontWeight: 500 }}>{l}</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>

          <UpiField user={user} setUser={setUser} showToast={showToast} />

          {user?.trust_tier !== 'rep' && (() => {
            const next = { newcomer: 'regular', regular: 'trusted', trusted: 'rep' }[user.trust_tier]
            const thresholds = { newcomer: 0, regular: 3, trusted: 10, rep: 25 }
            const need = thresholds[next] - (user?.return_count || 0)
            return (
              <div style={{ fontSize: 13, color: T.textMid, borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
                {need} more on-time return{need !== 1 ? 's' : ''} to reach <TierBadge tier={next} />
              </div>
            )
          })()}
        </>
      )}

      <div style={{ ...row(8), justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn-press" style={btn(true)} onClick={onClose}>Done</button>
      </div>


    </Modal>
  )
}

function ItemCard({ item, currentUserId, onRequest, myRequests = [], onDelete, onEdit }) {
  const isYours = item.owner_id === currentUserId
  const isLF = item.listing_type === 'lost_found'
  const alreadyRequested = myRequests.some(r => r.item_id === item.id && ['pending', 'selected', 'active'].includes(r.status))
  const canAct = !isYours && !alreadyRequested && (isLF || item.status === 'available')
  const firstPhoto = item.images?.[0]

  const isLocked = myRequests.some(r => r.item_id === item.id && (
    ['active', 'overdue'].includes(r.status) ||
    (r.status === 'selected' && r.payment_confirmed)
  ))
  const canDelete = isYours && !isLocked && item.status !== 'borrowed'

  return (
    <div className="item-card" style={{ ...card, cursor: canAct ? 'pointer' : 'default', minWidth: 0, overflow: 'hidden', width: '100%' }} onClick={() => canAct && onRequest(item)}>
      {/* Image / thumbnail */}
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: firstPhoto ? '#000' : `linear-gradient(135deg, ${T.coral}10, ${T.navy}08)`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {firstPhoto
          ? <img src={firstPhoto} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
          : <span style={{ fontSize: 44, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }}>{isLF ? '🔍' : EMOJIS[item.category] || '📦'}</span>
        }
        {/* Badges */}
        {isYours && (
          <span style={{ background: `${T.coral}22`, color: T.coral, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, position: 'absolute', top: 10, right: 10, backdropFilter: 'blur(4px)' }}>Yours</span>
        )}
        {canDelete && (
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, zIndex: 10 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit && onEdit(item) }}
              style={{ background: 'rgba(255,255,255,0.95)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <span style={{ fontSize: 14 }}>✏️</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (window.confirm('Remove this item from the marketplace?')) onDelete && onDelete(item.id) }}
              style={{ background: 'rgba(255,255,255,0.95)', color: '#c0392b', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <span style={{ fontSize: 14 }}>🗑️</span>
            </button>
          </div>
        )}
        {!isYours && isLF && <span style={{ background: '#EDE9FE', color: '#5B21B6', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, position: 'absolute', top: 10, right: 10 }}>Lost & Found</span>}
        {!isYours && !isLF && <SBadge status={item.status} />}
        {item.is_paid && !isLF && (
          <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(15,23,42,0.85)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
            ₹{item.price_per_day}{item.transaction_type === 'sell' ? '' : '/day'}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 700, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</div>
        <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.category}{!isLF ? ` · max ${item.max_borrow_days}d` : ''}</div>
        <div style={{ ...row(0), justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.textMid, minWidth: 0, overflow: 'hidden' }}>
            <Av user={{ avatar: item.owner_avatar, color: item.owner_color, name: item.owner_name }} size={18} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.owner_name?.split(' ')[0]}</span>
          </div>
          {isYours
            ? <span style={{ fontSize: 11, color: T.textSoft }}>listed</span>
            : !canAct
              ? <span style={{ fontSize: 11, color: T.textSoft }}>Unavailable</span>
              : <span style={{ ...btn(true, true), display: 'inline-block', pointerEvents: 'none', fontSize: 12, padding: '5px 12px' }}>{isLF ? 'Claim' : 'Request'}</span>
          }
        </div>
      </div>
    </div>
  )
}

function UserGuideModal({ open, onClose }) {
  if (!open) return null;
  const [step, setStep] = useState(1);
  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ margin: '-8px -24px 20px', padding: '20px 24px 16px', background: `linear-gradient(135deg, ${T.info} 0%, #1E3A8A 100%)`, borderRadius: '16px 16px 0 0' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 4 }}>How CampusShare Works 📖</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Your quick guide to borrowing and lending</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[1, 2, 3].map(s => (
          <button key={s} onClick={() => setStep(s)} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', border: `1.5px solid ${step === s ? T.info : 'var(--border-soft)'}`, background: step === s ? `${T.info}15` : 'transparent', color: step === s ? T.info : T.textMid, fontWeight: 600, fontSize: 13, transition: 'all 0.2s', cursor: 'pointer' }}>
            {s === 1 ? 'Borrowing' : s === 2 ? 'Lending' : 'Requests'}
          </button>
        ))}
      </div>
      {step === 1 && (
        <div style={{ fontSize: 14, lineHeight: 1.6, color: T.textMid, minHeight: 250 }}>
          <h3 style={{ color: T.navy, marginBottom: 8 }}>Borrowing an Item</h3>
          <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, margin: 0 }}>
            <li><strong>Find an item</strong> on the Marketplace and tap "Request".</li>
            <li><strong>Wait for approval.</strong> The lender will review your request. You can check the status in the <b>Activity</b> tab.</li>
            <li><strong>Pay (if applicable).</strong> For paid items, pay via Razorpay to confirm the rental.</li>
            <li><strong>Arrange Pickup.</strong> The lender will send pickup details. Go meet them!</li>
            <li><strong>Confirm Receipt.</strong> Once they hand it to you, tap "I Got It ✓" in the Activity tab.</li>
            <li><strong>Return.</strong> When done, return the item and the lender will mark it returned.</li>
          </ol>
        </div>
      )}
      {step === 2 && (
        <div style={{ fontSize: 14, lineHeight: 1.6, color: T.textMid, minHeight: 250 }}>
          <h3 style={{ color: T.navy, marginBottom: 8 }}>Lending an Item</h3>
          <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, margin: 0 }}>
            <li><strong>List it.</strong> Tap "+ List Item" and add details.</li>
            <li><strong>Review Requests.</strong> When someone requests it, you'll see it in the <b>Activity</b> tab. Tap "Approve" if you agree.</li>
            <li><strong>Send Pickup Details.</strong> Tell the borrower where and when to meet.</li>
            <li><strong>Hand It Over.</strong> Meet the borrower, give the item, and tap "Item Given ✓".</li>
            <li><strong>Get Paid.</strong> For paid items, admin will transfer your earnings via UPI.</li>
            <li><strong>Confirm Return.</strong> When they return it, tap "Confirm Return" to free up their slot.</li>
          </ol>
        </div>
      )}
      {step === 3 && (
        <div style={{ fontSize: 14, lineHeight: 1.6, color: T.textMid, minHeight: 250 }}>
          <h3 style={{ color: T.navy, marginBottom: 8 }}>Using Requests</h3>
          <p style={{ marginBottom: 10 }}>Can't find what you need? Post a Request!</p>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, margin: 0 }}>
            <li><strong>Post a Need:</strong> Tap "🙋 Request" and tell classmates what you're looking for.</li>
            <li><strong>Receive Offers:</strong> Others can offer to lend, rent, sell, or donate the item to you.</li>
            <li><strong>Accept an Offer:</strong> Review offers in the Requests tab. When you accept one, the entire handover (and payment) happens right there in the Requests tab!</li>
          </ul>
        </div>
      )}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-press" style={btn(true)} onClick={onClose}>Got it</button>
      </div>
    </Modal>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
function ChatModal({ request, open, onClose, onMarkRead }) {
  const { user } = useApp()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const msgsEndRef = useRef(null)

  const loadMessages = useCallback(async () => {
    if (!request?.id) return
    const res = await api.getChatMessages(request.id)
    if (!res.error && res.messages) {
      setMessages(res.messages)
      if (res.messages.some(m => !m.is_read && m.sender_id !== user.id)) {
        await api.markChatRead(request.id)
        if (onMarkRead) onMarkRead(request.id)
      }
    }
  }, [request?.id, user.id, onMarkRead])

  useEffect(() => {
    if (open && request) {
      loadMessages()
      const interval = setInterval(loadMessages, 5000)
      return () => clearInterval(interval)
    }
  }, [open, request, loadMessages])

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMsg(e) {
    e.preventDefault()
    if (!input.trim() || loading) return
    setErr('')
    setLoading(true)
    const text = input.trim()
    setInput('')
    const res = await api.sendChatMessage(request.id, text)
    setLoading(false)
    if (res.error) {
      setErr(res.error)
      setInput(text)
    } else if (res.message) {
      setMessages(m => [...m, res.message])
    }
  }

  if (!open || !request) return null
  const otherName = user?.id === request.borrower_id ? request.owner_name : request.borrower_name
  
  return (
    <Modal open={open} onClose={onClose}>
      <ModalTitle>💬 Chat with {otherName?.split(' ')[0]}</ModalTitle>
      <ModalSub>Regarding: {request._item_title || request.item_title}</ModalSub>
      {err && <div style={ERR}>{err}</div>}
      
      <div style={{ background: '#F8FAFC', borderRadius: 'var(--radius-sm)', padding: 12, height: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border-soft)' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.textSoft, margin: 'auto' }}>No messages yet.<br/>Say hello!</div>
        ) : (
          messages.map(m => {
            const isMe = m.sender_id === user.id
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                <Av user={{ avatar: m.sender_avatar, color: m.sender_color, name: m.sender_name }} size={24} />
                <div style={{ maxWidth: '75%', background: isMe ? T.coral : '#fff', color: isMe ? '#fff' : T.navy, padding: '8px 12px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: isMe ? 'none' : '1px solid var(--border-soft)', wordBreak: 'break-word', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <span>{m.content}</span>
                  {isMe && (
                    <span style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
                      {m.is_read ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={msgsEndRef} />
      </div>

      <form onSubmit={sendMsg} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input style={{ ...INP, flex: 1, borderRadius: 20 }} placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)} disabled={loading} />
        <button type="submit" disabled={!input.trim() || loading} style={{ background: input.trim() ? T.coral : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 20, padding: '0 18px', fontWeight: 600, cursor: input.trim() ? 'pointer' : 'default', transition: 'background 0.2s' }}>
          Send
        </button>
      </form>
    </Modal>
  )
}

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [user, setUser] = useState(() => api.getSavedUser())
  const [tab, setTab] = useState('marketplace')
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({})
  const [cat, setCat] = useState('all')
  const [avail, setAvail] = useState('all')
  const [search, setSearch] = useState('')
  const [listOpen, setList] = useState(false)
  const [editItemData, setEditItemData] = useState(null)
  const [requestOpen, setRequest] = useState(false)
  const [editRequestData, setEditRequestData] = useState(null)
  const [lifecycleOpenMap, setLifecycleOpenMap] = useState({})
  const [newRequestCount, setNewRequestCount] = useState(0)
  const [myOffersCount, setMyOffersCount] = useState(0)
  const [unreadMap, setUnreadMap] = useState({})
  const [totalUnread, setTotalUnread] = useState(0)
  const prevUnreadIdsRef = useRef(new Set())
  const notifPollRef = useRef(null)
  const prevMyTotalOffersRef = useRef(0)
  // Always initialize to "now" so requests created before app load never fire a toast.
  // We persist to localStorage only when we actually *see* new ones, so the badge
  // survives cross-tab refreshes without triggering spurious notifications.
  const lastSeenRequestRef = useRef(new Date().toISOString())
  const [actOpen, setAct] = useState(false)
  const [actTab, setActTab] = useState(null)
  const [targetReqId, setTargetReqId] = useState(null)
  const [borrowItem, setBorrow] = useState(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const [toast, showToast] = useToast()
  const [myRequests, setMyRequests] = useState([])
  const [chatRequest, setChatRequest] = useState(null)
  const refresh = useCallback(() => setTick(t => t + 1), [])
  const openJourney = useCallback((id) => setLifecycleOpenMap(m => ({ ...m, [id]: true })), [])
  const closeJourney = useCallback((id) => setLifecycleOpenMap(m => ({ ...m, [id]: false })), [])
  const handleMarkRead = useCallback((reqId) => {
    setUnreadMap(prev => {
      const next = { ...prev }
      const count = next[reqId] || 0
      delete next[reqId]
      setTotalUnread(tot => Math.max(0, tot - count))
      return next
    })
  }, [])
  const fetchIdRef = useRef(0)
  const statsKey = `cs_stats_${user?.id}`
  const { showInstall, installApp } = usePwaInstall();

  useEffect(() => {
    if (!user) return
    api.getMe().then(r => {
      if (r?.user) { setUser(r.user); api.persistUser(r.user) }
    })

    const requestNotif = () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
      document.removeEventListener('click', requestNotif)
    }
    document.addEventListener('click', requestNotif)

    // Load cached stats immediately on mount
    try {
      const cachedStats = localStorage.getItem(statsKey)
      if (cachedStats) setStats(JSON.parse(cachedStats))
      const cachedReqs = localStorage.getItem(`cs_reqs_${user.id}`)
      if (cachedReqs) setMyRequests(JSON.parse(cachedReqs))
    } catch (_) { }

    return () => document.removeEventListener('click', requestNotif)
  }, []) // eslint-disable-line

  // Watch for state changes in myRequests to trigger native push notifications
  const prevReqsRef = useRef(null)
  useEffect(() => {
    if (!prevReqsRef.current || myRequests.length === 0) {
      prevReqsRef.current = myRequests
      return
    }

    myRequests.forEach(nr => {
      const old = prevReqsRef.current.find(o => o.id === nr.id)
      const isBorrower = nr.borrower_id === user?.id
      const isLender = nr.owner_id === user?.id

      if (!old) {
        if (isLender && nr.status === 'pending') showToast(`📦 New request for ${nr.item_title}!`, true)
        return
      }

      if (isBorrower && nr.status === 'selected' && old.status === 'pending') showToast(`✅ Request for ${nr.item_title} approved!`, true)
      if (isBorrower && nr.status === 'declined' && old.status === 'pending') showToast(`❌ Request for ${nr.item_title} declined.`, true)
      if (isBorrower && nr.pickup_details && !old.pickup_details) showToast(`📍 Pickup details sent for ${nr.item_title}!`, true)
      if (isBorrower && nr.item_given && !old.item_given) showToast(`🤝 Lender handed over ${nr.item_title}. Confirm receipt!`, true)

      if (isLender && nr.borrower_received && !old.borrower_received) showToast(`📦 Borrower received ${nr.item_title}.`, true)
      if (isLender && nr.payment_confirmed && !old.payment_confirmed) showToast(`💳 Payment confirmed for ${nr.item_title}!`, true)
      if (isLender && nr.pickup_message && !old.pickup_message) showToast(`📍 Claimer sent pickup message for ${nr.item_title}.`, true)
      if (isLender && nr.status === 'declined' && old.status === 'pending') showToast(`❌ Request for ${nr.item_title} was revoked.`, true)
    })
    prevReqsRef.current = myRequests
  }, [myRequests, user, showToast])

  // Single effect that owns ALL data fetching — no race conditions
  useEffect(() => {
    if (!user) return

    // Give this fetch a unique ID — if tab/filter changes before
    // this resolves, the ID won't match and we discard the result
    const myId = ++fetchIdRef.current

    const cacheKey = `cs_items_${tab}_${cat}_${avail}_${user.id}`

    // Show cached items immediately (same tab only)
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) setItems(JSON.parse(cached))
    } catch (_) { }

    const itemParams = tab === 'marketplace'
      ? { listingType: 'borrow', category: cat !== 'all' ? cat : undefined, status: avail === 'available' ? 'available' : undefined, search: search || undefined }
      : { listingType: 'lost_found', search: search || undefined }

    // Fire all in parallel
    Promise.all([
      api.getItems(itemParams),
      api.getStats(),
      api.getMyRequests(),
    ]).then(([itemsRes, statsRes, reqsRes]) => {
      // CRITICAL: only apply results if this is still the latest fetch
      if (fetchIdRef.current !== myId) return

      if (!itemsRes?.error) {
        setItems(itemsRes.items || [])
        try { localStorage.setItem(cacheKey, JSON.stringify(itemsRes.items || [])) } catch (_) { }
      }
      if (!statsRes?.error) {
        setStats(statsRes)
        try { localStorage.setItem(statsKey, JSON.stringify(statsRes)) } catch (_) { }
      }
      if (!reqsRes?.error) {
        setMyRequests(reqsRes.requests || [])
        try { localStorage.setItem(`cs_reqs_${user.id}`, JSON.stringify(reqsRes.requests || [])) } catch (_) { }
      }
    })
  }, [user, tab, cat, avail, search, tick]) // eslint-disable-line

  // Notification polling — check for new item requests every 20s
  // Also fires immediately so badge appears without waiting for first interval
  useEffect(() => {
    if (!user) return

    async function checkNewRequests() {
      try {
        const r = await api.getItemRequests('')
        if (r?.error || !r?.requests) return
        const lastSeen = lastSeenRequestRef.current
        // Compare ISO strings — both come from DB timestamptz so this is safe
        const newOnes = r.requests.filter(req =>
          req.requester_id !== user.id &&
          new Date(req.created_at).getTime() > new Date(lastSeen).getTime()
        )
        if (newOnes.length > 0) {
          setNewRequestCount(n => n + newOnes.length)
          // Update lastSeen to the newest request so we don't double-count
          const newest = newOnes.reduce((a, b) => a.created_at > b.created_at ? a : b)
          lastSeenRequestRef.current = newest.created_at
          localStorage.setItem('cs_last_seen_req', newest.created_at)
          showToast(`🙋 ${newOnes[0].requester_name} needs: ${newOnes[0].title}`, true)
        }

        // Check for new offers on my requests
        const myTotalOffers = r.requests
          .filter(req => req.requester_id === user.id)
          .reduce((sum, req) => sum + parseInt(req.offer_count || 0), 0)

        if (myTotalOffers > prevMyTotalOffersRef.current) {
          showToast(`🎉 You received a new offer for your item request!`, true)
        }
        prevMyTotalOffersRef.current = myTotalOffers
        setMyOffersCount(myTotalOffers)

        // Check for unread chats
        const chatRes = await api.getUnreadChats()
        if (!chatRes.error && chatRes.unread) {
          const map = {}
          let total = 0
          const currentIds = new Set()
          let newMsgs = []
          
          chatRes.unread.forEach(m => {
            currentIds.add(m.id)
            if (!prevUnreadIdsRef.current.has(m.id)) newMsgs.push(m)
            map[m.request_id] = (map[m.request_id] || 0) + 1
            total++
          })
          
          setUnreadMap(map)
          setTotalUnread(total)
          
          if (newMsgs.length > 0) {
            const latest = newMsgs[newMsgs.length - 1]
            showToast(`💬 ${latest.sender_name}: ${latest.content}`, true)
          }
          prevUnreadIdsRef.current = currentIds
        }

      } catch (e) { }
    }

    // Fire once immediately, then every 20s
    checkNewRequests()
    notifPollRef.current = setInterval(checkNewRequests, 20000)

    const handleVis = () => { if (document.visibilityState === 'visible') checkNewRequests() }
    document.addEventListener('visibilitychange', handleVis)

    return () => {
      clearInterval(notifPollRef.current)
      document.removeEventListener('visibilitychange', handleVis)
    }
  }, [user]) // eslint-disable-line

  function markRequestsSeen() {
    const now = new Date().toISOString()
    lastSeenRequestRef.current = now
    localStorage.setItem('cs_last_seen_req', now)
    setNewRequestCount(0)
  }

  async function handleDeleteItem(itemId) {
    const res = await api.deleteItem(itemId)
    if (res.error) showToast(res.error)
    else {
      showToast('Item removed from marketplace.')
      setTick(t => t + 1)
      setItems(items.filter(i => i.id !== itemId))
    }
  }

  // Separate polling effect — fires silently, also uses fetchId
  useEffect(() => {
    if (!user) return

    function doPoll() {
      const myId = ++fetchIdRef.current
      const cacheKey = `cs_items_${tab}_${cat}_${avail}_${user.id}`
      const itemParams = tab === 'marketplace'
        ? { listingType: 'borrow', category: cat !== 'all' ? cat : undefined, status: avail === 'available' ? 'available' : undefined, search: search || undefined }
        : { listingType: 'lost_found', search: search || undefined }

      Promise.all([
        api.getItems(itemParams),
        api.getStats(),
        api.getMyRequests(),
      ]).then(([itemsRes, statsRes, reqsRes]) => {
        if (fetchIdRef.current !== myId) return
        if (!itemsRes?.error) {
          setItems(itemsRes.items || [])
          try { localStorage.setItem(cacheKey, JSON.stringify(itemsRes.items || [])) } catch (_) { }
        }
        if (!statsRes?.error) setStats(statsRes)
        if (!reqsRes?.error) {
          setMyRequests(reqsRes.requests || [])
          try { localStorage.setItem(`cs_reqs_${user.id}`, JSON.stringify(reqsRes.requests || [])) } catch (_) { }
        }
      })
    }

    const interval = setInterval(doPoll, 15000)

    const handleVis = () => { if (document.visibilityState === 'visible') doPoll() }
    document.addEventListener('visibilitychange', handleVis)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVis)
    }
  }, [user, tab, cat, avail, search]) // eslint-disable-line

  function handleLogout() { api.clearSession(); setUser(null) }

  if (!user) return <AuthScreen onLogin={u => setUser(u)} />
  if (isAdmin) return <Admin goBack={() => setIsAdmin(false)} />

  const CAT_COUNTS = CATEGORIES.reduce((a, c) => { a[c] = items.filter(i => i.category === c).length; return a }, {})
  const tier = TRUST_TIERS[user.trust_tier] || TRUST_TIERS.newcomer
  const activeCount = myRequests.filter(r => ['active', 'selected'].includes(r.status)).length
  const actionableReq = myRequests.find(r => getActionRequired(r, r.borrower_id === user?.id))
  // Split unread chats by transaction origin so each button gets the right count
  const requestHandoverIds = new Set(myRequests.filter(r => r.from_item_request).map(r => r.id))
  const requestUnread = Object.entries(unreadMap).filter(([id]) => requestHandoverIds.has(Number(id))).reduce((s, [, c]) => s + c, 0)
  const activityUnread = totalUnread - requestUnread

  const requestActionCount = newRequestCount + myOffersCount
    + myRequests.filter(r => r.from_item_request && getActionRequired(r, r.borrower_id === user?.id)).length
    + requestUnread
  const activityActionCount = myRequests.filter(r => !r.from_item_request && getActionRequired(r, r.borrower_id === user?.id)).length + activityUnread
  const totalActionCount = requestActionCount + activityActionCount

  return (
    <Ctx.Provider value={{ user, setUser }}>
      <style>{FONTS}</style>

      <div style={{ fontFamily: 'var(--font-body)', color: T.navy, minHeight: '100vh', background: T.cream, position: 'relative', overflowX: 'hidden', maxWidth: '100vw' }}>

        {/* MODALS */}
        {requestOpen && (
          <RequestsModal 
            open={requestOpen} 
            onClose={() => { setRequest(false); setEditRequestData(null); }} 
            onSuccess={refresh} 
            showToast={showToast}
            targetId={targetReqId}
            onClearTarget={() => setTargetReqId(null)}
            editData={editRequestData}
            markRequestsSeen={markRequestsSeen}
            reloadActivity={refresh}
            activeHandovers={myRequests.filter(r => r.from_item_request && !['returned', 'declined', 'closed'].includes(r.status))}
            historyHandovers={myRequests.filter(r => r.from_item_request && ['returned', 'declined', 'closed'].includes(r.status))}
            unreadMap={unreadMap}
            openJourney={openJourney}
            closeJourney={closeJourney}
            lifecycleMap={lifecycleOpenMap}
            setChatRequest={setChatRequest}
          />
        )}
        {listOpen && <ListItemModal open={listOpen} onClose={() => { setList(false); setEditItemData(null); }} onSuccess={refresh} editItemData={editItemData} />}
        {borrowItem && <BorrowModal open={!!borrowItem} item={borrowItem} onClose={() => setBorrow(null)} onSuccess={refresh} showToast={showToast} />}
        {actOpen && (
          <ActivityModal 
            open={actOpen} 
            onClose={() => setAct(false)} 
            refresh={refresh} 
            showToast={showToast} 
            defaultTab={actTab}
            targetId={targetReqId}
            onClearTarget={() => setTargetReqId(null)}
            newRequestCount={newRequestCount} 
            myOffersCount={myOffersCount} 
            markRequestsSeen={markRequestsSeen} 
            unreadMap={unreadMap} 
            onMarkRead={handleMarkRead}
            lifecycleMap={lifecycleOpenMap}
            openJourney={openJourney}
            closeJourney={closeJourney}
            setChatRequest={setChatRequest}
          />
        )}
        <ChatModal open={!!chatRequest} request={chatRequest} onClose={() => setChatRequest(null)} onMarkRead={handleMarkRead} />
        {guideOpen && <UserGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />}

        {/* DESKTOP HEADER */}
        <header className="desktop-only" style={{ ...row(0), justifyContent: 'space-between', padding: '0 24px', height: 60, background: 'rgba(255,248,240,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid var(--border-soft)`, position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={row(12)}>
            <Logo />
            <button className="btn-press" style={{ ...btn(false), fontSize: 12 }} onClick={() => setIsAdmin(true)}>👤 Admin</button>
          </div>
          <div style={row(8)}>
            <div style={{ ...row(6), fontSize: 13, color: T.textMid }}>
              <Av user={user} size={28} />
              <span style={{ fontWeight: 500 }}>{user.name?.split(' ')[0]}</span>
              <span style={{ color: T.textSoft, fontSize: 12 }}>· {user.college_name}</span>
            </div>
            <button className="btn-press" style={btn(false)} onClick={() => setGuideOpen(true)}>📖 Guide</button>
            <button className="btn-press" style={btn(false)} onClick={() => setAct(true)}>
              Activity {activityActionCount > 0 && <span style={{ background: T.coral, color: '#fff', padding: '2px 6px', borderRadius: 20, fontSize: 10, marginLeft: 4, fontWeight: 700 }}>{activityActionCount}</span>}
            </button>
            <button className="btn-press" style={{ ...btn(false), background: '#7C3AED22', color: '#7C3AED', border: '1px solid #7C3AED44', position: 'relative' }} onClick={() => setRequest(true)}>
              🙋 Request
              {requestActionCount > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: T.coral, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{requestActionCount > 9 ? '9+' : requestActionCount}</span>}
            </button>
            <button className="btn-press" style={btn(true)} onClick={() => setList(true)}>+ List Item</button>
            <button className="btn-press" style={{ ...btn(false), fontSize: 12 }} onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        {/* MOBILE HEADER */}
        <header className="mobile-only" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', height: 50, background: 'rgba(255,248,240,0.97)', backdropFilter: 'blur(12px)', borderBottom: `1px solid var(--border-soft)`, position: 'sticky', top: 0, zIndex: 100, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
            <Logo />
            <button className="btn-press" onClick={() => setIsAdmin(true)} style={{ background: 'rgba(15,23,42,0.07)', border: 'none', borderRadius: 7, padding: '4px 8px', fontSize: 11, fontWeight: 600, color: T.textMid, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>👤 Admin</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, paddingLeft: 8 }}>
            <button className="btn-press" onClick={() => setGuideOpen(true)} style={{ background: 'rgba(15,23,42,0.07)', border: 'none', borderRadius: 7, padding: '4px 8px', fontSize: 11, fontWeight: 600, color: T.textMid, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>📖 Guide</button>
            <button className="btn-press" onClick={handleLogout} style={{ background: 'rgba(15,23,42,0.07)', border: 'none', borderRadius: 7, padding: '4px 8px', fontSize: 11, fontWeight: 600, color: T.textMid, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>↪ Out</button>
          </div>
        </header>

        {/* HERO — compact navy+coral split bar */}
        <div style={{ background: `linear-gradient(135deg, ${T.navy} 0%, #1E293B 60%, #0F172A 100%)`, borderBottom: `1px solid rgba(232,68,90,0.2)`, overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
          {/* Top row: tagline + stats chips */}
          <div className="hero-pad" style={{ padding: '16px 24px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, width: '100%', boxSizing: 'border-box' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 'clamp(20px,5vw,28px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                Share more, <span style={{ color: T.coral }}>spend less.</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                {user.college_name} · peer lending
              </div>
              {showInstall && (
                <button onClick={installApp} className="mobile-only" style={{ marginTop: 12, background: 'rgba(232, 68, 90, 0.2)', border: '1px solid rgba(232, 68, 90, 0.5)', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(4px)' }}>
                  <span>📲</span> Install App
                </button>
              )}
            </div>
            {/* Live stats chips */}
            <div className="stats-chips" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', maxWidth: '100%' }}>
              {/* Live */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'rgba(16,185,129,0.15)', borderRadius: 20, border: '1px solid rgba(16,185,129,0.3)', flexShrink: 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>Live</span>
              </div>
              {[[stats.available, '📦', 'avail'], [stats.students, '🎓', 'users']].map(([n, ic, l]) => (
                <div key={l} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 12 }}>{ic}</span>
                  <span style={{ fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    {n !== undefined && n !== null ? n : <span style={{ opacity: 0.4 }}>·</span>}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{l}</span>
                </div>
              ))}
              <div style={{ background: `${T.coral}22`, borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, border: `1px solid ${T.coral}44` }}>
                <span style={{ fontSize: 11, color: T.coral, fontWeight: 700 }}>{Math.max(0, tier.limit - activeCount)}/{tier.limit}</span>
                <TierBadge tier={user.trust_tier} />
              </div>
            </div>
          </div>

          {/* Bottom row: tab pills + search — stacks on mobile */}
          <div className="hero-bottom" style={{ padding: '0 24px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
            <div className="hero-tabs" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {[['marketplace', '📦 Market'], ['lostfound', '🔍 L&F']].map(([id, label]) => (
                <button key={id} className="btn-press" onClick={() => {
                  if (id !== tab) { fetchIdRef.current++; setItems([]); setSearch(''); setCat('all') }
                  setTab(id)
                }} style={{
                  padding: '7px 14px', borderRadius: 40, border: `1.5px solid ${tab === id ? T.coral : 'rgba(255,255,255,0.15)'}`,
                  background: tab === id ? T.coral : 'rgba(255,255,255,0.06)', color: tab === id ? '#fff' : 'rgba(255,255,255,0.65)',
                  fontWeight: 600, cursor: 'pointer', fontSize: 12, transition: 'all 0.18s',
                  boxShadow: tab === id ? 'var(--shadow-coral)' : 'none', whiteSpace: 'nowrap',
                }}>{label}</button>
              ))}
            </div>
            <div className="search-bar" style={{ position: 'relative', flex: 1, minWidth: 140 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, pointerEvents: 'none' }}>🔎</span>
              <input className="dark-search" style={{ ...INP, paddingLeft: 36, borderRadius: 40, background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, width: '100%' }}
                placeholder="Search…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ACTION BANNER */}
        {actionableReq && (() => {
          const isMyReq = actionableReq.borrower_id === user?.id
          const guide = getGuide(actionableReq, isMyReq)
          return (
            <div onClick={() => {
              setTargetReqId(`req-${actionableReq.id}`)
              if (actionableReq.from_item_request) {
                setRequest(true)
              } else {
                setActTab(isMyReq ? 'borrowing' : 'lending')
                setAct(true)
              }
            }} style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'} onMouseOut={e => e.currentTarget.style.background = '#F8FAFC'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{guide?.icon || '👉'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Action required on "{actionableReq.item_title || actionableReq.title}"</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{guide?.title ? guide.title : `Tap here to view your ${actionableReq.from_item_request ? 'Requests' : 'Activity'} tab and complete the next step.`}</div>
                </div>
              </div>
              <button className="btn-press" style={{ background: T.coral, color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(232,68,90,0.25)' }}>{actionableReq.from_item_request ? 'View Requests' : 'View Activity'}</button>
            </div>
          )
        })()}

        {/* BODY — desktop: sidebar + grid, mobile: grid only full width */}
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 200px)' }}>

          {/* SIDEBAR — desktop only, never rendered on mobile */}
          {tab === 'marketplace' && (
            <div className="desktop-only" style={{ width: 200, flexShrink: 0, borderRight: `1px solid var(--border-soft)`, background: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: `linear-gradient(180deg, ${T.navy} 0%, #1E293B 100%)`, padding: '20px 14px 14px' }}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Browse</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Filter by category</div>
              </div>
              <div style={{ padding: '14px 14px 0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: T.textSoft, textTransform: 'uppercase', marginBottom: 10 }}>Category</div>
                {[['all', 'All items', items.length], ...CATEGORIES.map(c => [c, c, CAT_COUNTS[c]])].map(([val, label, count]) => (
                  <button key={val} onClick={() => setCat(val)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--radius-xs)', fontSize: 13, cursor: 'pointer', color: cat === val ? T.coral : T.text, fontWeight: cat === val ? 600 : 400, background: cat === val ? `${T.coral}10` : 'transparent', border: 'none', width: '100%', textAlign: 'left', marginBottom: 2, transition: 'all 0.15s' }}>
                    <span>{label}</span>
                    <span style={{ fontSize: 11, background: cat === val ? `${T.coral}20` : 'rgba(15,23,42,0.06)', color: cat === val ? T.coral : T.textSoft, padding: '2px 7px', borderRadius: 20 }}>{count}</span>
                  </button>
                ))}
                <Divider />
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: T.textSoft, textTransform: 'uppercase', marginBottom: 10 }}>Availability</div>
                {[['all', 'Show all'], ['available', 'Available now']].map(([val, label]) => (
                  <button key={val} onClick={() => setAvail(val)} style={{ display: 'flex', padding: '8px 10px', borderRadius: 'var(--radius-xs)', fontSize: 13, cursor: 'pointer', color: avail === val ? T.coral : T.text, fontWeight: avail === val ? 600 : 400, background: avail === val ? `${T.coral}10` : 'transparent', border: 'none', width: '100%', textAlign: 'left', marginBottom: 2, transition: 'all 0.15s' }}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* GRID — takes full width on mobile since sidebar is hidden */}
          <div className="main-content" style={{ flex: 1, minWidth: 0, padding: '20px 20px', overflowX: 'hidden', boxSizing: 'border-box' }}>
            <div style={{ ...row(0), justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 14, color: T.textMid, fontWeight: 500 }}>
                {tab === 'lostfound' ? `${items.length} found item${items.length !== 1 ? 's' : ''}` : `${items.length} item${items.length !== 1 ? 's' : ''}`}
              </span>
              <span style={{ fontSize: 12, color: T.textSoft }}>Most recent first</span>
            </div>

            {tab === 'lostfound' && items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 16, color: T.textMid, marginBottom: 6, fontWeight: 600 }}>No lost & found items yet.</div>
                <div style={{ fontSize: 14, color: T.textSoft, marginBottom: 20 }}>Found something? Let others know.</div>
                <button className="btn-press" style={btn(true)} onClick={() => setList(true)}>Report a found item</button>
              </div>
            )}

            {items.length === 0 && tab === 'marketplace' && (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: T.textSoft, fontSize: 14 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                No items match your filter.
              </div>
            )}

            <div className="item-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(160px,45vw),1fr))', gap: 12 }}>
              {items.filter(item => item.status !== 'closed').map(item => (
                <ItemCard key={item.id + '-' + tick} item={item} currentUserId={user.id} onRequest={i => setBorrow(i)} myRequests={myRequests} onDelete={handleDeleteItem} onEdit={i => { setEditItemData(i); setList(true); }} />
              ))}
            </div>
          </div>
        </div>

        {/* MOBILE BOTTOM NAV */}
        <nav className="mobile-only" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 68, background: 'rgba(255,248,240,0.96)', backdropFilter: 'blur(16px)', borderTop: `1px solid var(--border-soft)`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px 8px', zIndex: 150 }}>
          {[
            { icon: '📦', label: 'Market', action: () => { if (tab !== 'marketplace') { fetchIdRef.current++; setItems([]) } setTab('marketplace') }, active: tab === 'marketplace' },
            { icon: '🔍', label: 'L&F', action: () => { if (tab !== 'lostfound') { fetchIdRef.current++; setItems([]) } setTab('lostfound') }, active: tab === 'lostfound' },
            { icon: '➕', label: 'List', action: () => setList(true), active: false, primary: true },
            { icon: '🙋', label: 'Requests', action: () => { setRequest(true); markRequestsSeen(); }, active: false, badge: requestActionCount },
            { icon: '📋', label: 'Activity', action: () => setAct(true), active: false, badge: activityActionCount }
          ].map(({ icon, label, action, active, primary, badge }) => (
            <button key={label} onClick={action} className="btn-press" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: primary ? T.coral : 'transparent', color: primary ? '#fff' : active ? T.coral : T.textSoft, border: 'none', cursor: 'pointer', padding: primary ? '10px 16px' : '6px 12px', borderRadius: primary ? 40 : 'var(--radius-xs)', fontWeight: 600, transition: 'all 0.18s', boxShadow: primary ? 'var(--shadow-coral)' : 'none' }}>
              {badge > 0 && <span style={{ position: 'absolute', top: 0, right: 4, background: T.coral, color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 20, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{badge > 9 ? '9+' : badge}</span>}
              <span style={{ fontSize: primary ? 22 : 18 }}>{icon}</span>
              <span style={{ fontSize: 10 }}>{label}</span>
            </button>
          ))}
        </nav>

        <Toast msg={toast} />
      </div>
    </Ctx.Provider>
  )
}
