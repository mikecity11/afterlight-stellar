import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const handlers = Object.fromEntries(await Promise.all(['setup', 'run', 'proxy'].map(async name => [name, (await import(`./api/${name}.mjs`)).default])));
http.createServer(async (req, res) => {
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 24000) return res.status(413).json({ error: 'Request too large.' }); }
      req.body = raw ? JSON.parse(raw) : {};
      const handler = handlers[url.pathname.slice(5)];
      return handler ? await handler(req, res) : res.status(404).json({ error: 'Not found.' });
    }
    const file = ['/','/lab','/docs','/about'].includes(url.pathname) ? 'index.html' : url.pathname.slice(1);
    if (!['index.html','app.js','style.css'].includes(file)) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(await readFile(path.join(import.meta.dirname, 'public', file)));
  } catch { res.status(500).json({ error: 'Request failed.' }); }
}).listen(process.env.PORT || 3000, () => console.log('Afterlight running on http://localhost:' + (process.env.PORT || 3000)));
