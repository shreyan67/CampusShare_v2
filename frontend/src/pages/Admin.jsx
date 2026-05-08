import { useEffect, useState } from "react";

// Derive backend root from the same VITE_API_URL env var used by api.js
// VITE_API_URL = "https://your-backend.onrender.com/api"
// We strip "/api" to get the backend root for admin routes
const _apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const BASE_URL = _apiUrl.replace(/\/api$/, '')

const S = {
  page:    { padding: "24px", fontFamily: "'DM Sans', sans-serif", background: "#f5f5f0", minHeight: "100vh" },
  card:    { background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "20px", marginBottom: 16 },
  h1:      { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  h2:      { fontSize: 16, fontWeight: 600, marginBottom: 14, color: "#1a1a1a" },
  tab:     (active) => ({ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 500, fontSize: 13, background: active ? "#e94560" : "#eee", color: active ? "#fff" : "#333" }),
  badge:   (color) => ({ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: color === "green" ? "#eaf3de" : color === "red" ? "#FCEBEB" : color === "orange" ? "#FAEEDA" : "#f0f0f0", color: color === "green" ? "#3B6D11" : color === "red" ? "#A32D2D" : color === "orange" ? "#854F0B" : "#555" }),
  btn:     (danger) => ({ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, background: danger ? "#e94560" : "#1a1a1a", color: "#fff" }),
  th:      { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#666", padding: "8px 12px", borderBottom: "0.5px solid #eee", whiteSpace: "nowrap" },
  td:      { padding: "10px 12px", fontSize: 13, borderBottom: "0.5px solid #f0f0f0", verticalAlign: "top" },
  row:     { display: "flex", alignItems: "center", gap: 8 },
  stat:    { background: "#f5f5f0", borderRadius: 10, padding: "14px 18px", flex: 1 },
}

function useAdmin() {
  const [key, setKey] = useState(() => sessionStorage.getItem("cs_admin_key") || "")

  function saveKey(k) {
    setKey(k)
    sessionStorage.setItem("cs_admin_key", k)
  }

  async function apiFetch(path, opts = {}) {
    const sep = path.includes("?") ? "&" : "?"
    const res = await fetch(`${BASE_URL}${path}${sep}key=${key}`, opts)
    if (res.status === 403) throw new Error("UNAUTHORIZED")
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  return { key, saveKey, apiFetch }
}

// ── AUTH GATE ─────────────────────────────────────────────────────────────────
function AuthGate({ onAuth, goBack }) {
  const [val, setVal] = useState("")
  const [err, setErr] = useState("")

  async function submit() {
    if (!val.trim()) return
    try {
      const res = await fetch(`${BASE_URL}/admin/items?key=${val.trim()}`)
      if (res.status === 403) { setErr("Wrong admin secret."); return }
      sessionStorage.setItem("cs_admin_key", val.trim())
      onAuth(val.trim())
    } catch {
      setErr("Could not connect to backend.")
    }
  }

  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...S.card, width: 320 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🔐 Admin Login</div>
          {goBack && (
            <button onClick={goBack} style={{ background:"transparent", border:"0.5px solid #ddd", borderRadius:8, padding:"4px 10px", fontSize:12, color:"#666", cursor:"pointer" }}>← Back</button>
          )}
        </div>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>Enter your ADMIN_SECRET to continue.</div>
        {err && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <input
          type="password"
          placeholder="Admin secret key"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "0.5px solid #ccc", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}
        />
        <button onClick={submit} style={{ ...S.btn(false), width: "100%", padding: "10px" }}>
          Enter Admin Panel
        </button>
      </div>
    </div>
  )
}

// ── PAYOUTS TAB ───────────────────────────────────────────────────────────────
const PAYOUT_STAGES = {
  manual_pending: { label: "💸 Awaiting Your Payment", color: "orange", order: 1 },
  admin_paid:     { label: "⏳ Lender Confirming",     color: "orange", order: 2 },
  disputed:       { label: "⚠️ Disputed",              color: "red",    order: 0 }, // disputes first
  done:           { label: "✅ Lender Confirmed",       color: "green",  order: 3 },
}

function PayoutsTab({ apiFetch }) {
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(null)
  const [err, setErr]         = useState("")
  const [filter, setFilter]   = useState("all") // all | pending | disputed
  const [searchQuery, setSearchQuery] = useState("")
  const [totalEarningsAllTime, setTotalEarningsAllTime] = useState(0)

  async function load() {
    setLoading(true)
    setErr("")
    try {
      const [data, stats] = await Promise.all([
        apiFetch("/api/payments/pending-payouts"),
        apiFetch("/api/payments/admin-stats").catch(() => ({ totalEarnings: 0 }))
      ])
      // Sort: disputed first, then by payout stage order, then newest first
      const sorted = (data.pendingPayouts || []).sort((a, b) => {
        const ao = PAYOUT_STAGES[a.payoutStatus]?.order ?? 9
        const bo = PAYOUT_STAGES[b.payoutStatus]?.order ?? 9
        return ao - bo
      })
      setPayouts(sorted)
      setTotalEarningsAllTime(stats?.totalEarnings || 0)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function nudgeLender(requestId) {
    if (!window.confirm("Send an email reminding the lender to hand over the item?")) return
    try {
      await apiFetch("/api/payments/nudge-lender", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId })
      })
      setPayouts(ps => ps.map(p => p.requestId === requestId ? { ...p, adminNudged: true } : p))
      alert("Email sent to lender.")
    } catch (e) { alert("Failed: " + e.message) }
  }

  async function refundBorrower(requestId, amount) {
    if (!window.confirm(`Confirm: You have refunded ₹${amount} to the borrower via UPI? This will cancel the request.`)) return
    try {
      await apiFetch("/api/payments/refund-borrower", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId })
      })
      setPayouts(ps => ps.map(p => p.requestId === requestId ? { ...p, payoutStatus: "refunded" } : p))
    } catch (e) { alert("Failed: " + e.message) }
  }

  async function markPaid(requestId, lenderName, lenderUpi, payLender) {
    if (!window.confirm(`Confirm: You've sent ₹${payLender} to ${lenderName} (${lenderUpi})?`)) return
    
    const adminUtr = window.prompt("Please enter the UPI Transaction ID (UTR) for proof of payment:\n\nThis will be emailed to the lender.");
    if (adminUtr === null) return; // user cancelled

    setMarking(requestId)
    try {
      await apiFetch("/api/payments/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, adminUtr }),
      })
      // Update in-place rather than removing — now shows as admin_paid
      setPayouts(ps => ps.map(p =>
        p.requestId === requestId ? { ...p, payoutStatus: "admin_paid", adminUtr } : p
      ))
    } catch (e) {
      alert("Failed: " + e.message)
    } finally {
      setMarking(null)
    }
  }

  async function dismissDispute(requestId) {
    if (!window.confirm("Force close this dispute and mark it as successfully paid?")) return
    try {
      await apiFetch("/api/payments/dismiss-dispute", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId })
      })
      setPayouts(ps => ps.filter(p => p.requestId !== requestId))
    } catch (e) { alert("Failed: " + e.message) }
  }

  const pendingCount  = payouts.filter(p => p.payoutStatus === "manual_pending").length
  const disputedCount = payouts.filter(p => p.payoutStatus === "disputed").length
  const pendingOwed   = payouts.filter(p => p.payoutStatus === "manual_pending").reduce((s, p) => s + p.payLender, 0).toFixed(2)
  const totalEarned   = totalEarningsAllTime.toFixed(2)

  const filtered = payouts.filter(p => {
    if (filter === "pending" && !["manual_pending","admin_paid"].includes(p.payoutStatus)) return false;
    if (filter === "disputed" && p.payoutStatus !== "disputed") return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = (
        (p.itemTitle || "").toLowerCase().includes(q) ||
        (p.requestId || "").toLowerCase().includes(q) ||
        (p.lenderName || "").toLowerCase().includes(q) ||
        (p.lenderEmail || "").toLowerCase().includes(q) ||
        (p.borrowerName || "").toLowerCase().includes(q) ||
        (p.borrowerEmail || "").toLowerCase().includes(q) ||
        (p.lenderUpi || "").toLowerCase().includes(q) ||
        (p.borrowerUpi || "").toLowerCase().includes(q)
      );
      if (!match) return false;
    }
    return true;
  });

  if (loading) return <p style={{ color: "#666", fontSize: 13 }}>Loading payouts…</p>
  if (err)     return <p style={{ color: "#c0392b", fontSize: 13 }}>Error: {err}</p>

  return (
    <div>
      {/* Disputed alert banner */}
      {disputedCount > 0 && (
        <div style={{ background: "#FCEBEB", border: "1px solid #e74c3c", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#A32D2D", fontWeight: 500 }}>
          ⚠️ {disputedCount} dispute{disputedCount > 1 ? "s" : ""} require your attention — lender(s) say they did not receive payment. Check the Disputed filter below.
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={S.stat}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Awaiting your payment</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#e94560" }}>{pendingCount}</div>
        </div>
        <div style={S.stat}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Amount to send out</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>₹{pendingOwed}</div>
        </div>
        <div style={S.stat}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Your total earnings</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#3B6D11" }}>₹{totalEarned}</div>
        </div>
        <div style={S.stat}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Total transactions</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{payouts.length}</div>
        </div>
      </div>

      {/* Pipeline legend */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#666", marginRight: 4 }}>Filter:</span>
        {[["all","All"], ["pending","Needs Action"], ["disputed","Disputed"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: "4px 12px", borderRadius: 20, border: "0.5px solid #ccc", cursor: "pointer", fontSize: 12,
              background: filter === v ? "#1a1a1a" : "#f5f5f0", color: filter === v ? "#fff" : "#333", fontWeight: filter === v ? 600 : 400 }}>
            {l}{v === "disputed" && disputedCount > 0 ? ` (${disputedCount})` : ""}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <input 
            type="text" 
            placeholder="Search title, name, email, UPI..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 20, border: "0.5px solid #ccc", fontSize: 12, width: 220 }}
          />
          <button onClick={load} style={{ padding: "4px 12px", borderRadius: 20, border: "0.5px solid #ccc", cursor: "pointer", fontSize: 12, background: "#f5f5f0" }}>↻ Refresh</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#999", fontSize: 14 }}>
          {filter === "all" ? "No paid rentals yet." : `No ${filter} items.`}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f0" }}>
                <th style={S.th}>Item</th>
                <th style={S.th}>Parties</th>
                <th style={S.th}>UPI Info</th>
                <th style={S.th}>Total Collected</th>
                <th style={S.th}>Platform Fee</th>
                <th style={S.th}>Pay Lender</th>
                <th style={S.th}>Payout Stage</th>
                <th style={S.th}>Item Status</th>
                <th style={S.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const stage     = PAYOUT_STAGES[p.payoutStatus] || { label: p.payoutStatus, color: "gray" }
                const isDispute = p.payoutStatus === "disputed"
                const rowBg     = isDispute ? "#fff8f8" : "transparent"
                return (
                  <tr key={p.requestId} style={{ background: rowBg }}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 500 }}>{p.itemTitle}</div>
                      <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{p.requestId.slice(0,8)}…</div>
                    </td>
                    <td style={S.td}>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>Lender</span>
                        <div style={{ fontWeight: 500 }}>{p.lenderName}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{p.lenderEmail}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>Borrower</span>
                        <div style={{ fontWeight: 500 }}>{p.borrowerName}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{p.borrowerEmail}</div>
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>Lender UPI</span>
                        {p.lenderUpi === "NOT SET" ? (
                          <div style={{ marginTop: 2 }}><span style={S.badge("red")}>⚠ Not set</span></div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 12 }}>{p.lenderUpi}</span>
                            <button onClick={() => navigator.clipboard.writeText(p.lenderUpi)}
                              style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "0.5px solid #ccc", cursor: "pointer", background: "#f5f5f0", whiteSpace: "nowrap" }}>
                              Copy
                            </button>
                          </div>
                        )}
                      </div>
                      {p.borrowerComplaint && (
                        <div>
                          <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>Borrower UPI (For Refund)</span>
                          {p.borrowerUpi === "NOT SET" ? (
                            <div style={{ marginTop: 2 }}><span style={S.badge("red")}>⚠ Not set</span></div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                              <span style={{ fontFamily: "monospace", fontSize: 12 }}>{p.borrowerUpi}</span>
                              <button onClick={() => navigator.clipboard.writeText(p.borrowerUpi)}
                                style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "0.5px solid #ccc", cursor: "pointer", background: "#f5f5f0", whiteSpace: "nowrap" }}>
                                Copy
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={S.td}><strong>₹{p.totalCollected}</strong></td>
                    <td style={S.td}><span style={S.badge("green")}>₹{p.platformFee}</span></td>
                    <td style={{ ...S.td, fontWeight: 700, fontSize: 15, color: "#e94560" }}>₹{p.payLender}</td>
                    <td style={S.td}><span style={S.badge(stage.color)}>{stage.label}</span></td>
                    <td style={S.td}>
                      <span style={S.badge(p.borrowStatus === "returned" ? "green" : p.borrowStatus === "active" ? "orange" : "gray")}>
                        {p.borrowStatus === "returned" ? "✓ Returned" : p.borrowStatus === "active" ? "📦 Active" : p.borrowStatus === "selected" ? "💳 Paid" : p.borrowStatus}
                      </span>
                    </td>
                    <td style={S.td}>
                      {p.payoutStatus === "manual_pending" && (
                        <div>
                          {!p.borrowerReceived && !p.borrowerComplaint && (
                            <div style={{ fontSize: 11, color: "#854F0B", marginBottom: 6 }}>
                              ⚠️ Handover PIN not verified yet
                            </div>
                          )}
                          {p.borrowerReceived && (
                            <div style={{ fontSize: 11, color: "#3B6D11", marginBottom: 6 }}>
                              ✅ Handover Verified via PIN
                            </div>
                          )}

                          {p.borrowerComplaint && !p.borrowerReceived && (
                            <div style={{ background: '#FCEBEB', padding: '8px', borderRadius: 6, border: '1px solid #f5b7b1', marginBottom: 8 }}>
                              <div style={{ fontSize: 12, color: "#c0392b", fontWeight: 700, marginBottom: 6 }}>🚨 Borrower Complained!</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <button style={S.btn(false)} onClick={() => nudgeLender(p.requestId)}>
                                  {p.adminNudged ? 'Email Sent ✓' : '✉️ Inform Lender'}
                                </button>
                                <button style={S.btn(true)} onClick={() => refundBorrower(p.requestId, p.totalCollected)}>
                                  Refund Borrower
                                </button>
                              </div>
                            </div>
                          )}

                          <button style={S.btn(false)} disabled={marking === p.requestId || (p.borrowerComplaint && !p.borrowerReceived)}
                            onClick={() => markPaid(p.requestId, p.lenderName, p.lenderUpi, p.payLender)}>
                            {marking === p.requestId ? "Saving…" : "✓ Mark Paid to Lender"}
                          </button>
                        </div>
                      )}
                      {p.payoutStatus === "admin_paid" && (
                        <span style={{ fontSize: 12, color: "#854F0B" }}>Awaiting lender confirmation</span>
                      )}
                      {p.payoutStatus === "disputed" && (
                        <div>
                          <div style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, marginBottom: 4 }}>Lender didn't receive payment</div>
                          {p.adminUtr && (
                            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "6px", borderRadius: "6px", marginBottom: "8px" }}>
                              <div style={{ fontSize: 10, color: "#166534", textTransform: "uppercase", marginBottom: "2px" }}>Your Proof (UTR):</div>
                              <div style={{ fontSize: 13, color: "#15803d", fontWeight: "700", fontFamily: "monospace" }}>{p.adminUtr}</div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: "6px", flexDirection: "column" }}>
                            <button style={{ ...S.btn(false), fontSize: 11 }}
                              onClick={() => markPaid(p.requestId, p.lenderName, p.lenderUpi, p.payLender)}>
                              Re-send & Mark Paid
                            </button>
                            <button style={{ ...S.btn(true), fontSize: 11, background: "#1a1a1a" }}
                              onClick={() => dismissDispute(p.requestId)}>
                              Dismiss Dispute
                            </button>
                          </div>
                        </div>
                      )}
                      {p.payoutStatus === "done" && (
                        <span style={{ fontSize: 12, color: "#3B6D11" }}>✅ Confirmed by lender</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── ITEMS TAB ─────────────────────────────────────────────────────────────────
function ItemsTab({ apiFetch }) {
  const [items, setItems] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState("items") // "items" or "requests"
  const [searchQuery, setSearchQuery] = useState("")

  async function load() {
    setLoading(true)
    try {
      const [dataItems, dataReqs] = await Promise.all([
        apiFetch("/admin/items").catch(() => []),
        apiFetch("/admin/item-requests").catch(() => [])
      ])
      setItems(Array.isArray(dataItems) ? dataItems : [])
      setRequests(Array.isArray(dataReqs) ? dataReqs : [])
    } catch { setItems([]); setRequests([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteItem(id) {
    if (!window.confirm("Delete this item?")) return
    try {
      await apiFetch(`/admin/delete-item/${id}`, { method: "DELETE" })
      setItems(i => i.filter(x => x.id !== id))
    } catch (e) { alert("Failed: " + e.message) }
  }

  async function deleteRequest(id) {
    if (!window.confirm("Delete this borrow request?")) return
    try {
      await apiFetch(`/admin/delete-item-request/${id}`, { method: "DELETE" })
      setRequests(r => r.filter(x => x.id !== id))
    } catch (e) { alert("Failed: " + e.message) }
  }

  async function deleteUser(ownerId) {
    if (!window.confirm("Delete this USER and all their data?")) return
    try {
      await apiFetch(`/admin/delete-user/${ownerId}`, { method: "DELETE" })
      load()
    } catch (e) { alert("Failed: " + e.message) }
  }

  async function deleteAll() {
    if (!window.confirm("Delete ALL items? This cannot be undone.")) return
    try {
      await apiFetch("/admin/delete-all-items", { method: "DELETE" })
      setItems([])
    } catch (e) { alert("Failed: " + e.message) }
  }

  if (loading) return <p style={{ color: "#666", fontSize: 13 }}>Loading data…</p>

  const list = (view === "items" ? items : requests).filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.title || "").toLowerCase().includes(q) ||
      (item.id || "").toLowerCase().includes(q) ||
      (item.owner_id || item.requester_id || "").toLowerCase().includes(q) ||
      (item.owner_name || item.requester_name || "").toLowerCase().includes(q) ||
      (item.owner_email || item.requester_email || "").toLowerCase().includes(q) ||
      (item.status || "").toLowerCase().includes(q)
    );
  })

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 6, background: "#f5f5f0", padding: "4px", borderRadius: 8 }}>
          <button onClick={() => setView("items")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: view === "items" ? "#fff" : "transparent", color: view === "items" ? "#1a1a1a" : "#666", boxShadow: view === "items" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>Marketplace Items</button>
          <button onClick={() => setView("requests")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: view === "requests" ? "#fff" : "transparent", color: view === "requests" ? "#1a1a1a" : "#666", boxShadow: view === "requests" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>Borrow Requests</button>
        </div>
        
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <input 
            type="text" 
            placeholder="Search ID, Title, Status..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 20, border: "0.5px solid #ccc", fontSize: 12, width: 220 }}
          />
          <button onClick={load} style={{ ...S.btn(false) }}>↻ Refresh</button>
          {view === "items" && <button onClick={deleteAll} style={{ ...S.btn(true) }}>Delete ALL Items ⚠️</button>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>{list.length} records found</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f5f5f0" }}>
              <th style={S.th}>Title</th>
              <th style={S.th}>{view === "items" ? "Owner" : "Requester"}</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: "#999" }}>No {view} found</td></tr>
            ) : list.map(item => {
              const name = item.owner_name || item.requester_name || "Unknown User";
              const email = item.owner_email || item.requester_email || "No Email";
              return (
              <tr key={item.id}>
                <td style={S.td}>
                  <div style={{ fontWeight: 500 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: "#999" }}>{item.id.slice(0,8)}…</div>
                </td>
                <td style={S.td}>
                  <div style={{ fontWeight: 500 }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{email}</div>
                  <div style={{ fontSize: 10, color: "#999", fontFamily: "monospace", marginTop: 2 }}>{(item.owner_id || item.requester_id).slice(0,12)}…</div>
                </td>
                <td style={S.td}><span style={S.badge(item.status === "available" || item.status === "open" ? "green" : "orange")}>{item.status}</span></td>
                <td style={{ ...S.td, ...S.row }}>
                  {view === "items" ? (
                    <button onClick={() => deleteItem(item.id)} style={{ ...S.btn(false), background: "#333" }}>Delete Item</button>
                  ) : (
                    <button onClick={() => deleteRequest(item.id)} style={{ ...S.btn(false), background: "#333" }}>Delete Request</button>
                  )}
                  <button onClick={() => deleteUser(item.owner_id || item.requester_id)} style={S.btn(true)}>Delete User</button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── MAIN ADMIN ────────────────────────────────────────────────────────────────
export default function Admin({ goBack }) {
  const [tab, setTab] = useState("payouts")
  const { key, saveKey, apiFetch } = useAdmin()

  if (!key) return <AuthGate onAuth={saveKey} goBack={goBack} />

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ ...S.row, marginBottom: 20, justifyContent: "space-between" }}>
        <div>
          <div style={S.h1}>⚙️ CampusShare Admin</div>
          <div style={{ fontSize: 12, color: "#999" }}>Manage payouts, items, and users</div>
        </div>
        <button onClick={goBack} style={{ ...S.btn(false), background: "#eee", color: "#333" }}>← Back to App</button>
      </div>

      {/* Tabs */}
      <div style={{ ...S.row, marginBottom: 20 }}>
        <button style={S.tab(tab === "payouts")} onClick={() => setTab("payouts")}>💸 Pending Payouts</button>
        <button style={S.tab(tab === "items")}   onClick={() => setTab("items")}>📦 Items</button>
      </div>

      {/* Tab content */}
      <div style={S.card}>
        <div style={S.h2}>{tab === "payouts" ? "💸 Pending Lender Payouts" : "📦 All Items"}</div>
        {tab === "payouts" && <PayoutsTab apiFetch={apiFetch} />}
        {tab === "items"   && <ItemsTab   apiFetch={apiFetch} />}
      </div>
    </div>
  )
}
