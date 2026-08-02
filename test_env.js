console.log('Env variables starting with VITE, DATABASE, PG, SUPABASE, or containing password:');
for (const key of Object.keys(process.env)) {
  if (key.startsWith('VITE') || key.startsWith('DATABASE') || key.startsWith('PG') || key.startsWith('SUPABASE') || key.toLowerCase().includes('pass') || key.toLowerCase().includes('key')) {
    console.log(`${key}: ${process.env[key] ? (key.toLowerCase().includes('pass') || key.toLowerCase().includes('key') || key.toLowerCase().includes('url') ? '[hidden]' : process.env[key]) : 'empty'}`);
  }
}
