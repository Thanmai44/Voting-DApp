const fs = require('fs');
try {
    const content = fs.readFileSync('deploy_output.txt', 'ucs2'); // UTF-16LE is ucs2 in Node
    console.log(content);
} catch (e) {
    const content = fs.readFileSync('deploy_output.txt', 'utf8');
    console.log(content);
}
