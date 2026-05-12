const fs = require('fs');

let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const target = `      // Server tells us item-requests changed (new offer received etc.)
      socketClient.on('refresh:item-requests', () => {
        // This triggers the existing notification check loop instantly
        api.getItemRequests('').then(r => {
          if (r?.requests) {
            // Update unread badge
            const myOffers = r.requests.filter(req => req.requester_id !== user.id)
            if (myOffers.length > 0) setNewRequestCount(n => n + 0) // triggers re-render
          }
        })
      }),`;

const replacement = `      // Server tells us item-requests changed (new offer received etc.)
      socketClient.on('refresh:item-requests', () => {
        api.getItemRequests('').then(r => {
          if (r?.requests) {
            const lastSeen = lastSeenRequestRef.current
            const newOnes = r.requests.filter(req =>
              req.requester_id !== user.id &&
              new Date(req.created_at).getTime() > new Date(lastSeen).getTime()
            )
            if (newOnes.length > 0) {
              setNewRequestCount(n => n + newOnes.length)
              const newest = newOnes.reduce((a, b) => a.created_at > b.created_at ? a : b)
              lastSeenRequestRef.current = newest.created_at
              localStorage.setItem('cs_last_seen_req', newest.created_at)
              showToast(\`📣 \${newOnes[0].requester_name} needs: \${newOnes[0].title}\`, true)
            }
            const myTotalOffers = r.requests
              .filter(req => req.requester_id === user.id)
              .reduce((sum, req) => sum + parseInt(req.offer_count || 0), 0)
            if (myTotalOffers > prevMyTotalOffersRef.current) {
              showToast(\`📣 You received a new offer for your item request!\`, true)
            }
            prevMyTotalOffersRef.current = myTotalOffers
            setMyOffersCount(myTotalOffers)
          }
        })
      }),`;

content = content.replace(target, replacement);
fs.writeFileSync('frontend/src/App.jsx', content);
console.log('Replaced item-requests socket logic successfully');
