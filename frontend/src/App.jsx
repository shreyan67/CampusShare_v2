import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import * as api from './api.js'
import Admin from "./pages/Admin"

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const T = {
  navy:    '#0F172A',
  coral:   '#E8445A',
  cream:   '#FFF8F0',
  coralDim:'#E8445A22',
  coralMid:'#E8445A44',
  glass:   'rgba(255,248,240,0.72)',
  glassDk: 'rgba(15,23,42,0.82)',
  border:  'rgba(232,68,90,0.18)',
  borderSoft: 'rgba(15,23,42,0.08)',
  text:    '#0F172A',
  textMid: '#475569',
  textSoft:'#94A3B8',
  success: '#10B981',
  successBg:'#D1FAE5',
  warn:    '#F59E0B',
  warnBg:  '#FEF3C7',
  error:   '#EF4444',
  errorBg: '#FEE2E2',
  info:    '#3B82F6',
  infoBg:  '#DBEAFE',
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
.btn-press:active { transform: scale(0.96); }

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
  newcomer: { label:'Newcomer',   color:'#64748B', bg:'#F1F5F9', limit:1 },
  regular:  { label:'Regular',    color:'#3B82F6', bg:'#DBEAFE', limit:3 },
  trusted:  { label:'Trusted',    color:'#10B981', bg:'#D1FAE5', limit:5 },
  rep:      { label:'Campus Rep', color:'#8B5CF6', bg:'#EDE9FE', limit:8 },
}
const CATEGORIES = ['Books','Lab Equipment','Electronics','Notes & Guides','Accessories','Other']
const EMOJIS = { 'Books':'📗','Lab Equipment':'🔬','Electronics':'🔌','Notes & Guides':'📝','Accessories':'🎒','Other':'📦','lost_found':'🔍' }
const STATUS_MAP = {
  available: { bg:'#D1FAE5', color:'#065F46', label:'Available' },
  borrowed:  { bg:'#FEF3C7', color:'#92400E', label:'Borrowed'  },
  pending:   { bg:'#FEF3C7', color:'#92400E', label:'Pending'   },
  selected:  { bg:'#DBEAFE', color:'#1E40AF', label:'Selected'  },
  active:    { bg:'#DBEAFE', color:'#1E40AF', label:'Active'    },
  returned:  { bg:'#D1FAE5', color:'#065F46', label:'Returned'  },
  declined:  { bg:'#FEE2E2', color:'#991B1B', label:'Declined'  },
  overdue:   { bg:'#FEE2E2', color:'#991B1B', label:'Overdue'   },
  completed: { bg:'#D1FAE5', color:'#065F46', label:'Claimed'   },
}

// ── STYLE HELPERS ─────────────────────────────────────────────────────────────
const btn = (primary=false, sm=false) => ({
  fontFamily:'var(--font-body)', fontWeight:600,
  fontSize: sm ? 12 : 14,
  padding: sm ? '6px 14px' : '10px 20px',
  borderRadius: 'var(--radius-xs)',
  cursor:'pointer', border:'none',
  background: primary ? 'var(--coral)' : 'rgba(15,23,42,0.06)',
  color: primary ? '#fff' : 'var(--navy)',
  transition:'all 0.18s ease',
  letterSpacing: primary ? '0.01em' : 0,
  boxShadow: primary ? 'var(--shadow-coral)' : 'none',
})

const INP = {
  width:'100%', padding:'11px 14px', fontSize:14,
  border:'1.5px solid var(--border-soft)',
  borderRadius:'var(--radius-xs)',
  background:'rgba(255,255,255,0.8)',
  color:'var(--navy)', outline:'none',
  fontFamily:'var(--font-body)',
  transition:'border-color 0.18s',
}
const LBL = { display:'block', fontSize:12, fontWeight:600, color:T.textMid, marginBottom:6, letterSpacing:'0.01em' }
const ERR = { padding:'10px 14px', background:T.errorBg, color:'#991B1B', borderRadius:'var(--radius-xs)', fontSize:13, marginBottom:12, border:`1px solid ${T.error}22` }
const OK  = { padding:'10px 14px', background:T.successBg, color:'#065F46', borderRadius:'var(--radius-xs)', fontSize:13, marginBottom:12 }
const row = (gap=8) => ({ display:'flex', alignItems:'center', gap })
const card = { background:'#fff', border:'1px solid var(--border-soft)', borderRadius:'var(--radius)', overflow:'hidden', boxShadow:'var(--shadow)' }

// ── CONTEXT ───────────────────────────────────────────────────────────────────
const Ctx = createContext(null)
const useApp = () => useContext(Ctx)

// ── TOAST ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [msg,setMsg] = useState('')
  const show = useCallback(m => { setMsg(m); setTimeout(()=>setMsg(''),3200) }, [])
  return [msg, show]
}
function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position:'fixed', bottom:84, left:'50%', transform:'translateX(-50%)', zIndex:9999, pointerEvents:'none', animation:'toastIn 0.3s cubic-bezier(0.22,1,0.36,1) both' }}>
      <div style={{ background:T.navy, color:'#fff', padding:'12px 24px', borderRadius:40, fontSize:14, fontWeight:500, maxWidth:340, textAlign:'center', boxShadow:'0 8px 32px rgba(15,23,42,0.24)', whiteSpace:'nowrap' }}>{msg}</div>
    </div>
  )
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, children, wide=false }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(8px)', zIndex:200, display:'flex', justifyContent:'center', alignItems:'flex-end', padding:'0', overflowY:'hidden' }}
      onMouseDown={e => { if(e.target===e.currentTarget) onClose() }}>
      <div className="slide-up modal-sheet" style={{ background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxWidth: wide ? 680 : 480, maxHeight:'90vh', overflowY:'auto', padding:'8px 0 0' }}>
        {/* Handle bar */}
        <div style={{ width:40, height:4, background:'rgba(15,23,42,0.12)', borderRadius:4, margin:'12px auto 20px' }} />
        <div style={{ padding:'0 24px 32px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── SMALL UI ATOMS ────────────────────────────────────────────────────────────
function TierBadge({ tier }) {
  const t = TRUST_TIERS[tier] || TRUST_TIERS.newcomer
  return <span style={{ background:t.bg, color:t.color, fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, letterSpacing:'0.01em' }}>{t.label}</span>
}
function SBadge({ status, inline=false }) {
  const s = STATUS_MAP[status] || STATUS_MAP.available
  return <span style={{ background:s.bg, color:s.color, fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, ...(inline?{}:{ position:'absolute', top:10, right:10 }) }}>{s.label}</span>
}
function Av({ user, size=26 }) {
  const init = user?.avatar || user?.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background: user?.color || 'linear-gradient(135deg,#E8445A,#0F172A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*.38), fontWeight:700, color:'#fff', flexShrink:0, letterSpacing:'-0.02em' }}>{init}</div>
  )
}
function Divider() { return <div style={{ height:1, background:'var(--border-soft)', margin:'14px 0' }} /> }
function ModalTitle({ children }) { return <div style={{ fontFamily:'var(--font-head)', fontSize:22, fontWeight:800, marginBottom:4, letterSpacing:'-0.5px', color:T.navy }}>{children}</div> }
function ModalSub({ children }) { return <div style={{ fontSize:14, color:T.textMid, marginBottom:18, lineHeight:1.5 }}>{children}</div> }

function InfoBanner({ type='info', children }) {
  const styles = {
    info:    { bg:T.infoBg,    color:T.info,    border:`1px solid ${T.info}33`    },
    success: { bg:T.successBg, color:T.success, border:`1px solid ${T.success}33` },
    warn:    { bg:T.warnBg,    color:'#92400E', border:`1px solid ${T.warn}44`    },
    error:   { bg:T.errorBg,   color:T.error,   border:`1px solid ${T.error}33`   },
  }
  const s = styles[type] || styles.info
  return (
    <div style={{ padding:'10px 14px', background:s.bg, color:s.color, borderRadius:'var(--radius-xs)', fontSize:13, marginBottom:10, border:s.border, lineHeight:1.5 }}>
      {children}
    </div>
  )
}

// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode,       setMode]      = useState('login')
  const [pending,    setPending]   = useState(null)
  const [err,        setErr]       = useState('')
  const [loading,    setLoading]   = useState(false)
  const [consoleOtp, setConsoleOtp] = useState('')
  const [fields, setFields] = useState({ name:'', email:'', roll:'', otp:'' })
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
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg, ${T.navy} 0%, #1E293B 50%, #0F172A 100%)`, display:'flex', flexDirection:'column', fontFamily:'var(--font-body)' }}>
      <style>{FONTS}</style>

      {/* Decorative blobs */}
      <div style={{ position:'fixed', top:-100, right:-100, width:400, height:400, background:`radial-gradient(circle, ${T.coral}22 0%, transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:-100, left:-100, width:300, height:300, background:`radial-gradient(circle, ${T.coral}18 0%, transparent 70%)`, pointerEvents:'none' }} />

      {/* Header */}
      <div style={{ padding:'24px 32px', ...row(0), justifyContent:'space-between' }}>
        <Logo light />
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)' }}>College-verified peer sharing</div>
      </div>

      {/* Card */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px' }}>
        <div className="pop-in" style={{ background:'rgba(255,255,255,0.97)', borderRadius:24, width:'100%', maxWidth:400, padding:'36px 32px', boxShadow:'0 32px 80px rgba(0,0,0,0.32)' }}>

          {mode==='login' && <>
            <div style={{ fontFamily:'var(--font-head)', fontSize:28, fontWeight:800, letterSpacing:'-1px', marginBottom:4 }}>Welcome back 👋</div>
            <div style={{ fontSize:14, color:T.textMid, marginBottom:24 }}>Sign in with your college email</div>
            {err && <div style={ERR}>{err}</div>}
            <div style={{ marginBottom:16 }}>
              <label style={LBL}>College email</label>
              <input style={INP} placeholder="cs2021001@mail.iitb.ac.in" value={fields.email} onChange={set('email')} onKeyDown={e=>e.key==='Enter'&&doLogin()} autoComplete="email" />
            </div>
            <button className="btn-press" style={{ ...btn(true), width:'100%', padding:'13px', fontSize:15 }} onClick={doLogin} disabled={loading}>
              {loading ? 'Sending code…' : 'Continue →'}
            </button>
            <p style={{ fontSize:13, color:T.textMid, textAlign:'center', marginTop:16 }}>
              No account? <span style={{ color:T.coral, cursor:'pointer', fontWeight:600 }} onClick={()=>switchMode('signup')}>Sign up</span>
            </p>
            <Divider />
            <p style={{ fontSize:11, color:T.textSoft, textAlign:'center' }}>Demo: <code style={{ background:'#f0f0f0', padding:'2px 6px', borderRadius:4 }}>cs2021001@mail.iitb.ac.in</code></p>
          </>}

          {mode==='signup' && <>
            <div style={{ fontFamily:'var(--font-head)', fontSize:28, fontWeight:800, letterSpacing:'-1px', marginBottom:4 }}>Join CampusShare ✦</div>
            <div style={{ fontSize:13, color:T.textMid, marginBottom:24, lineHeight:1.6 }}>
              Use your college email — each college sees only their own listings.
            </div>
            {err && <div style={ERR}>{err}</div>}
            {['Full name|name|Rahul Mehta|name', 'College email|email|cs2021001@mail.iitb.ac.in|email', 'Roll number|roll|CS2021001|off'].map(s => {
              const [label,key,ph,ac] = s.split('|')
              return (
                <div key={key} style={{ marginBottom:14 }}>
                  <label style={LBL}>{label}</label>
                  <input style={INP} placeholder={ph} value={fields[key]} onChange={set(key)} autoComplete={ac} onKeyDown={e=>e.key==='Enter'&&key==='roll'&&doSignup()} />
                </div>
              )
            })}
            <button className="btn-press" type="button" style={{ ...btn(true), width:'100%', padding:'13px', fontSize:15 }} onClick={doSignup} disabled={loading}>
              {loading ? 'Sending code…' : 'Create account →'}
            </button>
            <p style={{ fontSize:13, color:T.textMid, textAlign:'center', marginTop:16 }}>
              Have an account? <span style={{ color:T.coral, cursor:'pointer', fontWeight:600 }} onClick={()=>switchMode('login')}>Sign in</span>
            </p>
          </>}

          {mode==='otp' && <>
            <div style={{ textAlign:'center', marginBottom:8 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>📬</div>
              <div style={{ fontFamily:'var(--font-head)', fontSize:24, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>Check your inbox</div>
              <div style={{ fontSize:14, color:T.textMid, lineHeight:1.6 }}>Enter the 6-digit code sent to your college email.</div>
            </div>
            {err && <div style={{ ...ERR, marginTop:16 }}>{err}</div>}
            {consoleOtp && (
              <div style={{ ...OK, marginTop:16, textAlign:'center' }}>
                Dev mode — OTP: <strong style={{ letterSpacing:'0.15em', fontSize:18 }}>{consoleOtp}</strong>
              </div>
            )}
            <div style={{ marginTop:20, marginBottom:16 }}>
              <input
                style={{ ...INP, letterSpacing:'0.4em', fontSize:28, textAlign:'center', padding:'16px', fontFamily:'var(--font-head)', fontWeight:700 }}
                placeholder="——————" maxLength={6} value={fields.otp} onChange={set('otp')}
                onKeyDown={e=>e.key==='Enter'&&doOtp()} autoComplete="one-time-code" inputMode="numeric"
              />
              {window.__DEV_OTP__ && <p style={{ marginTop:8, color:T.textSoft, fontSize:12, textAlign:'center' }}>Dev OTP: <b>{window.__DEV_OTP__}</b></p>}
            </div>
            <button className="btn-press" style={{ ...btn(true), width:'100%', padding:'13px', fontSize:15 }} onClick={doOtp} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & enter →'}
            </button>
            <p style={{ fontSize:12, color:T.textSoft, textAlign:'center', marginTop:14, cursor:'pointer' }} onClick={()=>switchMode('login')}>← Use a different email</p>
          </>}
        </div>
      </div>
    </div>
  )
}

// ── LOGO ──────────────────────────────────────────────────────────────────────
function Logo({ light=false }) {
  return (
    <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'clamp(15px,4vw,20px)', letterSpacing:'-0.5px', color: light ? '#fff' : T.navy, display:'flex', alignItems:'center', gap:6, overflow:'hidden', minWidth:0 }}>
      <div style={{ width:26, height:26, background:T.coral, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <span style={{ fontSize:13 }}>◈</span>
      </div>
      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Campus<span style={{ color:T.coral }}>Share</span></span>
    </div>
  )
}

// ── LIST ITEM MODAL ───────────────────────────────────────────────────────────
function ListItemModal({ open, onClose, onSuccess }) {
  const { user, setUser } = useApp()
  const titleRef = useRef(''), notesRef = useRef('')
  const [category, setCat]       = useState('Books')
  const [maxDays,  setMaxDays]   = useState('7')
  const [ltype,    setLtype]     = useState('borrow')
  const [isPaid,   setPaid]      = useState(false)
  const [ppd,      setPpd]       = useState('')
  const [upiId,    setUpiId]     = useState(user?.upi_id || '')
  const [allowMulti, setAllowMulti] = useState(false)
  const [photos,   setPhotos]    = useState([])
  const [previews, setPreviews]  = useState([])
  const [err,      setErr]       = useState('')
  const [loading,  setLoading]   = useState(false)

  function onPhotoPick(e) {
    const files = Array.from(e.target.files).slice(0,4)
    setPhotos(files)
    setPreviews(files.map(f=>URL.createObjectURL(f)))
  }

  async function submit() {
    setErr(''); setLoading(true)
    if (isPaid && ltype==='borrow') {
      const trimmedUpi = upiId.trim()
      const UPI_RE = /^[a-zA-Z0-9._\-+]+@[a-zA-Z0-9]+$/
      if (!trimmedUpi) { setErr('Please enter your UPI ID to receive rental payments.'); setLoading(false); return }
      if (!UPI_RE.test(trimmedUpi)) { setErr('Invalid UPI ID format. Expected: name@bank'); setLoading(false); return }
      if (trimmedUpi !== user?.upi_id) {
        const upiRes = await api.updateUpi(trimmedUpi)
        if (upiRes?.error) { setErr(upiRes.error); setLoading(false); return }
        if (upiRes?.user) { setUser(upiRes.user); api.persistUser(upiRes.user) }
      }
    }
    const r = await api.listItem({
      title: titleRef.current, category,
      conditionNotes: notesRef.current,
      maxBorrowDays: maxDays,
      listingType: ltype,
      isPaid: isPaid ? 'true' : 'false',
      pricePerDay: isPaid ? ppd : '',
      allowMultiple: ltype==='borrow' ? String(allowMulti) : 'false',
      photos,
    })
    setLoading(false)
    if (r.error) return setErr(r.error)
    onSuccess(); onClose()
  }

  const TypeBtn = ({ val, icon, label }) => (
    <button onClick={()=>setLtype(val)} style={{ flex:1, padding:'12px', borderRadius:'var(--radius-sm)', border:`2px solid ${ltype===val?T.coral:'var(--border-soft)'}`, background:ltype===val?`${T.coral}10`:'transparent', color:ltype===val?T.coral:T.textMid, fontWeight:600, cursor:'pointer', fontSize:13, textAlign:'center', transition:'all 0.18s' }}>
      <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
      {label}
    </button>
  )

  return (
    <Modal open={open} onClose={onClose}>
      {/* Navy header strip */}
      <div style={{ margin:'-8px -24px 20px', padding:'20px 24px 16px', background:`linear-gradient(135deg, ${T.navy} 0%, #1E293B 100%)`, borderRadius:'16px 16px 0 0' }}>
        <div style={{ fontFamily:'var(--font-head)', fontSize:22, fontWeight:700, color:'#fff', letterSpacing:'-0.5px', marginBottom:4 }}>List an item ✦</div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)' }}>Share what you're not using</div>
        <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(255,255,255,0.08)', borderRadius:'var(--radius-xs)', fontSize:12, color:'rgba(255,255,255,0.7)', ...row(6) }}>
          <span>✓</span><span>{user?.name} · {user?.roll_number} · {user?.college_name}</span>
        </div>
      </div>
      {err && <div style={ERR}>{err}</div>}

      <div style={{ ...row(8), marginBottom:16 }}>
        <TypeBtn val="borrow"     icon="📦" label="Lend / Borrow" />
        <TypeBtn val="lost_found" icon="🔍" label="Lost & Found"  />
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={LBL}>Item name</label>
        <input style={INP} placeholder="e.g. Casio FX-991EX" defaultValue={titleRef.current} onChange={e=>titleRef.current=e.target.value} />
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={LBL}>Category</label>
        <select style={INP} value={category} onChange={e=>setCat(e.target.value)}>
          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={LBL}>Condition notes</label>
        <input style={INP} placeholder="e.g. Good condition, minor cover wear" onChange={e=>notesRef.current=e.target.value} />
      </div>

      {ltype==='borrow' && <>
        <div style={{ marginBottom:14 }}>
          <label style={LBL}>Max borrow duration</label>
          <select style={INP} value={maxDays} onChange={e=>setMaxDays(e.target.value)}>
            {[['1','1 day'],['3','3 days'],['7','1 week'],['14','2 weeks']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Paid toggle */}
        <div style={{ marginBottom:14, padding:'14px', background:`${T.coral}08`, borderRadius:'var(--radius-sm)', border:`1.5px solid ${isPaid?T.coral:'var(--border-soft)'}`, transition:'border-color 0.2s' }}>
          <div style={{ ...row(10), cursor:'pointer' }} onClick={()=>setPaid(p=>!p)}>
            <div style={{ width:44, height:24, borderRadius:12, background:isPaid?T.coral:'rgba(15,23,42,0.12)', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:3, left:isPaid?22:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:600 }}>Paid rental</div>
              <div style={{ fontSize:12, color:T.textMid }}>Earn per day borrowed</div>
            </div>
          </div>
          {isPaid && (
            <div style={{ marginTop:14 }}>
              <div style={{ ...row(8), marginBottom:12 }}>
                <span style={{ fontSize:20, fontWeight:700, color:T.coral }}>₹</span>
                <div style={{ flex:1 }}>
                  <input style={INP} type="number" min="1" placeholder="Amount per day" value={ppd} onChange={e=>setPpd(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize:11, color:T.textMid, marginBottom:12 }}>Borrower pays this + 3% platform fee. You keep 97%.</div>
              <label style={LBL}>Your UPI ID *</label>
              <input style={{ ...INP, borderColor: upiId ? 'var(--border-soft)' : T.coral }} placeholder="name@okicici" value={upiId} onChange={e=>setUpiId(e.target.value)} />
            </div>
          )}
        </div>

        {/* Multiple borrowers toggle */}
        <div style={{ ...row(10), padding:'12px 14px', background:'rgba(15,23,42,0.04)', borderRadius:'var(--radius-xs)', marginBottom:14, cursor:'pointer' }} onClick={()=>setAllowMulti(m=>!m)}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:500 }}>Allow multiple borrowers?</div>
            <div style={{ fontSize:12, color:T.textMid, marginTop:2 }}>{allowMulti ? 'Multiple can borrow simultaneously' : 'Only 1 borrower at a time'}</div>
          </div>
          <div style={{ width:44, height:24, borderRadius:12, background:allowMulti?T.coral:'rgba(15,23,42,0.12)', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
            <div style={{ position:'absolute', top:3, left:allowMulti?22:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
          </div>
        </div>
      </>}

      <div style={{ marginBottom:16 }}>
        <label style={LBL}>Photos (up to 4)</label>
        <input type="file" accept="image/*" multiple onChange={onPhotoPick} style={{ fontSize:13, color:T.textMid }} />
        {previews.length > 0 && (
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            {previews.map((p,i)=>(
              <img key={i} src={p} alt="" style={{ width:72, height:72, objectFit:'cover', borderRadius:'var(--radius-xs)', border:'1px solid var(--border-soft)' }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ ...row(8), justifyContent:'flex-end' }}>
        <button className="btn-press" style={btn(false)} onClick={onClose}>Cancel</button>
        <button className="btn-press" style={btn(true)} onClick={submit} disabled={loading}>{loading?'Listing…':'List Item ✦'}</button>
      </div>
    </Modal>
  )
}

// ── BORROW / CLAIM MODAL ──────────────────────────────────────────────────────
function BorrowModal({ open, item, onClose, onSuccess, showToast }) {
  const { user } = useApp()
  const msgRef = useRef('')
  const [days, setDays]   = useState('3')
  const [err,  setErr]    = useState('')
  const [loading, setLoading] = useState(false)
  const tier = TRUST_TIERS[user?.trust_tier] || TRUST_TIERS.newcomer
  const isLostFound = item?.listing_type === 'lost_found'
  const PLATFORM_FEE_PERCENT = 3
  const rentalCost  = item?.is_paid ? parseFloat((parseFloat(item.price_per_day) * parseInt(days)).toFixed(2)) : 0
  const platformFee = item?.is_paid ? parseFloat((rentalCost * PLATFORM_FEE_PERCENT / 100).toFixed(2)) : 0
  const totalCost   = item?.is_paid ? parseFloat((rentalCost + platformFee).toFixed(2)) : null

  useEffect(() => { if (open) { setErr(''); setDays('3') } }, [open])

  async function submit() {
    setErr(''); setLoading(true)
    const r = await api.requestBorrow({ itemId:item.id, requestedDays:isLostFound?1:parseInt(days), message:msgRef.current })
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
        <div style={{ marginBottom:14 }}>
          <label style={LBL}>Duration (max {item.max_borrow_days} days)</label>
          <select style={INP} value={days} onChange={e=>setDays(e.target.value)}>
            {[1,2,3,5,7,14].filter(d=>d<=item.max_borrow_days).map(d=><option key={d} value={d}>{d} day{d>1?'s':''}</option>)}
          </select>
        </div>
      )}

      {item.is_paid && !isLostFound && (
        <div style={{ marginBottom:14, padding:'14px', background:`${T.warn}15`, borderRadius:'var(--radius-sm)', border:`1px solid ${T.warn}44` }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#92400E', marginBottom:6 }}>💰 Paid rental breakdown</div>
          <div style={{ fontSize:13, color:'#92400E' }}>₹{item.price_per_day}/day × {days} days = ₹{rentalCost}</div>
          <div style={{ fontSize:12, color:'#92400E', marginTop:3 }}>Platform fee (3%): ₹{platformFee}</div>
          <div style={{ fontSize:15, color:'#92400E', fontWeight:700, marginTop:6 }}>Total: ₹{totalCost}</div>
          <div style={{ fontSize:11, color:'#92400E', marginTop:4, opacity:0.8 }}>Pay securely via UPI after approval.</div>
        </div>
      )}

      <div style={{ marginBottom:14 }}>
        <label style={LBL}>{isLostFound ? 'Why do you think this is yours?' : 'Message (optional)'}</label>
        <input style={INP} placeholder={isLostFound ? 'Describe your item to prove ownership…' : 'e.g. Need for Wednesday exam'} onChange={e=>msgRef.current=e.target.value} />
      </div>

      <div style={{ ...row(8), justifyContent:'flex-end' }}>
        <button className="btn-press" style={btn(false)} onClick={onClose}>Cancel</button>
        <button className="btn-press" style={btn(true)} onClick={submit} disabled={loading}>{loading?'Sending…':isLostFound?'Send Claim':'Send Request'}</button>
      </div>
    </Modal>
  )
}

// ── LF PICKUP PANEL ───────────────────────────────────────────────────────────
function LFPickupPanel({ r, reload, showToast }) {
  const [msg,    setMsg]    = useState(r.pickup_message || '')
  const [saving, setSaving] = useState(false)
  const [sent,   setSent]   = useState(!!r.pickup_message)

  async function send() {
    if (!msg.trim()) { showToast('Please enter a pickup message.'); return }
    setSaving(true)
    const res = await api.sendPickupMessage(r.id, msg.trim())
    setSaving(false)
    if (res?.error) { showToast(res.error); return }
    setSent(true)
    showToast('Pickup message sent!')
    await reload()
  }

  if (sent) return (
    <InfoBanner type="success">✅ Pickup message sent: <strong>"{r.pickup_message || msg}"</strong><br/><span style={{opacity:0.8}}>Waiting for lender to hand over.</span></InfoBanner>
  )

  return (
    <InfoBanner type="info">
      <div style={{ fontWeight:600, marginBottom:8 }}>📍 Send pickup message to lender</div>
      <div style={{ fontSize:12, marginBottom:8, opacity:0.8 }}>Tell them where/when you can collect the item.</div>
      <div style={{ display:'flex', gap:8 }}>
        <input style={{ ...INP, flex:1, fontSize:13, padding:'8px 12px' }} placeholder="e.g. Hostel B gate, free 4–6pm" value={msg} onChange={e=>setMsg(e.target.value)} />
        <button className="btn-press" style={{ ...btn(true,true), whiteSpace:'nowrap' }} onClick={send} disabled={saving}>{saving?'…':'Send'}</button>
      </div>
    </InfoBanner>
  )
}

// ── PICKUP DETAILS PANEL ──────────────────────────────────────────────────────
function PickupDetailsPanel({ r, reload, showToast }) {
  const [details, setDetails] = useState(r.pickup_details || '')
  const [saving,  setSaving]  = useState(false)
  const [sent,    setSent]    = useState(!!r.pickup_details)

  async function send() {
    if (!details.trim()) { showToast('Please enter pickup details.'); return }
    setSaving(true)
    const res = await api.sendPickupDetails(r.id, details.trim())
    setSaving(false)
    if (res?.error) { showToast(res.error); return }
    setSent(true)
    showToast('Pickup details sent!')
    await reload()
  }

  if (sent) return (
    <InfoBanner type="success">
      📍 You told borrower: <strong>"{r.pickup_details || details}"</strong>
      {!r.item_given && <div style={{marginTop:4, opacity:0.8}}>Once handed over, click "Item Given ✓" below.</div>}
    </InfoBanner>
  )

  return (
    <InfoBanner type="warn">
      <div style={{ fontWeight:600, marginBottom:8 }}>📍 Send pickup details to borrower</div>
      <div style={{ fontSize:12, marginBottom:8, opacity:0.8 }}>Tell them where and when to collect.</div>
      <div style={{ display:'flex', gap:8 }}>
        <input style={{ ...INP, flex:1, fontSize:13, padding:'8px 12px' }} placeholder="e.g. Hostel C room 301, 5–7pm" value={details} onChange={e=>setDetails(e.target.value)} />
        <button className="btn-press" style={{ ...btn(true,true), whiteSpace:'nowrap' }} onClick={send} disabled={saving}>{saving?'…':'Send'}</button>
      </div>
    </InfoBanner>
  )
}

// ── UPI FIELD ─────────────────────────────────────────────────────────────────
function UpiField({ user, setUser, showToast }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(user?.upi_id || '')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

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
    <div style={{ marginBottom:14, padding:'14px', background: hasUpi?T.successBg:T.warnBg, borderRadius:'var(--radius-sm)', border:`1.5px solid ${hasUpi?T.success:T.warn}33` }}>
      <div style={{ ...row(8), marginBottom:editing?12:0 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color: hasUpi?'#065F46':'#92400E' }}>
            {hasUpi ? '✅ Payout UPI ID' : '⚠️ Add UPI ID to receive payouts'}
          </div>
          {!editing && <div style={{ fontSize:12, color:T.textMid, marginTop:2 }}>{hasUpi ? user.upi_id : 'Required for rental earnings'}</div>}
        </div>
        <button className="btn-press" style={{ ...btn(false,true), whiteSpace:'nowrap' }} onClick={()=>{ setEditing(e=>!e); setVal(user?.upi_id||''); setErr('') }}>
          {editing ? 'Cancel' : hasUpi ? 'Edit' : 'Add'}
        </button>
      </div>
      {editing && (
        <>
          {err && <div style={{ ...ERR, marginBottom:8 }}>{err}</div>}
          <div style={{ ...row(8) }}>
            <input style={{ ...INP, flex:1 }} placeholder="name@okicici" value={val} onChange={e=>setVal(e.target.value)} />
            <button className="btn-press" style={btn(true,true)} onClick={save} disabled={saving}>{saving?'…':'Save'}</button>
          </div>
          <div style={{ fontSize:11, color:T.textMid, marginTop:6 }}>You keep 97% of each rental. Platform fee: 3%.</div>
        </>
      )}
    </div>
  )
}

// ── ACTIVITY MODAL ────────────────────────────────────────────────────────────
function ActivityModal({ open, onClose, refresh, showToast }) {
  const { user, setUser } = useApp()
  const [tab,     setTab]     = useState('borrowing')
  const [reqs,    setReqs]    = useState([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const pollRef = useRef(null)

  async function fetchReqs(silent=false) {
    if (!silent) setLoading(true)
    const r = await api.getMyRequests()
    if (!silent) setLoading(false)
    if (!r.error) { setReqs(r.requests||[]); setLastUpdated(new Date()) }
  }

  useEffect(() => {
    if (!open) {
      clearInterval(pollRef.current)
      return
    }
    fetchReqs(false)
    // Poll every 8 seconds while activity modal is open
    pollRef.current = setInterval(() => fetchReqs(true), 8000)
    return () => clearInterval(pollRef.current)
  }, [open])

  async function reload() { await fetchReqs(true); refresh() }
  async function act(fn, ...args) {
    try {
      const res = await fn(...args)
      if (res?.error) return res
      await reload()
      return res
    } catch (err) { console.error(err); return { error:'Something went wrong' } }
  }

  const borrowing = reqs.filter(r=>r.borrower_id===user?.id)
  const lending   = reqs.filter(r=>r.owner_id===user?.id)
  const tier = TRUST_TIERS[user?.trust_tier]||TRUST_TIERS.newcomer
  const activeCount = borrowing.filter(r=>['active','selected'].includes(r.status)).length

  const tabs = [
    { id:'borrowing', label:'Borrowing', count:borrowing.length, icon:'📥' },
    { id:'lending',   label:'Lending',   count:lending.length,   icon:'📤' },
    { id:'profile',   label:'Profile',   icon:'👤' },
  ]

  function ReqCard({ r, isBorrowing }) {
    const isPaid = r.is_paid
    const isLF   = r.listing_type === 'lost_found'

    const statusColors = { pending:'#F59E0B', selected:T.coral, active:T.navy, returned:T.success, declined:T.error, overdue:T.error }
    const accentColor = statusColors[r.status] || T.navy

    return (
      <div className="fade-in" style={{ borderRadius:'var(--radius-sm)', marginBottom:12, background:'#fff', boxShadow:'var(--shadow)', overflow:'hidden', border:`1px solid ${accentColor}22`, borderLeft:`4px solid ${accentColor}` }}>
        {/* Card header with navy background */}
        <div style={{ background:`linear-gradient(135deg, ${T.navy} 0%, #1E293B 100%)`, padding:'12px 14px', ...row(10) }}>
          <Av user={isBorrowing ? {name:r.owner_name} : {avatar:r.borrower_avatar, color:r.borrower_color}} size={36} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'#fff', fontFamily:'var(--font-head)' }}>{r.item_title}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:2 }}>
              {isBorrowing ? `from ${r.owner_name}` : r.borrower_name}
              {!isLF && ` · ${r.requested_days}d`}
              {isPaid && <span style={{ color:T.coral, fontWeight:600 }}> · ₹{r.total_amount}</span>}
              {r.message ? ` · "${r.message}"` : ''}
            </div>
          </div>
          <SBadge status={r.status} inline />
        </div>

        <div style={{ padding:'10px 10px 12px' }}>
        {r.status==='active' && r.due_at && (
          <div style={{ fontSize:12, color:T.textMid, marginBottom:8, ...row(6) }}>
            <span>📅</span>
            <span>Due: {new Date(r.due_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
            {new Date()>new Date(r.due_at) && <span style={{ color:T.error, fontWeight:600 }}>⚠ Overdue</span>}
          </div>
        )}

        {/* LF flow */}
        {isLF && isBorrowing && r.status==='selected' && <LFPickupPanel r={r} reload={reload} showToast={showToast} />}
        {isLF && !isBorrowing && r.status==='selected' && (
          <InfoBanner type="info">
            {r.pickup_message ? <>📍 Claimer says: <strong>"{r.pickup_message}"</strong></> : '⏳ Waiting for claimer to send pickup location…'}
          </InfoBanner>
        )}
        {isLF && isBorrowing && r.status==='active' && <InfoBanner type="success">✅ Lender handed over the item. Confirm receipt below.</InfoBanner>}

        {/* Marketplace handover */}
        {!isLF && !isBorrowing && r.status==='active' && <PickupDetailsPanel r={r} reload={reload} showToast={showToast} />}
        {!isLF && isBorrowing && r.status==='active' && r.pickup_details && !r.borrower_received && (
          <InfoBanner type="info">
            📍 Pickup: <strong>"{r.pickup_details}"</strong>
            {r.item_given && <div style={{marginTop:4, fontWeight:600}}>✅ Lender says given — confirm below.</div>}
          </InfoBanner>
        )}
        {!isLF && isBorrowing && r.status==='active' && !r.pickup_details && <InfoBanner type="warn">⏳ Waiting for lender to send pickup details…</InfoBanner>}
        {!isLF && isBorrowing && r.status==='active' && r.borrower_received && (
          <InfoBanner type="success">✅ Receipt confirmed. {isPaid ? 'Admin will process payout soon.' : 'Lender will confirm return when done.'}</InfoBanner>
        )}
        {isBorrowing && r.status==='selected' && !isPaid && !isLF && <InfoBanner type="success">🎉 Selected! Lender will send pickup details soon.</InfoBanner>}

        {/* Paid info */}
        {isBorrowing && r.status==='selected' && isPaid && !r.payment_confirmed && (
          <InfoBanner type="warn">💳 Pay <strong>₹{r.total_amount}</strong> via UPI to confirm rental.</InfoBanner>
        )}
        {isBorrowing && r.status==='selected' && isPaid && r.payment_confirmed && (
          <InfoBanner type="success">✅ Payment of ₹{r.total_amount} confirmed. Waiting for handover.</InfoBanner>
        )}

        {/* Payout banners */}
        {!isBorrowing && isPaid && r.payout_status==='admin_paid' && (
          <InfoBanner type="warn">💸 Admin sent your payment. Check UPI and confirm below.</InfoBanner>
        )}
        {!isBorrowing && isPaid && r.payout_status==='disputed' && (
          <InfoBanner type="error">⚠️ Dispute raised — admin notified and will resolve shortly.</InfoBanner>
        )}
        {!isBorrowing && isPaid && r.payout_status==='done' && r.status!=='returned' && (
          <InfoBanner type="success">✅ Payment received. Confirm return when item is back.</InfoBanner>
        )}

        {/* ACTION BUTTONS */}
        <div className="req-actions" style={{ ...row(8), flexWrap:'wrap', marginTop:8 }}>

          {/* Pay button */}
          {isBorrowing && r.status==='selected' && isPaid && !r.payment_confirmed && (
            <button className="btn-press" style={{ ...btn(true,true), flex:1 }} onClick={async () => {
              const orderRes = await api.createPaymentOrder(r.id)
              if (orderRes?.error) { showToast(orderRes.error); return }
              if (!window.Razorpay) {
                await new Promise((resolve,reject) => {
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
                    razorpay_order_id:   response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature:  response.razorpay_signature,
                  })
                  if (verifyRes?.error) { showToast('Verification failed. Contact support.'); return }
                  showToast('Payment successful! Waiting for handover.')
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
          {!isBorrowing && r.status==='pending' && (
            <>
              {isPaid && !user?.upi_id && (
                <InfoBanner type="error">⚠️ Add UPI ID in Profile tab before approving paid requests.</InfoBanner>
              )}
              <button className="btn-press" style={{ ...btn(true,true) }} onClick={async () => {
                if (isPaid && !user?.upi_id) { showToast('Add UPI ID in Profile first.'); return }
                try {
                  const res = await api.approveRequest(r.id)
                  if (res?.error) { showToast(res.error); return }
                  showToast('Approved!')
                  await reload()
                } catch (err) { console.error(err); showToast('Approval failed') }
              }}>Approve</button>
              <button className="btn-press" style={btn(false,true)} onClick={async()=>{ await act(api.declineRequest,r.id); showToast('Declined.') }}>Decline</button>
            </>
          )}

          {/* Confirm payment (paid) */}
          {!isBorrowing && r.status==='selected' && isPaid && r.payment_confirmed && (
            <button className="btn-press" style={btn(true,true)} onClick={async()=>{
              const res = await act(api.finalizeBorrow, r.id)
              if(res&&!res.error){ showToast('Payment confirmed! Send pickup details.'); await reload() }
            }}>Confirm Payment</button>
          )}

          {/* Confirm & proceed (non-paid) */}
          {!isBorrowing && r.status==='selected' && !isPaid && !isLF && (
            <button className="btn-press" style={btn(true,true)} onClick={async()=>{
              const res = await act(api.finalizeBorrow, r.id)
              if(res&&!res.error){ showToast('Confirmed! Send pickup details.'); await reload() }
            }}>Confirm &amp; Proceed</button>
          )}

          {/* Revoke */}
          {isBorrowing && r.status==='pending' && (
            <button className="btn-press" style={{ ...btn(false,true), color:T.error, border:`1px solid ${T.error}44` }} onClick={async()=>{
              if(!window.confirm('Revoke this request?')) return
              const res = await api.revokeRequest(r.id)
              if(res?.error){ showToast(res.error); return }
              showToast('Request revoked.')
              await reload()
            }}>Revoke</button>
          )}

          {/* Item given */}
          {!isLF && !isBorrowing && r.status==='active' && r.pickup_details && !r.item_given && (
            <button className="btn-press" style={btn(true,true)} onClick={async()=>{
              if(!window.confirm('Confirm item physically given?')) return
              const res = await api.confirmItemGiven(r.id)
              if(res?.error){ showToast(res.error); return }
              showToast('Marked as given!')
              await reload()
            }}>Item Given ✓</button>
          )}

          {/* Borrower received */}
          {!isLF && isBorrowing && r.status==='active' && r.item_given && !r.borrower_received && (
            <button className="btn-press" style={btn(true,true)} onClick={async()=>{
              if(!window.confirm('Confirm you received the item?')) return
              const res = await api.confirmBorrowerReceived(r.id)
              if(res?.error){ showToast(res.error); return }
              showToast(isPaid ? 'Receipt confirmed! Payout incoming.' : 'Item received!')
              await reload()
            }}>I've Received Item ✓</button>
          )}

          {/* LF handover buttons */}
          {isLF && !isBorrowing && r.status==='selected' && r.pickup_message && (
            <button className="btn-press" style={btn(true,true)} onClick={async()=>{
              const res = await api.confirmHandover(r.id)
              if(res?.error){ showToast(res.error); return }
              showToast('Handed over! Waiting for claimer.')
              await reload()
            }}>Handed Over ✓</button>
          )}
          {isLF && isBorrowing && r.status==='active' && (
            <button className="btn-press" style={btn(true,true)} onClick={async()=>{
              if(!window.confirm('Confirm you received this item?')) return
              const res = await api.confirmLFReceived(r.id)
              if(!res||res.error){ showToast(res?.error||'Something went wrong.'); return }
              showToast('Item received! Lost & found case closed.')
              await reload()
            }}>I've Received It ✓</button>
          )}

          {/* Payout confirm/dispute */}
          {!isBorrowing && isPaid && r.payout_status==='admin_paid' && (
            <>
              <button className="btn-press" style={{ ...btn(true,true), flex:1, background:T.success }} onClick={async()=>{
                const res = await api.confirmPaymentReceived(r.id)
                if(res?.error){ showToast(res.error); return }
                showToast('Payment confirmed!')
                await reload()
              }}>Payment Received ✓</button>
              <button className="btn-press" style={{ ...btn(false,true), flex:1, color:T.error, border:`1px solid ${T.error}44` }} onClick={async()=>{
                if(!window.confirm('Raise dispute? Admin will be notified.')) return
                const res = await api.raiseDispute(r.id)
                if(res?.error){ showToast(res.error); return }
                showToast('Dispute raised. Admin notified.')
                await reload()
              }}>Raise Dispute ⚠️</button>
            </>
          )}

          {/* Confirm return */}
          {!isBorrowing && r.listing_type!=='lost_found' && ['active','overdue'].includes(r.status) && (
            <button className="btn-press" style={btn(true,true)} onClick={async()=>{
              const res = await act(api.confirmReturn, r.id)
              console.log("RETURN RESPONSE:", res)
              if(!res||res.error){ showToast("Return failed"); return }
              showToast(res.onTime===false ? 'Return confirmed (late).' : 'Return confirmed!')
            }}>Confirm Return</button>
          )}
        </div>
        </div>{/* end card body */}
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      {/* Navy header */}
      <div style={{ margin:'-8px -24px 20px', padding:'20px 24px 16px', background:`linear-gradient(135deg, ${T.navy} 0%, #1E293B 100%)`, borderRadius:'16px 16px 0 0' }}>
        <div style={{ ...row(0), justifyContent:'space-between', marginBottom:2 }}>
          <div style={{ fontFamily:'var(--font-head)', fontSize:22, fontWeight:700, color:'#fff', letterSpacing:'-0.5px' }}>My Activity</div>
          <div style={{ ...row(6) }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#10B981', animation:'pulse 2s infinite' }} />
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : 'Loading…'}
            </span>
          </div>
        </div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:16 }}>Updates every 8 seconds</div>

        {/* Tabs on navy */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'9px 4px', borderRadius:'var(--radius-xs)', border:`1.5px solid ${tab===t.id?T.coral:'rgba(255,255,255,0.12)'}`,
              cursor:'pointer', fontSize:12, fontWeight:600,
              background: tab===t.id ? T.coral : 'rgba(255,255,255,0.06)',
              color: tab===t.id ? '#fff' : 'rgba(255,255,255,0.6)',
              transition:'all 0.18s',
            }}>
              {t.icon} {t.label}{t.count!==undefined ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{ height:80 }} />)}
        </div>
      )}

      {!loading && tab==='borrowing' && (
        <>
          <div style={{ ...row(8), marginBottom:12 }}>
            <TierBadge tier={user?.trust_tier}/>
            <span style={{ fontSize:13, color:T.textMid }}>{activeCount}/{tier.limit} slots used</span>
          </div>
          {borrowing.length===0
            ? <div style={{ textAlign:'center', padding:'2rem 0', color:T.textSoft }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
                <div>Nothing borrowed yet.</div>
              </div>
            : borrowing.map(r=><ReqCard key={r.id} r={r} isBorrowing />)
          }
        </>
      )}

      {!loading && tab==='lending' && (
        <>
          {lending.length===0
            ? <div style={{ textAlign:'center', padding:'2rem 0', color:T.textSoft }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📤</div>
                <div>No lending activity. <span style={{ color:T.coral, cursor:'pointer', fontWeight:600 }} onClick={onClose}>List an item!</span></div>
              </div>
            : lending.map(r=><ReqCard key={r.id} r={r} isBorrowing={false} />)
          }
        </>
      )}

      {!loading && tab==='profile' && (
        <>
          <div style={{ ...row(12), marginBottom:20, padding:'16px', background:`${T.coral}08`, borderRadius:'var(--radius-sm)', border:`1px solid ${T.coral}20` }}>
            <Av user={user} size={52} />
            <div>
              <div style={{ fontFamily:'var(--font-head)', fontSize:18, fontWeight:800 }}>{user?.name}</div>
              <div style={{ fontSize:13, color:T.textMid }}>{user?.email}</div>
              <div style={{ fontSize:12, color:T.textSoft, marginTop:2 }}>{user?.college_name}</div>
            </div>
          </div>

          <div className="profile-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {[
              ['Trust tier', <TierBadge tier={user?.trust_tier}/>],
              ['Borrow limit', `${tier.limit} items`],
              ['On-time returns', user?.return_count ?? 0],
              ['Roll number', user?.roll_number],
            ].map(([l,v])=>(
              <div key={l} style={{ background:'rgba(15,23,42,0.03)', borderRadius:'var(--radius-sm)', padding:'12px 14px', border:'1px solid var(--border-soft)' }}>
                <div style={{ fontSize:11, color:T.textSoft, marginBottom:4, fontWeight:500 }}>{l}</div>
                <div style={{ fontSize:15, fontWeight:600 }}>{v}</div>
              </div>
            ))}
          </div>

          <UpiField user={user} setUser={setUser} showToast={showToast} />

          {user?.trust_tier!=='rep' && (()=>{
            const next={newcomer:'regular',regular:'trusted',trusted:'rep'}[user.trust_tier]
            const thresholds={newcomer:0,regular:3,trusted:10,rep:25}
            const need=thresholds[next]-(user?.return_count||0)
            return (
              <div style={{ fontSize:13, color:T.textMid, borderTop:'1px solid var(--border-soft)', paddingTop:14 }}>
                {need} more on-time return{need!==1?'s':''} to reach <TierBadge tier={next}/>
              </div>
            )
          })()}
        </>
      )}

      <div style={{ ...row(8), justifyContent:'flex-end', marginTop:16 }}>
        <button className="btn-press" style={btn(true)} onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}

// ── ITEM CARD ─────────────────────────────────────────────────────────────────
function ItemCard({ item, currentUserId, onRequest, myRequests=[] }) {
  const isYours  = item.owner_id === currentUserId
  const isLF     = item.listing_type === 'lost_found'
  const alreadyRequested = myRequests.some(r=>r.item_id===item.id&&['pending','selected','active'].includes(r.status))
  const canAct   = !isYours && !alreadyRequested && (isLF || item.status==='available')
  const firstPhoto = item.images?.[0]

  return (
    <div className="item-card" style={{ ...card, cursor:canAct?'pointer':'default', minWidth:0, overflow:'hidden', width:'100%' }} onClick={()=>canAct&&onRequest(item)}>
      {/* Image / thumbnail */}
      <div style={{ height:120, display:'flex', alignItems:'center', justifyContent:'center', background:firstPhoto?'#000':`linear-gradient(135deg, ${T.coral}10, ${T.navy}08)`, position:'relative', overflow:'hidden', flexShrink:0 }}>
        {firstPhoto
          ? <img src={firstPhoto} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.9 }} />
          : <span style={{ fontSize:44, filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }}>{isLF?'🔍':EMOJIS[item.category]||'📦'}</span>
        }
        {/* Badges */}
        {isYours
          ? <span style={{ background:`${T.coral}22`, color:T.coral, fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, position:'absolute', top:10, right:10, backdropFilter:'blur(4px)' }}>Yours</span>
          : isLF
            ? <span style={{ background:'#EDE9FE', color:'#5B21B6', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, position:'absolute', top:10, right:10 }}>Lost & Found</span>
            : <SBadge status={item.status} />
        }
        {item.is_paid && !isLF && (
          <div style={{ position:'absolute', bottom:10, left:10, background:'rgba(15,23,42,0.85)', color:'#fff', fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:20, backdropFilter:'blur(4px)' }}>
            ₹{item.price_per_day}/day
          </div>
        )}
      </div>

      <div style={{ padding:'12px 14px 14px' }}>
        <div style={{ fontFamily:'var(--font-head)', fontSize:13, fontWeight:700, marginBottom:3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{item.title}</div>
        <div style={{ fontSize:11, color:T.textSoft, marginBottom:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.category}{!isLF?` · max ${item.max_borrow_days}d`:''}</div>
        <div style={{ ...row(0), justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:T.textMid, minWidth:0, overflow:'hidden' }}>
            <Av user={{ avatar:item.owner_avatar, color:item.owner_color, name:item.owner_name }} size={18} />
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.owner_name?.split(' ')[0]}</span>
          </div>
          {isYours
            ? <span style={{ fontSize:11, color:T.textSoft }}>listed</span>
            : !canAct
              ? <span style={{ fontSize:11, color:T.textSoft }}>Unavailable</span>
              : <span style={{ ...btn(true,true), display:'inline-block', pointerEvents:'none', fontSize:12, padding:'5px 12px' }}>{isLF?'Claim':'Request'}</span>
          }
        </div>
      </div>
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [user,       setUser]       = useState(()=>api.getSavedUser())
  const [tab,        setTab]        = useState('marketplace')
  const [items,      setItems]      = useState([])
  const prevTabRef = useRef('marketplace')
  const [stats,      setStats]      = useState({})
  const [cat,        setCat]        = useState('all')
  const [avail,      setAvail]      = useState('all')
  const [search,     setSearch]     = useState('')
  const [listOpen,   setList]       = useState(false)
  const [actOpen,    setAct]        = useState(false)
  const [borrowItem, setBorrow]     = useState(null)
  const [tick,       setTick]       = useState(0)
  const [toast,      showToast]     = useToast()
  const [myRequests, setMyRequests] = useState([])
  const refresh = useCallback(()=>setTick(t=>t+1),[])

  useEffect(()=>{
    if (!user) return
    api.getMe().then(r => {
      if (r?.user) { setUser(r.user); api.persistUser(r.user) }
    })
  }, [])

  // Cache key — tab-specific so marketplace and L&F never share cache
  const cacheKey = `cs_items_${tab}_${cat}_${avail}_${user?.id}`
  const statsKey = `cs_stats_${user?.id}`

  // Fetch items + stats + requests — all parallel for speed
  const fetchMarketplace = useCallback(async (silent=false) => {
    if (!user) return

    const tabChanged = prevTabRef.current !== tab
    prevTabRef.current = tab

    if (!silent) {
      if (tabChanged) {
        // Tab switched — clear immediately so wrong items never show
        setItems([])
      } else {
        // Same tab — show stale cache for instant perceived load
        try {
          const cached = localStorage.getItem(cacheKey)
          if (cached) setItems(JSON.parse(cached))
        } catch (_) {}
      }
      // Show cached stats immediately
      try {
        const cachedStats = localStorage.getItem(statsKey)
        if (cachedStats) setStats(JSON.parse(cachedStats))
      } catch (_) {}
    }

    const itemParams = tab==='marketplace'
      ? { listingType:'borrow', category:cat!=='all'?cat:undefined, status:avail==='available'?'available':undefined, search:search||undefined }
      : { listingType:'lost_found', search:search||undefined }

    // All three in parallel
    const [itemsRes, statsRes, reqsRes] = await Promise.all([
      api.getItems(itemParams),
      api.getStats(),
      api.getMyRequests(),
    ])

    if (!itemsRes.error) {
      setItems(itemsRes.items||[])
      try { localStorage.setItem(cacheKey, JSON.stringify(itemsRes.items||[])) } catch (_) {}
    }
    if (!statsRes.error) {
      setStats(statsRes)
      try { localStorage.setItem(statsKey, JSON.stringify(statsRes)) } catch (_) {}
    }
    if (!reqsRes.error) setMyRequests(reqsRes.requests||[])

  }, [user, tab, cat, avail, search, cacheKey, statsKey])

  // Trigger on filter/tab/search/tick changes
  useEffect(() => { fetchMarketplace(false) }, [fetchMarketplace, tick])

  // Silent background polling every 15 seconds
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => fetchMarketplace(true), 15000)
    return () => clearInterval(interval)
  }, [fetchMarketplace])

  function handleLogout() { api.clearSession(); setUser(null) }

  if (!user) return <AuthScreen onLogin={u=>setUser(u)} />
  if (isAdmin) return <Admin goBack={()=>setIsAdmin(false)} />

  const CAT_COUNTS = CATEGORIES.reduce((a,c)=>{ a[c]=items.filter(i=>i.category===c).length; return a },{})
  const tier = TRUST_TIERS[user.trust_tier] || TRUST_TIERS.newcomer
  const activeCount = myRequests.filter(r=>['active','selected'].includes(r.status)).length

  return (
    <Ctx.Provider value={{ user, setUser }}>
      <style>{FONTS}</style>

      <div style={{ fontFamily:'var(--font-body)', color:T.navy, minHeight:'100vh', background:T.cream, position:'relative', overflowX:'hidden', maxWidth:'100vw' }}>

        {/* MODALS */}
        {listOpen   && <ListItemModal  open={listOpen}    onClose={()=>setList(false)}  onSuccess={refresh} />}
        {borrowItem && <BorrowModal    open={!!borrowItem} item={borrowItem}             onClose={()=>setBorrow(null)} onSuccess={refresh} showToast={showToast} />}
        {actOpen    && <ActivityModal  open={actOpen}     onClose={()=>setAct(false)}   refresh={refresh}   showToast={showToast} />}

        {/* DESKTOP HEADER */}
        <header className="desktop-only" style={{ ...row(0), justifyContent:'space-between', padding:'0 24px', height:60, background:'rgba(255,248,240,0.9)', backdropFilter:'blur(12px)', borderBottom:`1px solid var(--border-soft)`, position:'sticky', top:0, zIndex:100 }}>
          <Logo />
          <div style={row(8)}>
            <div style={{ ...row(6), fontSize:13, color:T.textMid }}>
              <Av user={user} size={28} />
              <span style={{ fontWeight:500 }}>{user.name?.split(' ')[0]}</span>
              <TierBadge tier={user.trust_tier}/>
              <span style={{ color:T.textSoft, fontSize:12 }}>· {user.college_name}</span>
            </div>
            <button className="btn-press" style={btn(false)} onClick={()=>setAct(true)}>Activity</button>
            <button className="btn-press" style={btn(true)}  onClick={()=>setList(true)}>+ List Item</button>
            <button className="btn-press" style={{ ...btn(false), fontSize:12 }} onClick={()=>setIsAdmin(true)}>Admin</button>
            <button className="btn-press" style={{ ...btn(false), fontSize:12 }} onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        {/* MOBILE HEADER */}
        <header className="mobile-only" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', height:50, background:'rgba(255,248,240,0.97)', backdropFilter:'blur(12px)', borderBottom:`1px solid var(--border-soft)`, position:'sticky', top:0, zIndex:100, width:'100%', boxSizing:'border-box' }}>
          <div style={{ flexShrink:1, minWidth:0, overflow:'hidden' }}>
            <Logo />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, paddingLeft:8 }}>
            <TierBadge tier={user.trust_tier}/>
            <button onClick={handleLogout} style={{ background:'rgba(15,23,42,0.07)', border:'none', borderRadius:7, padding:'4px 8px', fontSize:11, fontWeight:600, color:T.textMid, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>↪ Out</button>
          </div>
        </header>

        {/* HERO — compact navy+coral split bar */}
        <div style={{ background:`linear-gradient(135deg, ${T.navy} 0%, #1E293B 60%, #0F172A 100%)`, borderBottom:`1px solid rgba(232,68,90,0.2)`, overflow:'hidden', width:'100%', boxSizing:'border-box' }}>
          {/* Top row: tagline + stats chips */}
          <div className="hero-pad" style={{ padding:'16px 24px 12px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10, width:'100%', boxSizing:'border-box' }}>
            <div>
              <div style={{ fontFamily:'var(--font-head)', fontSize:'clamp(20px,5vw,28px)', fontWeight:800, color:'#fff', letterSpacing:'-0.5px', lineHeight:1.1 }}>
                Share more, <span style={{ color:T.coral }}>spend less.</span>
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:4 }}>
                {user.college_name} · peer lending
              </div>
            </div>
            {/* Live stats chips */}
            <div className="stats-chips" style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', maxWidth:'100%' }}>
              {/* Live */}
              <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 8px', background:'rgba(16,185,129,0.15)', borderRadius:20, border:'1px solid rgba(16,185,129,0.3)', flexShrink:0 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#10B981', animation:'pulse 2s infinite' }} />
                <span style={{ fontSize:10, color:'#10B981', fontWeight:600 }}>Live</span>
              </div>
              {[[stats.available,'📦','avail'],[stats.students,'🎓','users']].map(([n,ic,l])=>(
                <div key={l} style={{ background:'rgba(255,255,255,0.08)', borderRadius:20, padding:'4px 10px', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                  <span style={{ fontSize:12 }}>{ic}</span>
                  <span style={{ fontFamily:'var(--font-head)', fontSize:13, fontWeight:700, color:'#fff' }}>
                    {n !== undefined && n !== null ? n : <span style={{ opacity:0.4 }}>·</span>}
                  </span>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>{l}</span>
                </div>
              ))}
              <div style={{ background:`${T.coral}22`, borderRadius:20, padding:'4px 10px', display:'flex', alignItems:'center', gap:5, flexShrink:0, border:`1px solid ${T.coral}44` }}>
                <span style={{ fontSize:11, color:T.coral, fontWeight:700 }}>{Math.max(0,tier.limit-activeCount)}/{tier.limit}</span>
                <TierBadge tier={user.trust_tier}/>
              </div>
            </div>
          </div>

          {/* Bottom row: tab pills + search — stacks on mobile */}
          <div className="hero-bottom" style={{ padding:'0 24px 14px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', width:'100%', boxSizing:'border-box' }}>
            <div className="hero-tabs" style={{ display:'flex', gap:6, flexShrink:0 }}>
              {[['marketplace','📦 Market'],['lostfound','🔍 L&F']].map(([id,label])=>(
                <button key={id} className="btn-press" onClick={()=>{
                  if(id!==tab){ setItems([]); setSearch(''); setCat('all') }
                  setTab(id)
                }} style={{
                  padding:'7px 14px', borderRadius:40, border:`1.5px solid ${tab===id?T.coral:'rgba(255,255,255,0.15)'}`,
                  background:tab===id?T.coral:'rgba(255,255,255,0.06)', color:tab===id?'#fff':'rgba(255,255,255,0.65)',
                  fontWeight:600, cursor:'pointer', fontSize:12, transition:'all 0.18s',
                  boxShadow:tab===id?'var(--shadow-coral)':'none', whiteSpace:'nowrap',
                }}>{label}</button>
              ))}
            </div>
            <div className="search-bar" style={{ position:'relative', flex:1, minWidth:140 }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:13, pointerEvents:'none' }}>🔎</span>
              <input className="dark-search" style={{ ...INP, paddingLeft:36, borderRadius:40, background:'rgba(255,255,255,0.1)', border:'1.5px solid rgba(255,255,255,0.12)', color:'#fff', fontSize:13, width:'100%' }}
                placeholder="Search…"
                value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* BODY — desktop: sidebar + grid, mobile: grid only full width */}
        <div style={{ display:'flex', minHeight:'calc(100vh - 200px)' }}>

          {/* SIDEBAR — desktop only, never rendered on mobile */}
          {tab==='marketplace' && (
            <div className="desktop-only" style={{ width:200, flexShrink:0, borderRight:`1px solid var(--border-soft)`, background:'rgba(255,255,255,0.4)', display:'flex', flexDirection:'column' }}>
              <div style={{ background:`linear-gradient(180deg, ${T.navy} 0%, #1E293B 100%)`, padding:'20px 14px 14px' }}>
                <div style={{ fontFamily:'var(--font-head)', fontSize:14, fontWeight:700, color:'#fff', marginBottom:2 }}>Browse</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)' }}>Filter by category</div>
              </div>
              <div style={{ padding:'14px 14px 0' }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', color:T.textSoft, textTransform:'uppercase', marginBottom:10 }}>Category</div>
                {[['all','All items',items.length],...CATEGORIES.map(c=>[c,c,CAT_COUNTS[c]])].map(([val,label,count])=>(
                  <button key={val} onClick={()=>setCat(val)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderRadius:'var(--radius-xs)', fontSize:13, cursor:'pointer', color:cat===val?T.coral:T.text, fontWeight:cat===val?600:400, background:cat===val?`${T.coral}10`:'transparent', border:'none', width:'100%', textAlign:'left', marginBottom:2, transition:'all 0.15s' }}>
                    <span>{label}</span>
                    <span style={{ fontSize:11, background:cat===val?`${T.coral}20`:'rgba(15,23,42,0.06)', color:cat===val?T.coral:T.textSoft, padding:'2px 7px', borderRadius:20 }}>{count}</span>
                  </button>
                ))}
                <Divider />
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', color:T.textSoft, textTransform:'uppercase', marginBottom:10 }}>Availability</div>
                {[['all','Show all'],['available','Available now']].map(([val,label])=>(
                  <button key={val} onClick={()=>setAvail(val)} style={{ display:'flex', padding:'8px 10px', borderRadius:'var(--radius-xs)', fontSize:13, cursor:'pointer', color:avail===val?T.coral:T.text, fontWeight:avail===val?600:400, background:avail===val?`${T.coral}10`:'transparent', border:'none', width:'100%', textAlign:'left', marginBottom:2, transition:'all 0.15s' }}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* GRID — takes full width on mobile since sidebar is hidden */}
          <div className="main-content" style={{ flex:1, minWidth:0, padding:'20px 20px', overflowX:'hidden', boxSizing:'border-box' }}>
            <div style={{ ...row(0), justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
              <span style={{ fontSize:14, color:T.textMid, fontWeight:500 }}>
                {tab==='lostfound' ? `${items.length} found item${items.length!==1?'s':''}` : `${items.length} item${items.length!==1?'s':''}`}
              </span>
              <span style={{ fontSize:12, color:T.textSoft }}>Most recent first</span>
            </div>

            {tab==='lostfound' && items.length===0 && (
              <div style={{ textAlign:'center', padding:'4rem 0' }}>
                <div style={{ fontSize:56, marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:16, color:T.textMid, marginBottom:6, fontWeight:600 }}>No lost & found items yet.</div>
                <div style={{ fontSize:14, color:T.textSoft, marginBottom:20 }}>Found something? Let others know.</div>
                <button className="btn-press" style={btn(true)} onClick={()=>setList(true)}>Report a found item</button>
              </div>
            )}

            {items.length===0 && tab==='marketplace' && (
              <div style={{ textAlign:'center', padding:'4rem 0', color:T.textSoft, fontSize:14 }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
                No items match your filter.
              </div>
            )}

            <div className="item-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(160px,45vw),1fr))', gap:12 }}>
              {items.filter(item=>item.status!=='closed').map(item=>(
                <ItemCard key={item.id+'-'+tick} item={item} currentUserId={user.id} onRequest={i=>setBorrow(i)} myRequests={myRequests} />
              ))}
            </div>
          </div>
        </div>

        {/* MOBILE BOTTOM NAV */}
        <nav className="mobile-only" style={{ position:'fixed', bottom:0, left:0, right:0, height:68, background:'rgba(255,248,240,0.96)', backdropFilter:'blur(16px)', borderTop:`1px solid var(--border-soft)`, display:'flex', alignItems:'center', justifyContent:'space-around', padding:'0 8px 8px', zIndex:150 }}>
          {[
            { icon:'📦', label:'Market',  action:()=>{ if(tab!=='marketplace'){ setItems([]) } setTab('marketplace') }, active:tab==='marketplace' },
            { icon:'🔍', label:'L&F',     action:()=>{ if(tab!=='lostfound'){ setItems([]) } setTab('lostfound') },   active:tab==='lostfound'   },
            { icon:'➕', label:'List',    action:()=>setList(true),         active:false, primary:true  },
            { icon:'📋', label:'Activity',action:()=>setAct(true),          active:false               },
            { icon:'⚙️', label:'Admin',   action:()=>setIsAdmin(true),      active:false               },
          ].map(({ icon, label, action, active, primary })=>(
            <button key={label} onClick={action} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background: primary?T.coral:'transparent', color:primary?'#fff':active?T.coral:T.textSoft, border:'none', cursor:'pointer', padding: primary?'10px 16px':'6px 12px', borderRadius: primary?40:'var(--radius-xs)', fontWeight:600, transition:'all 0.18s', boxShadow:primary?'var(--shadow-coral)':'none' }}>
              <span style={{ fontSize: primary?22:18 }}>{icon}</span>
              <span style={{ fontSize:10 }}>{label}</span>
            </button>
          ))}
        </nav>

        <Toast msg={toast} />
      </div>
    </Ctx.Provider>
  )
}
