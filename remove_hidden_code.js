const fs = require('fs');

function removeHiddenCode() {
    const input = fs.readFileSync(0, 'utf8'); // Legge dallo standard input
    const output = input.replace(/\/\/ START_HIDE[\s\S]*?\/\/ END_HIDE/g, '');
    process.stdout.write(output); // Scrive sullo standard output
}

removeHiddenCode();
