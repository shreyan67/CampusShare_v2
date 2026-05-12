const fs = require('fs');
let c = fs.readFileSync('frontend/src/api.js', 'utf8');

const target = /let fetchOpts = \{ method, headers \}/;
const replacement = `let fetchOpts = { method, headers, cache: 'no-store' }`;

c = c.replace(target, replacement);

fs.writeFileSync('frontend/src/api.js', c);
console.log('fetchOpts updated with cache: no-store');
