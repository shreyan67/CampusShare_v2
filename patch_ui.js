const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'App.jsx');
let code = fs.readFileSync(filePath, 'utf8');
// Normalize to \n for all replacements, then restore \r\n at the end
const hasCRLF = code.includes('\r\n');
if (hasCRLF) code = code.replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: Replace Approve/Decline section to block when sibling is selected
// ─────────────────────────────────────────────────────────────────────────────
const oldApprove = `          {/* Approve/Decline */}
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
          )}`;

const newApprove = `          {/* Approve/Decline */}
          {!isBorrowing && r.status === 'pending' && (
            <>
              {isPaid && !user?.upi_id && (
                <InfoBanner type="error">⚠️ Add UPI ID in Profile tab before approving paid requests.</InfoBanner>
              )}
              {itemHasSelectedBorrower ? (
                <InfoBanner type="warn">⏸️ You already have an approved borrower for this item. Dismiss them first to approve someone else.</InfoBanner>
              ) : (
                <button className="btn-press" style={{ ...btn(true, true) }} onClick={async () => {
                  if (isPaid && !user?.upi_id) { showToast('Add UPI ID in Profile first.'); return }
                  try {
                    const res = await api.approveRequest(r.id)
                    if (res?.error) { showToast(res.error); return }
                    showToast('Approved!')
                    await reload()
                  } catch (err) { console.error(err); showToast('Approval failed') }
                }}>Approve</button>
              )}
              <button className="btn-press" style={btn(false, true)} onClick={async () => { await act(api.declineRequest, r.id); showToast('Declined.') }}>Decline</button>
            </>
          )}`;

if (code.includes(oldApprove)) {
  code = code.replace(oldApprove, newApprove);
  console.log('✅ Approve/Decline section patched');
} else {
  // Diagnostic: find each line
  oldApprove.split('\n').forEach((l, i) => {
    if (!code.includes(l)) console.log(`  ❌ Line ${i}: ${JSON.stringify(l)}`);
  });
  console.error('❌ Could not find Approve/Decline section');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: Update Dismiss Borrower button — extend to 'active' state for free items
// ─────────────────────────────────────────────────────────────────────────────
const oldDismiss = `          {/* Dismiss Selected Borrower (Lender) — only before payment */}
          {!isBorrowing && r.status === 'selected' && (!isPaid || !r.payment_confirmed) && (
            <button className="btn-press" style={{ ...btn(false, true), color: T.error, border: \`1px solid \${T.error}44\`, marginTop: 8, width: '100%' }} onClick={async () => {
              if (!window.confirm('Dismiss this borrower? Other pending requests will become approvable again.')) return
              const res = await act(api.declineRequest, r.id)
              if (res && !res.error) showToast('Borrower dismissed. Other requests are now approvable.')
            }}>Dismiss Borrower</button>
          )}`;

const newDismiss = `          {/* Dismiss Borrower (Lender):
               Free items (lend/donate): dismissable at selected OR active stage (before item physically given)
               Paid items (rent/sell): dismissable only at selected stage before payment confirmed */}
          {!isBorrowing && (
            (isPaid && r.status === 'selected' && !r.payment_confirmed) ||
            (!isPaid && ['selected', 'active'].includes(r.status) && !r.item_given)
          ) && (
            <button className="btn-press" style={{ ...btn(false, true), color: T.error, border: \`1px solid \${T.error}44\`, marginTop: 8, width: '100%' }} onClick={async () => {
              if (!window.confirm('Dismiss this borrower? This will move the transaction to history for both of you, and other pending requests will become approvable again.')) return
              const res = await act(api.declineRequest, r.id)
              if (res && !res.error) showToast('Borrower dismissed. Other requests are now approvable.')
            }}>Dismiss Borrower</button>
          )}`;

if (code.includes(oldDismiss)) {
  code = code.replace(oldDismiss, newDismiss);
  console.log('✅ Dismiss Borrower button patched');
} else {
  oldDismiss.split('\n').forEach((l, i) => {
    if (!code.includes(l)) console.log(`  ❌ Line ${i}: ${JSON.stringify(l)}`);
  });
  console.error('❌ Could not find Dismiss Borrower button');
  process.exit(1);
}

// Restore CRLF
if (hasCRLF) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, code);
console.log('\n✅ All patches applied.');
