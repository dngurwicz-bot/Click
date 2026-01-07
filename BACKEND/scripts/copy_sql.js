const fs = require('fs');
const { exec } = require('child_process');

// Read SQL file
const sql = fs.readFileSync('/home/codespace/Click-2/BACKEND/scripts/01_organizational_structure.sql', 'utf8');

// Copy to clipboard using xclip or pbcopy
const copyCommand = process.platform === 'darwin' ? 'pbcopy' : 'xclip -selection clipboard';

exec(`echo "${sql.replace(/"/g, '\\"')}" | ${copyCommand}`, (error) => {
    if (error) {
        console.error('Error copying to clipboard:', error);
        // Fallback: just print it
        console.log(sql);
    } else {
        console.log('✅ SQL copied to clipboard!');
    }
});
