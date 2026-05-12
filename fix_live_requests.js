const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Add expandedRefIRS and update it in toggleExpand
const expRefSearch = /const reqsRefIRS = useRef\(\[\]\)\s+\/\/ stable ref to avoid re-mounting on poll/;
const expRefReplace = `const reqsRefIRS = useRef([])  // stable ref to avoid re-mounting on poll
  const expandedRefIRS = useRef(null)`;
c = c.replace(expRefSearch, expRefReplace);

const setExpSearch = /setExpanded\(reqId\)/g;
const setExpReplace = `setExpanded(reqId); expandedRefIRS.current = reqId`;
c = c.replace(setExpSearch, setExpReplace);

const clearExpSearch = /setExpanded\(null\)/g;
const clearExpReplace = `setExpanded(null); expandedRefIRS.current = null`;
c = c.replace(clearExpSearch, clearExpReplace);

// 2. Update load() to refresh offers if card is expanded
const loadOffersSearch = /if \(prev !== next\) \{ reqsRefIRS\.current = newReqs; setRequests\(newReqs\) \}\s+setLoading\(false\)/;
const loadOffersReplace = `if (prev !== next) { reqsRefIRS.current = newReqs; setRequests(newReqs) }
    // Refresh offers if card expanded
    if (expandedRefIRS.current) loadOffers(expandedRefIRS.current)
    setLoading(false)`;
c = c.replace(loadOffersSearch, loadOffersReplace);

// 3. Fix App.jsx notification badge logic (n + 0 bug)
const badgeSearch = /\/\/ Update unread badge\s+const myOffers = r\.requests\.filter\(req => req\.requester_id !== user\.id\)\s+if \(myOffers\.length > 0\) setNewRequestCount\(n => n \+ 0\) \/\/ triggers re-render/;
const badgeReplace = `// Update unread badge
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
            setMyOffersCount(myTotalOffers)`;

c = c.replace(badgeSearch, badgeReplace);

fs.writeFileSync('frontend/src/App.jsx', c);
console.log('Requests live update fixes applied');
