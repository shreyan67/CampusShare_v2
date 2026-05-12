const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Simplify sync useEffect in ItemRequestsSection
const syncEffectSearch = /if \(fresh && JSON\.stringify\(fresh\) !== JSON\.stringify\(next\[reqId\]\)\) \{/;
const syncEffectReplace = `if (fresh) {`; // Always take the fresh one from props
c = c.replace(syncEffectSearch, syncEffectReplace);

// 2. Ensure load() is called on mount regardless of itemReqTick
const irsEffectSearch = /useEffect\(\(\) => \{\s+load\(\)\s+\}, \[itemReqTick\]\) \/\/ eslint-disable-line/;
const irsEffectReplace = `useEffect(() => {
    load()
    // Also listen locally just in case
    const unsub = socketClient.on('refresh:item-requests', () => load())
    return () => unsub()
  }, [itemReqTick]) // eslint-disable-line`;
c = c.replace(irsEffectSearch, irsEffectReplace);

// 3. Fix potential issue with refresh:requests not triggering enough
const reqsListenerSearch = /socketClient\.on\('refresh:requests', \(\) => \{\s+api\.getMyRequests\(\)\.then\(r => \{/;
const reqsListenerReplace = `socketClient.on('refresh:requests', () => {
        setTick(t => t + 1) // Force a global re-render
        api.getMyRequests().then(r => {`;
c = c.replace(reqsListenerSearch, reqsListenerReplace);

fs.writeFileSync('frontend/src/App.jsx', c);
console.log('App.jsx synchronization refined');
