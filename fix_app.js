const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const target1 = `  useEffect(() => {
    if (!user) return
    api.getMe().then(r => {
      if (r?.user) { setUser(r.user); api.persistUser(r.user) }
    })`;

const replacement1 = `  useEffect(() => {
    if (!user) return
    api.getMe().then(r => {
      if (r?.user) { setUser(r.user); api.persistUser(r.user) }
    })
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      socketClient.disconnect()
      return
    }`;

code = code.replace(target1, replacement1);

const target2 = `      // Server tells us item-requests changed (new offer received etc.)
      socketClient.on('refresh:item-requests', () => {
        setItemReqTick(t => t + 1)
        // This triggers the existing notification check loop instantly
        api.getItemRequests('').then(r => {`;

const replacement2 = `      // Server tells us item-requests changed (new offer received etc.)
      socketClient.on('refresh:item-requests', () => {
        setItemReqTick(t => t + 1)
        
        // Fetch myRequests as well in case an offer was accepted and we need the new active handover
        api.getMyRequests().then(r => {
          if (r?.requests) { setMyRequests(r.requests); myRequestsRef.current = r.requests }
        })

        // This triggers the existing notification check loop instantly
        api.getItemRequests('').then(r => {`;

code = code.replace(target2, replacement2);

const target3 = `    return () => {
      unsubs.forEach(fn => fn())
      socketClient.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, []) // eslint-disable-line`;

const replacement3 = `    return () => {
      unsubs.forEach(fn => fn())
      socketClient.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user?.id]) // eslint-disable-line`;

code = code.replace(target3, replacement3);

fs.writeFileSync('frontend/src/App.jsx', code);
console.log('App.jsx fixed!');
