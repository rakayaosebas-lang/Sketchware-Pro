'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { generate, MODEL } = require('./src/ai');
const { TASKS } = require('./src/prompts');
const { UsageLimiter } = require('./src/limits');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const FREE_DAILY_LIMIT = Number(process.env.FREE_DAILY_LIMIT) || 15;
const PREMIUM_CODES = new Set(
  (process.env.PREMIUM_CODES || '').split(',').map((s) => s.trim()).filter(Boolean),
);

const limiter = new UsageLimiter(FREE_DAILY_LIMIT);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': MIME['.json'] });
  res.end(JSON.stringify(data));
}

function readBody(req, maxBytes = 20_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Solicitud demasiado grande'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function clientId(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local').split(',')[0].trim();
}

async function handleGenerate(req, res) {
  const body = await readBody(req);
  if (!TASKS[body.task]) return sendJson(res, 400, { error: 'Tarea no válida' });

  const premium = PREMIUM_CODES.has(String(req.headers['x-premium-code'] || ''));
  const id = clientId(req);
  if (!premium && !limiter.tryConsume(id)) {
    return sendJson(res, 429, {
      error: `Llegaste al límite gratis de ${FREE_DAILY_LIMIT} mensajes por día. Pásate a Premium para seguir vendiendo sin límites.`,
      limitReached: true,
    });
  }

  try {
    const result = await generate({ task: body.task, business: body.business, input: body.input });
    sendJson(res, 200, { ...result, remaining: premium ? null : limiter.remaining(id) });
  } catch (err) {
    if (!premium) limiter.refund(id); // no cobrar intentos fallidos
    throw err;
  }
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('No encontrado');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/generate') return await handleGenerate(req, res);
    if (req.method === 'GET' && req.url === '/api/config') {
      return sendJson(res, 200, {
        demo: !process.env.ANTHROPIC_API_KEY,
        model: MODEL,
        freeDailyLimit: FREE_DAILY_LIMIT,
      });
    }
    if (req.method === 'GET') return serveStatic(req, res);
    sendJson(res, 405, { error: 'Método no permitido' });
  } catch (err) {
    const status = err.status && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    sendJson(res, status, {
      error: status === 500 ? 'Ocurrió un error con la IA. Intenta de nuevo en unos segundos.' : err.message,
    });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    const mode = process.env.ANTHROPIC_API_KEY ? `IA activa (${MODEL})` : 'MODO DEMO (sin ANTHROPIC_API_KEY)';
    console.log(`Ventas IA WhatsApp → http://localhost:${PORT}  ·  ${mode}`);
  });
}

module.exports = { server };
