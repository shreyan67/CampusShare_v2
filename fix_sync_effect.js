const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Add the sync useEffect after the mount load useEffect
const syncEffect = `  useEffect(() => {
    load()
    const unsub = socketClient.on('refresh:item-requests', () => load())
    return () => unsub()
  }, []) // eslint-disable-line

  // Keep inline borrow lifecycle in sync with activeHandovers instantly
  useEffect(() => {
    setBorrowReqs(prev => {
      let changed = false;
      const next = { ...prev };
      for (const reqId in next) {
        const brId = next[reqId]?.id;
        if (!brId) continue;
        const fresh = activeHandovers.find(x => x.id === brId) || historyHandovers.find(x => x.id === brId);
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(next[reqId])) {
          next[reqId] = fresh;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeHandovers, historyHandovers]);`;

const target = /  useEffect\(\(\) => \{\s+load\(\)\s+const unsub = socketClient\.on\('refresh:item-requests', \(\) => load\(\)\)\s+return \(\) => unsub\(\)\s+\}, \[\]\) \/\/ eslint-disable-line/;

c = c.replace(target, syncEffect);

fs.writeFileSync('frontend/src/App.jsx', c);
console.log('Sync useEffect added');
