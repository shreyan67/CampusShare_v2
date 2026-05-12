const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Add searchRefIRS and update it in setSearch
const searchRefSearch = /const \[search, setSearch\] = useState\(''\)/;
const searchRefReplace = `const [search, setSearch] = useState('')
  const searchRefIRS = useRef('')`;
c = c.replace(searchRefSearch, searchRefReplace);

const setSRSearch = /onChange=\{e => setSearch\(e\.target\.value\)\}/;
const setSRReplace = `onChange={e => { setSearch(e.target.value); searchRefIRS.current = e.target.value }}`;
c = c.replace(setSRSearch, setSRReplace);

// 2. Update load() to use searchRefIRS.current if q is not provided
const loadSearch = /async function load\(q = search\) \{/;
const loadReplace = `async function load(q = searchRefIRS.current) {`;
c = c.replace(loadSearch, loadReplace);

fs.writeFileSync('frontend/src/App.jsx', c);
console.log('Search closure bug fixed');
