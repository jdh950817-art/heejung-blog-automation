const fs = require('fs');

let config = fs.readFileSync('js/config.template.js', 'utf8');
config = config.replace('{{SUPABASE_URL}}', process.env.SUPABASE_URL || '');
config = config.replace('{{SUPABASE_KEY}}', process.env.SUPABASE_KEY || '');
config = config.replace('{{GEMINI_KEY}}', process.env.GEMINI_KEY || '');
fs.writeFileSync('js/config.js', config);
console.log('✅ config.js generated from environment variables');
