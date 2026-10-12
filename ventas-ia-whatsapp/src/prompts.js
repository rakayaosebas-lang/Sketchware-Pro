'use strict';

// Tipos de negocio soportados y el tono por defecto de cada uno.
const BUSINESS_TYPES = {
  restaurante: { label: 'Restaurante', tone: 'cálido, cercano y que abra el apetito' },
  barberia: { label: 'Barbería', tone: 'relajado, con confianza y buena onda' },
  celulares: { label: 'Tienda de celulares', tone: 'claro, técnico pero sencillo, que genere confianza' },
  ropa: { label: 'Tienda de ropa', tone: 'moderno, con estilo y entusiasta' },
  emprendedor: { label: 'Emprendimiento', tone: 'auténtico, cercano y motivador' },
  familiar: { label: 'Negocio familiar', tone: 'amable, de confianza, como de barrio' },
};

const TONES = {
  auto: null,
  formal: 'formal y profesional',
  amigable: 'amigable y cercano',
  divertido: 'divertido, con energía y algún emoji',
};

// Cada tarea define qué datos necesita y cómo se arma la instrucción.
const TASKS = {
  reply: {
    label: 'Responder cliente',
    fields: ['message'],
    build: (i) =>
      `Un cliente escribió por WhatsApp:\n"""${i.message}"""\n\n` +
      'Escribe la respuesta que el negocio le enviaría. Responde su duda con la información disponible; ' +
      'si falta un dato (precio, horario, stock), no lo inventes: indica que lo confirmas enseguida. ' +
      'Termina con una pregunta que acerque la venta.',
  },
  sale: {
    label: 'Mensaje de venta',
    fields: ['product', 'details'],
    build: (i) =>
      `Crea un mensaje de WhatsApp para vender: ${i.product}.` +
      (i.details ? ` Detalles: ${i.details}.` : '') +
      ' Destaca el beneficio principal, genera deseo y termina con un llamado a la acción claro.',
  },
  promo: {
    label: 'Promoción',
    fields: ['product', 'details'],
    build: (i) =>
      `Crea un mensaje de promoción para WhatsApp (difusión o estado) sobre: ${i.product}.` +
      (i.details ? ` Condiciones: ${i.details}.` : '') +
      ' Incluye urgencia real (tiempo o cupos limitados) sin sonar desesperado.',
  },
  followup: {
    label: 'Seguimiento',
    fields: ['customer', 'product', 'details'],
    build: (i) =>
      `${i.customer || 'Un cliente'} preguntó por ${i.product || 'un producto'} y no compró.` +
      (i.details ? ` Contexto: ${i.details}.` : '') +
      ' Escribe un mensaje de seguimiento amable que retome la conversación sin presionar, ' +
      'resuelva una posible objeción y facilite responder con un sí.',
  },
  close: {
    label: 'Cierre de venta',
    fields: ['customer', 'product', 'details'],
    build: (i) =>
      `${i.customer || 'El cliente'} está interesado en ${i.product || 'el producto'} y está por decidir.` +
      (i.details ? ` Contexto: ${i.details}.` : '') +
      ' Escribe un mensaje de cierre: confirma lo que lleva, da los pasos concretos para pagar o reservar ' +
      'y ofrece dos opciones simples para avanzar.',
  },
  post: {
    label: 'Publicación Facebook/Instagram',
    fields: ['product', 'details'],
    build: (i) =>
      `Crea una publicación para Facebook e Instagram sobre: ${i.product}.` +
      (i.details ? ` Detalles: ${i.details}.` : '') +
      ' Incluye un gancho en la primera línea, un texto breve, un llamado a escribir por WhatsApp ' +
      'y 5 a 8 hashtags relevantes para Latinoamérica.',
  },
  headlines: {
    label: 'Títulos llamativos',
    fields: ['product'],
    build: (i) =>
      `Dame 8 títulos llamativos y cortos (máximo 10 palabras) para promocionar: ${i.product}. ` +
      'Uno por línea, numerados, variando el enfoque (beneficio, curiosidad, urgencia, precio, prueba social).',
  },
  ad: {
    label: 'Anuncio Meta Ads',
    fields: ['product', 'details'],
    build: (i) =>
      `Crea un anuncio para Meta Ads (Facebook/Instagram) con objetivo "mensajes a WhatsApp" para: ${i.product}.` +
      (i.details ? ` Detalles: ${i.details}.` : '') +
      ' Entrega: Texto principal (máx. 125 caracteres), Título (máx. 40), Descripción (máx. 30), ' +
      'botón recomendado y una sugerencia de público objetivo (edad, intereses, ubicación).',
  },
};

function describeBusiness(b = {}) {
  const type = BUSINESS_TYPES[b.type] || BUSINESS_TYPES.emprendedor;
  const tone = TONES[b.tone] || type.tone;
  const lines = [
    `Nombre del negocio: ${b.name || 'el negocio'}`,
    `Tipo: ${type.label}`,
    b.city ? `Ciudad/País: ${b.city}` : null,
    b.products ? `Productos o servicios y precios: ${b.products}` : null,
    b.hours ? `Horario: ${b.hours}` : null,
    b.extra ? `Información adicional: ${b.extra}` : null,
  ].filter(Boolean);
  return { text: lines.join('\n'), tone };
}

function buildSystemPrompt(business) {
  const { text, tone } = describeBusiness(business);
  return [
    'Eres el asistente de ventas por WhatsApp de un pequeño negocio de Latinoamérica.',
    'Escribes en español neutro latinoamericano, natural, como lo escribiría el dueño del negocio.',
    `Tono: ${tone}.`,
    'Los mensajes son cortos y fáciles de leer en el celular: frases breves, párrafos de 1-2 líneas y como máximo 2-3 emojis.',
    'Nunca inventes precios, promociones, stock ni datos que no estén en la información del negocio.',
    'Entrega solo el texto listo para copiar y enviar, sin explicaciones, comillas ni encabezados extra.',
    '',
    'Información del negocio:',
    text,
  ].join('\n');
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function buildUserPrompt(task, input = {}) {
  const def = TASKS[task];
  if (!def) throw badRequest(`Tarea desconocida: ${task}`);
  const missing = def.fields.filter((f) => f !== 'details' && f !== 'customer' && !String(input[f] || '').trim());
  if (missing.length) throw badRequest(`Faltan datos: ${missing.join(', ')}`);
  return def.build(input);
}

module.exports = { BUSINESS_TYPES, TONES, TASKS, buildSystemPrompt, buildUserPrompt };
