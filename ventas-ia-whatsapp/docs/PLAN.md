# Ventas IA WhatsApp · Plan de producto y técnico

> Micro app para que pequeños negocios de Latinoamérica vendan más por WhatsApp con inteligencia artificial.
> Público: restaurantes, barberías, tiendas de celulares, tiendas de ropa, emprendedores y negocios familiares.

---

## 1. Arquitectura

### Principios
- **Celular primero**: PWA instalable desde el navegador (sin Play Store ni App Store para el MVP), funciona bien en Android de gama baja y con datos móviles.
- **Cero fricción**: sin registro para probar. El negocio se configura en 1 minuto y ya puede generar mensajes.
- **La IA nunca inventa**: precios, stock y promociones salen solo del perfil del negocio.
- **Copiar y pegar en WhatsApp primero**; integración con la API oficial de WhatsApp después (requiere aprobación de Meta y tiene costo por conversación).

### Diagrama (MVP)

```
┌─────────────────────────── Celular del dueño ───────────────────────────┐
│  PWA (HTML + CSS + JS sin framework)                                    │
│  ├─ Panel · Responder · Vender · Clientes · Contenido · Planes          │
│  ├─ localStorage: perfil del negocio, clientes, uso diario              │
│  └─ wa.me/?text=…  → abre WhatsApp con el mensaje listo                 │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ POST /api/generate {task, business, input}
┌──────────────▼──────────────────────────────────────────────────────────┐
│  Servidor Node.js (server.js, sin frameworks)                           │
│  ├─ Archivos estáticos (public/)                                        │
│  ├─ Validación de tarea/datos  (src/prompts.js)                         │
│  ├─ Límite plan gratis por día (src/limits.js)                          │
│  ├─ Prompts por tarea y tipo de negocio (src/prompts.js)                │
│  └─ Claude API vía SDK oficial (src/ai.js)  ·  modo demo sin API key    │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ @anthropic-ai/sdk
         ┌─────▼─────┐
         │ Claude API│
         └───────────┘
```

### Arquitectura de producción (fase 2)

| Capa | Tecnología sugerida | Por qué |
|---|---|---|
| Frontend | La misma PWA (o migrar a React/Next.js si crece el equipo) | Ya está optimizada para celular |
| API | Node.js (este servidor) en Railway / Render / Fly.io | Barato, simple de desplegar |
| Base de datos + Auth | Supabase (PostgreSQL + login por OTP) | Gratis para empezar, RLS por negocio (`db/schema.sql`) |
| IA | Claude API (`CLAUDE_MODEL` configurable) | Calidad en español y tono natural |
| Pagos | Mercado Pago (suscripciones) + Stripe para el resto | Medios de pago locales en LATAM |
| Recordatorios | Cron diario + Web Push (y luego plantillas de WhatsApp) | Que el dueño no olvide hacer seguimiento |
| Analítica | PostHog o Plausible | Medir activación y conversión a Premium |

### Estructura del código

```
ventas-ia-whatsapp/
├─ server.js            Servidor HTTP + API
├─ src/
│  ├─ ai.js             Llamada a Claude (o modo demo)
│  ├─ prompts.js        Tipos de negocio, tonos, prompts por tarea
│  ├─ demo.js           Respuestas de plantilla sin API key
│  └─ limits.js         Límite diario del plan gratis
├─ public/              PWA (index.html, app.js, styles.css, manifest, ícono)
├─ db/schema.sql        Base de datos de producción
├─ test/                Pruebas (node --test)
└─ docs/PLAN.md         Este documento
```

---

## 2. Diseño de pantallas

Estilo SaaS moderno: fondo claro, tarjetas blancas con bordes suaves, un solo color de marca (verde WhatsApp `#0f9d58`), tipografía del sistema, botones grandes (mín. 44 px), emojis como íconos para que se entienda sin leer. Modo oscuro automático.

Navegación con **barra inferior de 5 pestañas** (al alcance del pulgar) + barra superior con nombre del negocio, plan y ajustes.

| # | Pantalla | Contenido clave |
|---|---|---|
| 0 | **Bienvenida / Configuración** | Nombre del negocio, tipo (6 botones grandes), productos y precios, ciudad, horario, tono, info extra (envíos/pagos). Un solo botón: "Empezar a vender 🚀". |
| 1 | **Inicio (Panel)** | Saludo · 4 tarjetas: *Ventas de hoy* (destacada), *Clientes nuevos*, *Pendientes*, *Seguimientos hoy* · Lista "Seguimientos para hoy" con botón **Escribir** · Barras de *Productos más consultados* · Uso del plan gratis · Accesos rápidos. |
| 2 | **Responder** | Caja para pegar el mensaje del cliente → "✨ Generar con IA" → burbuja verde con la respuesta + **Copiar**, **Enviar por WhatsApp**, **Otra versión**. |
| 3 | **Vender** | Chips: Venta · Promoción · Seguimiento · Cierre. Selector de cliente existente, producto, detalles. Mismo bloque de resultado. |
| 4 | **Clientes** | Buscador, filtros por estado (Nuevo, Interesado, Pendiente, Vendido, Perdido), lista con avatar, producto, "contacto hace X días" y etiqueta de estado. Ficha en ventana emergente: nombre, WhatsApp, producto, estado, monto, último contacto, recordatorio, notas + "🔁 Seguimiento IA" y "WhatsApp". |
| 5 | **Contenido** | Chips: Publicación (FB/IG con hashtags) · Títulos (8 opciones) · Meta Ads (texto, título, descripción, botón, público). |
| 6 | **Planes** | Comparativa Gratis vs Premium y activación con código. |
| 7 | **Ajustes (Mi negocio)** | Editar el perfil que usa la IA; borrar datos. |

Mensajes de error y vacíos siempre en lenguaje simple y con la siguiente acción ("Aún no tienes clientes. Agrega el primero 👇").

---

## 3. Flujo de usuario

```
Abre el link ──► Bienvenida (1 min) ──► Panel
                                         │
   ┌─────────────────────┬───────────────┼──────────────────┬───────────────────┐
   ▼                     ▼               ▼                  ▼                   ▼
Cliente escribe     Quiere vender   Registrar cliente   Recordatorio hoy    Publicar en redes
   │                     │               │                  │                   │
Pega mensaje en     Elige Venta/     Ficha: producto,   Panel ► "Escribir"  Contenido ► tipo
"Responder"         Promo/Cierre     estado, fecha,         │               ► Generar
   │                     │           recordatorio       Seguimiento con         │
Generar ► Copiar /  Generar ►            │              datos precargados   Copiar ► pegar en
Enviar por WhatsApp Enviar por WA    Panel actualiza        │               FB / IG / Ads
                                     métricas           Enviar por WA ►
                                                        actualiza "último
                                                        contacto" y cierra
                                                        el recordatorio
                                         │
                       Llega al límite gratis (15/día o 30 clientes)
                                         ▼
                              Pantalla Planes ► Premium
```

**Momento "¡ajá!"** (activación): generar el primer mensaje y enviarlo por WhatsApp en menos de 2 minutos desde que abre la app.

---

## 4. Base de datos

- **MVP**: todo en el dispositivo (`localStorage`, clave `ventas-ia-v1`). Ventaja: sin servidor de datos, privacidad, lanzamiento inmediato. Límite: un solo dispositivo.
- **Producción**: PostgreSQL / Supabase. Esquema completo en [`db/schema.sql`](../db/schema.sql).

| Tabla | Para qué |
|---|---|
| `users` | Dueño de la cuenta (login por OTP al teléfono) |
| `businesses` | Perfil del negocio que usa la IA (tipo, tono, ciudad, moneda, info extra) |
| `products` | Catálogo con precios (la IA no inventa precios) |
| `customers` | Mini CRM: nombre, teléfono, producto de interés, estado de la venta, monto, fecha de venta, último contacto, notas |
| `reminders` | Recordatorios de seguimiento (varios por cliente) |
| `interactions` | Historial de mensajes entrantes/salientes |
| `ai_generations` | Cada texto generado: tarea, entrada, salida, tokens, si se envió y calificación 👍/👎 |
| `plans`, `subscriptions` | Planes y estado de pago (Mercado Pago / Stripe) |
| `usage_counters` | Límite diario del plan gratis |
| Vista `business_dashboard_today` | Métricas del panel en una consulta |

Seguridad: Row Level Security para que cada dueño vea solo sus datos.

---

## 5. MVP para lanzar rápido (2–4 semanas)

**Incluido en este código (✅ funcional):**
- ✅ Configuración del negocio en 1 pantalla (tipo, tono, productos, horario, info extra).
- ✅ Asistente de respuestas con IA adaptado al tipo de negocio y tono.
- ✅ Generador de ventas: venta, promoción, seguimiento, cierre.
- ✅ Generador de contenido: publicaciones FB/IG, títulos, anuncios Meta Ads.
- ✅ Mini CRM: nombre, WhatsApp, producto, estado, monto, último contacto, recordatorio, notas.
- ✅ Panel: ventas del día, clientes nuevos, pendientes, seguimientos de hoy, productos más consultados.
- ✅ Botones Copiar / Enviar por WhatsApp (`wa.me`) / Otra versión.
- ✅ Plan gratis limitado (15 mensajes IA/día, 30 clientes) y activación Premium por código.
- ✅ PWA instalable, modo oscuro, modo demo sin API key, pruebas automáticas.

**Fuera del MVP (a propósito):** cuentas y sincronización, integración con la API de WhatsApp Business, pagos automáticos, multiusuario.

**Plan de lanzamiento:**
1. Semana 1: desplegar en Render/Railway con dominio propio, probar con 10 negocios conocidos (2 por rubro).
2. Semana 2: ajustar prompts con mensajes reales, medir activación.
3. Semana 3: cobrar Premium manualmente (link de Mercado Pago/Yape/transferencia → enviar código por WhatsApp).
4. Semana 4: Supabase + login por OTP para no perder datos al cambiar de celular.

**Métricas clave:** % que genera su primer mensaje (activación), mensajes enviados por WhatsApp/usuario/semana, retención día 7, conversión Gratis → Premium (meta 3–5 %).

---

## 6. Código inicial funcional

Está en esta carpeta. Para correrlo:

```bash
cd ventas-ia-whatsapp
npm install
npm start                      # modo demo (sin API key)
# o con IA real:
cp .env.example .env           # completar ANTHROPIC_API_KEY
npm run start:env
npm test
```

Puntos técnicos importantes:
- `src/prompts.js` arma un **prompt de sistema** con el perfil del negocio y el tono por rubro (p. ej. barbería = "relajado, con confianza") y una instrucción específica por tarea. Reglas fijas: español latinoamericano, mensajes cortos para celular, máx. 2–3 emojis y **no inventar datos**.
- `src/ai.js` usa el SDK oficial `@anthropic-ai/sdk`, con esfuerzo `low` (textos cortos, baja latencia) y *fallback* automático del lado del servidor si el modelo rechaza una solicitud.
- **Costo por mensaje**: el modelo se elige con `CLAUDE_MODEL`. Por defecto `claude-opus-5-5` (máxima calidad, aprox. US$0.005–0.01 por mensaje). Para escalar con margen en un plan de US$7.99, conviene probar `claude-haiku-5-5` (unas 30 veces más barato, aprox. US$0.0003 por mensaje) y comparar la calidad con mensajes reales antes de decidir.
- El servidor devuelve el intento al contador si la IA falla (no se cobra un error al usuario).

---

## 7. Estrategia de monetización

### Planes

| | **Gratis** | **Premium** · US$7.99/mes | **Pro** · US$19.99/mes (fase 2) |
|---|---|---|---|
| Mensajes con IA | 15 por día | Ilimitados* | Ilimitados* |
| Clientes en CRM | 30 | Ilimitados | Ilimitados |
| Recordatorios | Sí | Sí + notificaciones push | Sí + envío automático por WhatsApp |
| Contenido redes / Meta Ads | Sí (cuenta en el límite) | Ilimitado | Ilimitado + calendario mensual |
| Negocios | 1 | 1 | 3 + 2 usuarios (empleados) |
| Respuesta automática por WhatsApp API | — | — | Sí |

\* Con uso justo (p. ej. 1.500/mes) para proteger el costo de IA.

### Precios locales
Precio en moneda local con ajuste por país (paridad de poder adquisitivo): p. ej. MXN 129, COP 25.000, PEN 25, ARS equivalente. **Plan anual con 2 meses gratis** para mejorar la retención.

### Cómo cobrar en LATAM
1. MVP: pago manual (Mercado Pago link, Yape/Plin, Nequi, transferencia, OXXO) → el equipo envía el **código Premium** por WhatsApp (ya soportado: variable `PREMIUM_CODES`).
2. Fase 2: suscripciones automáticas con Mercado Pago Suscripciones y Stripe; webhooks → tabla `subscriptions`.

### Adquisición
- **WhatsApp como canal de crecimiento**: cada mensaje generado puede llevar opcionalmente "Hecho con Ventas IA" en el plan gratis (desactivable en Premium).
- **Referidos**: 1 mes Premium gratis por cada negocio que se suscriba con tu link.
- Contenido en TikTok/Reels: "Así respondo a mis clientes en 5 segundos" por rubro.
- Alianzas con proveedores de rubros (distribuidores de celulares, academias de barbería, cámaras de comercio, programas de emprendimiento).
- Prueba Premium de 7 días al llegar por primera vez al límite (momento de máxima intención).

### Ingresos extra
- Paquetes de plantillas por rubro y temporada (Día de la Madre, Buen Fin, Navidad).
- Servicio "hecho por ti": configuración de catálogo y campaña de Meta Ads por un pago único.
- Plan para agencias/consultores que gestionan varios negocios.

---

## 8. Mejoras futuras con IA

1. **Respuesta automática real en WhatsApp** (API de WhatsApp Business): la IA contesta preguntas frecuentes 24/7 y pasa al dueño las conversaciones de compra, con un botón "tomar control".
2. **Leer capturas y audios**: el dueño sube una captura de pantalla del chat o un audio del cliente y la IA entiende el contexto y responde (visión + transcripción).
3. **Catálogo inteligente desde una foto**: tomar foto del menú, vitrina o lista de precios → la IA crea el catálogo con precios.
4. **CRM automático**: la IA extrae de cada conversación el nombre, el producto, la intención de compra y el estado, y propone el próximo paso y la fecha de seguimiento.
5. **Puntuación de clientes**: probabilidad de compra para priorizar a quién escribir primero.
6. **Aprendizaje del estilo del dueño**: usar los mensajes 👍 y los que realmente se enviaron como ejemplos para que la IA escriba cada vez más como el negocio.
7. **Asistente de precios y promociones**: sugerencias según el día, la temporada y los productos más consultados ("Hoy martes las ventas bajan: lanza un 2x1 en cortes").
8. **Resumen diario por WhatsApp**: "Ayer vendiste $120, 3 clientes esperan respuesta, te sugiero este mensaje para María".
9. **Generación de imágenes y videos cortos** para estados, historias y anuncios a partir de la foto del producto.
10. **Optimización de Meta Ads**: la IA crea variantes, lee resultados y recomienda en qué anuncio invertir.
11. **Agente de cobro amable**: recordatorios de pagos pendientes y apartados con tono adecuado.
12. **Multi-idioma y localismos**: adaptar vocabulario por país (che, parce, chamo, wey, causa) según la ubicación del negocio.
