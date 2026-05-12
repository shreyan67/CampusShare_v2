const fs = require('fs');

let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const target = `  useEffect(() => {
    load()
    const unsub = socketClient.on('refresh:item-requests', load)
    return () => unsub()
  }, []) // eslint-disable-line`;

const replacement = `  useEffect(() => {
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
        const brId = next[reqId].id;
        const fresh = activeHandovers.find(x => x.id === brId) || historyHandovers.find(x => x.id === brId);
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(next[reqId])) {
          next[reqId] = fresh;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeHandovers, historyHandovers]);`;

content = content.replace(target, replacement);

const target2 = `  // Load borrow request for an accepted offer \u2014 used to show inline lifecycle
  async function loadBorrowReq(reqId, borrowRequestId) {
    if (!borrowRequestId) return
    const r = await api.getMyRequests()
    if (!r?.error) {
      const br = (r.requests || []).find(x => x.id === borrowRequestId)
      if (br) setBorrowReqs(prev => ({ ...prev, [reqId]: br }))
    }
  }`;

const replacement2 = `  // Load borrow request for an accepted offer - used to show inline lifecycle
  async function loadBorrowReq(reqId, borrowRequestId) {
    if (!borrowRequestId) return
    const br = activeHandovers.find(x => x.id === borrowRequestId) || historyHandovers.find(x => x.id === borrowRequestId)
    if (br) {
      setBorrowReqs(prev => ({ ...prev, [reqId]: br }))
    } else {
      const r = await api.getMyRequests()
      if (!r?.error) {
        const freshBr = (r.requests || []).find(x => x.id === borrowRequestId)
        if (freshBr) setBorrowReqs(prev => ({ ...prev, [reqId]: freshBr }))
      }
    }
  }`;

// Use regex for the second part because of the weird em-dash
content = content.replace(/async function loadBorrowReq\(reqId, borrowRequestId\) \{[\s\S]*?\}\s*\}/, replacement2.substring(replacement2.indexOf('async function')));

fs.writeFileSync('frontend/src/App.jsx', content);
console.log('Replaced successfully');
