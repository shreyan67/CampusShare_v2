import { useEffect, useState } from "react";

const BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:4000"
  : "https://campusshare-v2-backend.onrender.com";

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
function AuthGate({ onAuth }) {
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
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>🔐 Admin Login</div>
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
  const [filter, setFilter]   = useState("all") // all | pending | disputed | done

  async function load() {
    setLoading(true)
    setErr("")
    try {
      const data = await apiFetch("/api/payments/pending-payouts")
      // Sort: disputed first, then by payout stage order, then newest first
      const sorted = (data.pendingPayouts || []).sort((a, b) => {
        const ao = PAYOUT_STAGES[a.payoutStatus]?.order ?? 9
        const bo = PAYOUT_STAGES[b.payoutStatus]?.order ?? 9
        return ao - bo
      })
      setPayouts(sorted)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function markPaid(requestId, lenderName, lenderUpi, payLender) {
    if (!window.confirm(`Confirm: You've sent ₹${payLender} to ${lenderName} (${lenderUpi})?`)) return
    setMarking(requestId)
    try {
      await apiFetch("/api/payments/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      })
      // Update in-place rather than removing — now shows as admin_paid
      setPayouts(ps => ps.map(p =>
        p.requestId === requestId ? { ...p, payoutStatus: "admin_paid" } : p
      ))
    } catch (e) {
      alert("Failed: " + e.message)
    } finally {
      setMarking(null)
    }
  }

  const pendingCount  = payouts.filter(p => p.payoutStatus === "manual_pending").length
  const disputedCount = payouts.filter(p => p.payoutStatus === "disputed").length
  const pendingOwed   = payouts.filter(p => p.payoutStatus === "manual_pending").reduce((s, p) => s + p.payLender, 0).toFixed(2)
  const totalEarned   = payouts.reduce((s, p) => s + p.platformFee, 0).toFixed(2)

  const filtered = filter === "all"      ? payouts
                 : filter === "pending"  ? payouts.filter(p => ["manual_pending","admin_paid"].includes(p.payoutStatus))
                 : filter === "disputed" ? payouts.filter(p => p.payoutStatus === "disputed")
                 : payouts.filter(p => p.payoutStatus === "done")

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
        {[["all","All"], ["pending","Needs Action"], ["disputed","Disputed"], ["done","Confirmed"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: "4px 12px", borderRadius: 20, border: "0.5px solid #ccc", cursor: "pointer", fontSize: 12,
              background: filter === v ? "#1a1a1a" : "#f5f5f0", color: filter === v ? "#fff" : "#333", fontWeight: filter === v ? 600 : 400 }}>
            {l}{v === "disputed" && disputedCount > 0 ? ` (${disputedCount})` : ""}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 20, border: "0.5px solid #ccc", cursor: "pointer", fontSize: 12, background: "#f5f5f0" }}>↻ Refresh</button>
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
                <th style={S.th}>Lender</th>
                <th style={S.th}>Lender UPI</th>
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
                      <div style={{ fontWeight: 500 }}>{p.lenderName}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{p.lenderEmail}</div>
                    </td>
                    <td style={S.td}>
                      {p.lenderUpi === "NOT SET" ? (
                        <span style={S.badge("red")}>⚠ Not set</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12 }}>{p.lenderUpi}</span>
                          <button onClick={() => navigator.clipboard.writeText(p.lenderUpi)}
                            style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "0.5px solid #ccc", cursor: "pointer", background: "#f5f5f0", whiteSpace: "nowrap" }}>
                            Copy
                          </button>
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
                          {!p.borrowerReceived && (
                            <div style={{ fontSize: 11, color: "#854F0B", marginBottom: 6 }}>
                              ⚠️ Borrower hasn't confirmed receipt yet
                            </div>
                          )}
                          {p.borrowerReceived && (
                            <div style={{ fontSize: 11, color: "#3B6D11", marginBottom: 6 }}>
                              ✅ Borrower confirmed receipt
                            </div>
                          )}
                          <button style={S.btn(false)} disabled={marking === p.requestId}
                            onClick={() => markPaid(p.requestId, p.lenderName, p.lenderUpi, p.payLender)}>
                            {marking === p.requestId ? "Saving…" : "✓ Mark Paid"}
                          </button>
                        </div>
                      )}
                      {p.payoutStatus === "admin_paid" && (
                        <span style={{ fontSize: 12, color: "#854F0B" }}>Awaiting lender confirmation</span>
                      )}
                      {p.payoutStatus === "disputed" && (
                        <div>
                          <div style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, marginBottom: 4 }}>Lender didn't receive payment</div>
                          <button style={{ ...S.btn(false), fontSize: 11 }}
                            onClick={() => markPaid(p.requestId, p.lenderName, p.lenderUpi, p.payLender)}>
                            Re-send & Mark Paid
                          </button>
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
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch("/admin/items")
      setItems(Array.isArray(data) ? data : [])
    } catch { setItems([]) }
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

  if (loading) return <p style={{ color: "#666", fontSize: 13 }}>Loading items…</p>

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 16 }}>
        <button onClick={load} style={{ ...S.btn(false) }}>↻ Refresh</button>
        <button onClick={deleteAll} style={{ ...S.btn(true) }}>Delete ALL Items ⚠️</button>
        <span style={{ fontSize: 12, color: "#666" }}>{items.length} items total</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f5f5f0" }}>
              <th style={S.th}>Title</th>
              <th style={S.th}>Owner ID</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: "#999" }}>No items</td></tr>
            ) : items.map(item => (
              <tr key={item.id}>
                <td style={S.td}>
                  <div style={{ fontWeight: 500 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: "#999" }}>{item.id.slice(0,8)}…</div>
                </td>
                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>{item.owner_id.slice(0,12)}…</td>
                <td style={S.td}><span style={S.badge(item.status === "available" ? "green" : "orange")}>{item.status}</span></td>
                <td style={{ ...S.td, ...S.row }}>
                  <button onClick={() => deleteItem(item.id)} style={{ ...S.btn(false), background: "#333" }}>Delete Item</button>
                  <button onClick={() => deleteUser(item.owner_id)} style={S.btn(true)}>Delete User</button>
                </td>
              </tr>
            ))}
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

  if (!key) return <AuthGate onAuth={saveKey} />

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
