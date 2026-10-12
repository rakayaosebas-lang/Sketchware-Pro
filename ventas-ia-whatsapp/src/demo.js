'use strict';

// Respuestas de plantilla para usar la app sin API key (modo demo).
// No reemplazan a la IA, pero permiten probar todo el flujo de punta a punta.

function generateDemo(task, business = {}, input = {}) {
  const name = business.name || 'nuestro negocio';
  const product = input.product || 'nuestros productos';
  const customer = input.customer ? ` ${input.customer}` : '';
  const details = input.details ? `\n${input.details}` : '';

  switch (task) {
    case 'reply':
      return `¡Hola${customer}! 👋 Gracias por escribir a ${name}.\n` +
        'Con gusto te ayudo con eso. Déjame confirmarte el dato exacto en un momento.\n' +
        '¿Te gustaría que te lo aparte mientras tanto?';
    case 'sale':
      return `✨ ${product} en ${name}${details}\n\n` +
        'Calidad que se nota desde el primer día.\n' +
        '👉 Escríbeme "QUIERO" y te lo aparto ahora mismo.';
    case 'promo':
      return `🔥 PROMO en ${name} 🔥\n\n${product}${details}\n\n` +
        '⏰ Solo por tiempo limitado o hasta agotar stock.\n' +
        '¡Responde este mensaje y asegura el tuyo!';
    case 'followup':
      return `¡Hola${customer}! 😊 Te escribo de ${name}.\n` +
        `Hace poco me preguntaste por ${product}. ¿Te quedó alguna duda?\n` +
        'Si quieres, te lo dejo apartado hoy sin compromiso. ¿Te parece?';
    case 'close':
      return `¡Perfecto${customer}! 🙌 Entonces quedamos con ${product}.\n\n` +
        'Para confirmarlo solo necesito:\n1️⃣ Tu nombre completo\n2️⃣ Forma de pago (transferencia o efectivo)\n\n' +
        '¿Lo pasas a recoger o te lo enviamos?';
    case 'post':
      return `¿Ya conoces ${product}? 👀\n\nEn ${name} lo tenemos listo para ti.${details}\n\n` +
        '📲 Escríbenos por WhatsApp y te atendemos al instante.\n\n' +
        '#Emprendimiento #ComercioLocal #Latinoamérica #Ofertas #CompraLocal';
    case 'headlines':
      return [
        `1. ${product}: lo que estabas buscando`,
        `2. ¿Ya probaste ${product}?`,
        `3. Últimas unidades de ${product}`,
        `4. ${product} al mejor precio de la zona`,
        `5. Todos están hablando de ${product}`,
        `6. Hoy es el día para tu ${product}`,
        `7. ${product}: calidad garantizada`,
        `8. Pide ${product} en un mensaje`,
      ].join('\n');
    case 'ad':
      return `Texto principal: ${product} en ${name}. Escríbenos y recibe atención inmediata 📲\n` +
        `Título: ${product} cerca de ti\n` +
        'Descripción: Respuesta en minutos\n' +
        'Botón: Enviar mensaje de WhatsApp\n' +
        `Público sugerido: 18-45 años, ${business.city || 'tu ciudad'} + 10 km, intereses relacionados con ${product}.`;
    default:
      return 'Modo demo: tarea no disponible.';
  }
}

module.exports = { generateDemo };
