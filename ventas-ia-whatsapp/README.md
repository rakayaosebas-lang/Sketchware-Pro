# Ventas IA WhatsApp 💬💰

Micro app para que pequeños negocios de Latinoamérica (restaurantes, barberías, tiendas de celulares y de ropa, emprendedores, negocios familiares) **vendan más por WhatsApp con inteligencia artificial**.

- 💬 **Asistente de respuestas**: pega lo que te escribió el cliente y recibe una respuesta profesional y que vende, con el tono de tu rubro.
- 💰 **Generador de ventas**: mensajes de venta, promociones, seguimientos y cierres.
- 👥 **Clientes**: nombre, WhatsApp, producto de interés, estado de la venta, último contacto y recordatorios.
- 📣 **Contenido**: publicaciones para Facebook/Instagram, títulos llamativos y anuncios de Meta Ads.
- 🏠 **Panel**: ventas del día, clientes nuevos, pendientes, seguimientos de hoy y productos más consultados.
- ⭐ **Plan gratis limitado + Premium**.

Arquitectura, pantallas, flujo, base de datos, MVP, monetización y mejoras futuras: **[docs/PLAN.md](docs/PLAN.md)**.

## Ejecutar

Necesitas Node.js 20.6 o superior.

```bash
npm install
npm start            # http://localhost:3000 en MODO DEMO (respuestas de ejemplo)
```

Con IA real:

```bash
cp .env.example .env # completa ANTHROPIC_API_KEY
npm run start:env
```

| Variable | Por defecto | Descripción |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Sin ella la app funciona en modo demo |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Usa `claude-haiku-5-5` para bajar mucho el costo por mensaje |
| `FREE_DAILY_LIMIT` | `15` | Mensajes con IA por día en el plan gratis |
| `PREMIUM_CODES` | — | Códigos Premium válidos, separados por coma |
| `PORT` | `3000` | Puerto HTTP |

## Pruebas

```bash
npm test
```

## Estructura

```
server.js        servidor HTTP + API (/api/generate, /api/config)
src/             IA, prompts, modo demo, límites
public/          PWA para celular (sin frameworks)
db/schema.sql    base de datos PostgreSQL/Supabase para producción
docs/PLAN.md     plan de producto y técnico
```
