// Small server that replaces Vercel: it serves the static WebOS from code/ and
// runs the three serverless functions (proxy, search, run) as normal routes.
// Their (req, res) signatures are already Express-compatible.

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import proxyHandler from './code/api/proxy.js';
import searchHandler from './code/api/search.js';
import runHandler from './code/api/run.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, 'code');
const PORT = process.env.PORT || 3000;

const app = express();
app.disable('x-powered-by');

// run.js reads a JSON body; proxy/search only use the query string
app.use(express.json({ limit: '6mb' }));

// the serverless functions, mounted verbatim (GET, POST and OPTIONS all go through)
app.all('/api/proxy', (req, res) => proxyHandler(req, res));
app.all('/api/search', (req, res) => searchHandler(req, res));
app.all('/api/run', (req, res) => runHandler(req, res));

// simple liveness endpoint for kubernetes
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// everything else is a static file under code/ (index.html is served for "/")
app.use(express.static(webRoot, { extensions: ['html'] }));

// unknown paths: 404 (this is a file-based app, not a SPA)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.status(404).send('not found');
});

app.listen(PORT, () => {
  console.log(`have a life webos listening on :${PORT}`);
});
