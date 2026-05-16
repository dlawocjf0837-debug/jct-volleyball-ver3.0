const fs = require('fs');
const path = process.argv[2];
let s = fs.readFileSync(path, 'utf8');
s = s.replace(/motion\.div/g, 'div');
s = s.replace(
    /return typeof document !== 'undefined' \? ReactDOM\.createPortal\(modal\.replace[^;]+;/,
    'return typeof document !== \'undefined\' ? ReactDOM.createPortal(modal, document.body) : null;'
);
fs.writeFileSync(path, s, 'utf8');
console.log('fixed', path);
