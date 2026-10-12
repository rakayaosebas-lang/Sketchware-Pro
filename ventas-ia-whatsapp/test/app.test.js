'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildSystemPrompt, buildUserPrompt, TASKS } = require('../src/prompts');
const { generateDemo } = require('../src/demo');
const { UsageLimiter } = require('../src/limits');

const business = { name: 'Barbería El Estilo', type: 'barberia', tone: 'auto', products: 'Corte $8' };

test('el prompt de sistema incluye datos y tono del negocio', () => {
  const p = buildSystemPrompt(business);
  assert.match(p, /Barbería El Estilo/);
  assert.match(p, /Corte \$8/);
  assert.match(p, /relajado/);
  assert.match(buildSystemPrompt({ ...business, tone: 'formal' }), /formal y profesional/);
});

test('cada tarea arma su instrucción y valida datos obligatorios', () => {
  for (const task of Object.keys(TASKS)) {
    const prompt = buildUserPrompt(task, { message: 'Hola', product: 'Corte', customer: 'Ana' });
    assert.ok(prompt.length > 20, task);
  }
  assert.throws(() => buildUserPrompt('reply', {}), /Faltan datos/);
  assert.throws(() => buildUserPrompt('nope', {}), /Tarea desconocida/);
});

test('el modo demo responde todas las tareas', () => {
  for (const task of Object.keys(TASKS)) {
    const text = generateDemo(task, business, { product: 'Corte', customer: 'Ana' });
    assert.ok(text && !text.includes('no disponible'), task);
  }
});

test('el límite diario se respeta, devuelve intentos y se reinicia al día siguiente', () => {
  let now = new Date('2026-10-12T10:00:00Z');
  const lim = new UsageLimiter(2, () => now);
  assert.ok(lim.tryConsume('a'));
  assert.ok(lim.tryConsume('a'));
  assert.ok(!lim.tryConsume('a'));
  lim.refund('a');
  assert.equal(lim.remaining('a'), 1);
  now = new Date('2026-10-13T10:00:00Z');
  assert.equal(lim.remaining('a'), 2);
});

test('API en modo demo: genera, valida y limita', async (t) => {
  delete process.env.ANTHROPIC_API_KEY;
  const { server } = require('../server');
  await new Promise((r) => server.listen(0, r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(`${base}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  const ok = await post({ task: 'sale', business, input: { product: 'Corte + barba' } });
  assert.equal(ok.status, 200);
  const data = await ok.json();
  assert.equal(data.demo, true);
  assert.match(data.text, /Corte \+ barba/);

  assert.equal((await post({ task: 'xxx' })).status, 400);
  assert.equal((await post({ task: 'reply', business, input: {} })).status, 400);

  const cfg = await (await fetch(`${base}/api/config`)).json();
  assert.equal(cfg.demo, true);
  const html = await fetch(`${base}/`);
  assert.equal(html.status, 200);
  assert.equal((await fetch(`${base}/../server.js`)).status, 404);
});
