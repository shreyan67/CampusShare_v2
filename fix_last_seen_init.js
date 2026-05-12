const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const target = /const lastSeenRequestRef = useRef\(new Date\(\)\.toISOString\(\)\)/;
const replacement = `const lastSeenRequestRef = useRef(localStorage.getItem('cs_last_seen_req') || new Date().toISOString())`;

c = c.replace(target, replacement);

fs.writeFileSync('frontend/src/App.jsx', c);
console.log('lastSeenRequestRef initialization fixed');
