const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Add itemReqTick state in App.jsx
const tickStateSearch = /const \[tick, setTick\] = useState\(0\)/;
const tickStateReplace = `const [tick, setTick] = useState(0)
  const [itemReqTick, setItemReqTick] = useState(0)`;
c = c.replace(tickStateSearch, tickStateReplace);

// 2. Increment itemReqTick in socket listener
const socketListenerSearch = /socketClient\.on\('refresh:item-requests', \(\) => \{\s+\/\/ This triggers the existing notification check loop instantly\s+api\.getItemRequests\(''\)\.then\(r => \{/;
const socketListenerReplace = `socketClient.on('refresh:item-requests', () => {
        setItemReqTick(t => t + 1)
        // This triggers the existing notification check loop instantly
        api.getItemRequests('').then(r => {`;
c = c.replace(socketListenerSearch, socketListenerReplace);

// 3. Pass itemReqTick to RequestsModal and ItemRequestsSection
const reqModalPropSearch = /<RequestsModal\s+open=\{requestOpen\}/;
const reqModalPropReplace = `<RequestsModal
            itemReqTick={itemReqTick}
            open={requestOpen}`;
c = c.replace(reqModalPropSearch, reqModalPropReplace);

const reqModalDefSearch = /function RequestsModal\(\{ open, onClose, onSuccess, showToast, editData = null, onEditReq, initialTab = 'browse', markRequestsSeen, reloadActivity, activeHandovers = \[\], historyHandovers = \[\], unreadMap = \{\}, openJourney, closeJourney, lifecycleMap, setChatRequest, targetId, onClearTarget, hasForceClosedSlot \}\) \{/;
const reqModalDefReplace = `function RequestsModal({ itemReqTick, open, onClose, onSuccess, showToast, editData = null, onEditReq, initialTab = 'browse', markRequestsSeen, reloadActivity, activeHandovers = [], historyHandovers = [], unreadMap = {}, openJourney, closeJourney, lifecycleMap, setChatRequest, targetId, onClearTarget, hasForceClosedSlot }) {`;
c = c.replace(reqModalDefSearch, reqModalDefReplace);

const irsPropSearch = /<ItemRequestsSection\s+showToast=\{showToast\}/;
const irsPropReplace = `<ItemRequestsSection
            itemReqTick={itemReqTick}
            showToast={showToast}`;
c = c.replace(irsPropSearch, irsPropReplace);

const irsDefSearch = /function ItemRequestsSection\(\{ showToast, currentUserId, reload: reloadActivity, onMarkSeen, onEdit, activeHandovers = \[\], historyHandovers = \[\], openJourney, closeJourney, lifecycleMap = \{\}, setChatRequest, unreadMap = \{\}, user \}\) \{/;
const irsDefReplace = `function ItemRequestsSection({ itemReqTick, showToast, currentUserId, reload: reloadActivity, onMarkSeen, onEdit, activeHandovers = [], historyHandovers = [], openJourney, closeJourney, lifecycleMap = {}, setChatRequest, unreadMap = {}, user }) {`;
c = c.replace(irsDefSearch, irsDefReplace);

// 4. Update ItemRequestsSection to react to itemReqTick
const irsEffectSearch = /useEffect\(\(\) => \{\s+load\(\)\s+const unsub = socketClient\.on\('refresh:item-requests', \(\) => load\(\)\)\s+return \(\) => unsub\(\)\s+\}, \[\]\) \/\/ eslint-disable-line/;
const irsEffectReplace = `useEffect(() => {
    load()
  }, [itemReqTick]) // eslint-disable-line`;
c = c.replace(irsEffectSearch, irsEffectReplace);

fs.writeFileSync('frontend/src/App.jsx', c);
console.log('ItemRequestsSection wired to App level tick successfully');
