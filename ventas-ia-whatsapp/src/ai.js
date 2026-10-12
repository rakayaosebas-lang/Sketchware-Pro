'use strict';

const { buildSystemPrompt, buildUserPrompt } = require('./prompts');
const { generateDemo } = require('./demo');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic();
  }
  return client;
}

// Genera un texto de ventas. Sin API key responde con plantillas (modo demo).
async function generate({ task, business, input }) {
  const userPrompt = buildUserPrompt(task, input); // valida tarea y datos
  const anthropic = getClient();
  if (!anthropic) {
    return { text: generateDemo(task, business, input), demo: true };
  }

  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 2000, // textos cortos para WhatsApp/redes
    system: buildSystemPrompt(business),
    output_config: { effort: 'low' }, // copy corto: baja latencia y costo
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content: userPrompt }],
  });

  if (response.stop_reason === 'refusal') {
    const err = new Error('La IA no pudo generar este mensaje. Prueba reformulando el pedido.');
    err.status = 422;
    throw err;
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return { text, demo: false };
}

module.exports = { generate, MODEL };
