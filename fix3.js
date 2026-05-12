const fs = require('fs');

let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Pass myRequests to ActivityModal
const target1 = `          <ActivityModal
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
          />`;

const replacement1 = `          <ActivityModal
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
            myRequests={myRequests}
          />`;

content = content.replace(target1, replacement1);

// 2. Modify ActivityModal definition to accept myRequests
const target2 = `function ActivityModal({ open, onClose, refresh, showToast, defaultTab, targetId, onClearTarget, newRequestCount = 0, myOffersCount = 0, markRequestsSeen, unreadMap = {}, onMarkRead, lifecycleMap, openJourney, closeJourney, setChatRequest }) {`;

const replacement2 = `function ActivityModal({ open, onClose, refresh, showToast, defaultTab, targetId, onClearTarget, newRequestCount = 0, myOffersCount = 0, markRequestsSeen, unreadMap = {}, onMarkRead, lifecycleMap, openJourney, closeJourney, setChatRequest, myRequests = [] }) {`;

content = content.replace(target2, replacement2);

// 3. Remove polling from ActivityModal and add useEffect to sync with myRequests
const target3 = `  async function fetchReqs(silent = false) {
    if (!silent) setLoading(true)
    const r = await api.getMyRequests()
    if (!silent) setLoading(false)
    if (!r.error) mergeReqs(r.requests || [])
  }

  // Focus tracking to prevent polling while typing
  const pausePollRef = useRef(false)
  useEffect(() => {
    if (!open) return
    function onFocusIn(e) { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') pausePollRef.current = true }
    function onFocusOut(e) { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') setTimeout(() => { pausePollRef.current = false }, 2000) }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => { document.removeEventListener('focusin', onFocusIn); document.removeEventListener('focusout', onFocusOut) }
  }, [open])

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
    // Interval raised to 60s - socket events handle real-time updates.
    pollRef.current = setInterval(() => {
      if (!pausePollRef.current && document.visibilityState === 'visible') fetchReqs(true)
    }, 60000)
    return () => clearInterval(pollRef.current)
  }, [open]) // eslint-disable-line

  async function reload() { await fetchReqs(true); refresh() }`;

const replacement3 = `  // Sync with App.jsx myRequests (real-time updates via socket)
  useEffect(() => {
    if (open && myRequests) {
      mergeReqs(myRequests);
      setLoading(false);
    }
  }, [open, myRequests]);

  useEffect(() => {
    if (open && targetId) {
      setTimeout(() => {
        const el = document.getElementById(targetId)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (onClearTarget) onClearTarget()
      }, 400)
    }
  }, [open, targetId, onClearTarget])

  async function reload() { refresh() }`;

content = content.replace(target3, replacement3);

fs.writeFileSync('frontend/src/App.jsx', content);
console.log('Replaced ActivityModal polling with prop sync successfully');
