const url = process.argv[2]
if (!url) { console.error('Usage: npm run deploy:check -- https://your-domain'); process.exitCode=1 }
else {
  const base = new URL(url)
  if (base.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('Use HTTPS for a public deployment.')
  for (const [path, expected] of [['/api/health',200],['/',200],['/sign-in',200],['/calendar',200],['/api/auth/me',401],['/%ZZ',400],['/missing-smoke-asset.js',404]]) {
    try {
      const response = await fetch(new URL(path,base),{redirect:'manual',signal:AbortSignal.timeout(10000)})
      if(response.status!==expected) throw new Error(`Expected ${expected}, received ${response.status}`)
      if(path==='/api/health' && (await response.json()).status!=='ok') throw new Error('Health check failed')
      console.log(`PASS ${path}`)
    } catch(error) { console.error(`FAIL ${path}: ${error.message}`); process.exitCode=1 }
  }
}
