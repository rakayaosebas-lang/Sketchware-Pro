'use strict';

/* ================= Estado y almacenamiento ================= */

const STORE_KEY = 'ventas-ia-v1';
const FREE_CLIENT_LIMIT = 30;

const BUSINESS_TYPES = {
  restaurante: '🍔 Restaurante',
  barberia: '💈 Barbería',
  celulares: '📱 Celulares',
  ropa: '👕 Ropa',
  emprendedor: '🚀 Emprendimiento',
  familiar: '🏠 Negocio familiar',
};
const TONES = { auto: 'Automático', amigable: 'Amigable', formal: 'Formal', divertido: 'Divertido' };
const STATUSES = {
  nuevo: 'Nuevo',
  interesado: 'Interesado',
  pendiente: 'Pendiente',
  vendido: 'Vendido',
  perdido: 'Perdido',
};

const defaultState = () => ({ business: null, clients: [], premiumCode: '', usage: { day: '', count: 0 } });

function load() {
  try {
    return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return defaultState();
  }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* almacenamiento no disponible */ }
}

let state = load();
let config = { demo: false, freeDailyLimit: 15 };
let currentView = 'home';

/* ================= Utilidades ================= */

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const modal = $('#modal');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD local
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const money = (n) => '$' + Number(n || 0).toLocaleString('es', { maximumFractionDigits: 0 });
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const isPremium = () => Boolean(state.premiumCode);

function fmtDate(iso) {
  if (!iso) return '—';
  const diff = Math.round((new Date(today()) - new Date(iso)) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff === -1) return 'mañana';
  if (diff > 1) return `hace ${diff} días`;
  return `en ${-diff} días`;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function waLink(text, phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiado ✅ Pégalo en WhatsApp');
  } catch {
    toast('No se pudo copiar, mantén presionado el texto');
  }
}

function usageToday() {
  if (state.usage.day !== today()) state.usage = { day: today(), count: 0 };
  return state.usage.count;
}

/* ================= IA ================= */

async function generate(task, input) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.premiumCode) headers['X-Premium-Code'] = state.premiumCode;
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ task, input, business: state.business }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'No se pudo generar el mensaje');
    err.limitReached = data.limitReached;
    throw err;
  }
  usageToday();
  state.usage.count += 1;
  save();
  return data.text;
}

// Formulario de generación reutilizable (Responder, Vender, Contenido).
function generatorBlock({ tasks, initialTask, prefill = {} }) {
  const wrap = document.createElement('div');
  let task = initialTask || Object.keys(tasks)[0];
  let clientId = prefill.clientId || '';
  const phone = () => state.clients.find((c) => c.id === clientId)?.phone || '';

  const render = () => {
    const def = tasks[task];
    const clientOptions = state.clients
      .map((c) => `<option value="${esc(c.id)}" ${c.id === clientId ? 'selected' : ''}>${esc(c.name)}${c.product ? ' · ' + esc(c.product) : ''}</option>`)
      .join('');
    wrap.innerHTML = `
      ${Object.keys(tasks).length > 1 ? `<div class="chips" role="tablist">
        ${Object.entries(tasks).map(([k, t]) => `<button type="button" class="chip ${k === task ? 'active' : ''}" data-task="${k}">${t.label}</button>`).join('')}
      </div>` : ''}
      <form class="card" novalidate>
        <p class="sub" style="margin:0">${def.hint}</p>
        ${def.fields.includes('customer') && state.clients.length ? `
          <label>Elegir cliente <span class="opt">(opcional)</span></label>
          <select name="clientId"><option value="">— Escribir a mano —</option>${clientOptions}</select>` : ''}
        ${def.fields.includes('customer') ? `<label>Nombre del cliente <span class="opt">(opcional)</span></label>
          <input name="customer" placeholder="Ej: María" value="${esc(prefill.customer)}">` : ''}
        ${def.fields.includes('message') ? `<label>Mensaje del cliente</label>
          <textarea name="message" required placeholder="Pega aquí lo que te escribió el cliente. Ej: Hola, ¿cuánto cuesta el corte y tienen turno hoy?">${esc(prefill.message)}</textarea>` : ''}
        ${def.fields.includes('product') ? `<label>${def.productLabel || 'Producto o servicio'}</label>
          <input name="product" required placeholder="${def.productPlaceholder || 'Ej: Hamburguesa doble con papas'}" value="${esc(prefill.product)}">` : ''}
        ${def.fields.includes('details') ? `<label>Detalles <span class="opt">(precio, descuento, contexto)</span></label>
          <textarea name="details" placeholder="Ej: Antes $12, ahora $9. Válido hasta el domingo.">${esc(prefill.details)}</textarea>` : ''}
        <button class="btn primary block" type="submit">✨ Generar con IA</button>
        <div class="out"></div>
      </form>`;
  };

  wrap.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-task]');
    if (chip) {
      task = chip.dataset.task;
      render();
    }
  });

  wrap.addEventListener('change', (e) => {
    if (e.target.name !== 'clientId') return;
    clientId = e.target.value;
    const c = state.clients.find((x) => x.id === clientId);
    const form = e.target.form;
    if (c) {
      form.elements.customer.value = c.name;
      if (form.elements.product) form.elements.product.value = c.product || '';
    }
  });

  wrap.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const input = Object.fromEntries(new FormData(form));
    const required = [...form.querySelectorAll('[required]')].find((el) => !el.value.trim());
    if (required) {
      required.focus();
      return toast('Completa el campo marcado');
    }
    const btn = form.querySelector('button[type=submit]');
    const out = form.querySelector('.out');
    btn.disabled = true;
    out.innerHTML = '<p class="loading"><span class="spinner"></span>La IA está escribiendo tu mensaje…</p>';
    try {
      const text = await generate(task, input);
      out.innerHTML = `
        <label>Mensaje listo</label>
        <div class="result">${esc(text)}</div>
        <div class="actions">
          <button type="button" class="btn sm" data-copy>📋 Copiar</button>
          <a class="btn sm wa" target="_blank" rel="noopener" href="${esc(waLink(text, phone()))}" data-sent>Enviar por WhatsApp</a>
          <button type="submit" class="btn sm">🔄 Otra versión</button>
        </div>`;
      out.querySelector('[data-copy]').onclick = () => copy(text);
      out.querySelector('[data-sent]').onclick = () => markContacted(clientId);
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      out.innerHTML = `<p class="empty">${esc(err.message)}</p>` +
        (err.limitReached ? '<button type="button" class="btn primary block" data-go="plan">⭐ Ver Premium</button>' : '');
    } finally {
      btn.disabled = false;
    }
  });

  render();
  return wrap;
}

/* ================= Pantallas ================= */

const SALES_TASKS = {
  sale: { label: '🛍️ Venta', fields: ['product', 'details'], hint: 'Un mensaje persuasivo para ofrecer un producto.' },
  promo: { label: '🔥 Promoción', fields: ['product', 'details'], hint: 'Ideal para difusión o estados de WhatsApp.', productLabel: '¿Qué estás promocionando?' },
  followup: { label: '🔁 Seguimiento', fields: ['customer', 'product', 'details'], hint: 'Para clientes que preguntaron y no compraron.' },
  close: { label: '🤝 Cierre', fields: ['customer', 'product', 'details'], hint: 'Para cerrar la venta cuando el cliente está decidiendo.' },
};
const CONTENT_TASKS = {
  post: { label: '📸 Publicación', fields: ['product', 'details'], hint: 'Texto para Facebook e Instagram con hashtags.', productLabel: 'Tema de la publicación' },
  headlines: { label: '⚡ Títulos', fields: ['product'], hint: '8 títulos cortos y llamativos para tus anuncios o estados.' },
  ad: { label: '🎯 Meta Ads', fields: ['product', 'details'], hint: 'Anuncio listo para Facebook/Instagram Ads con botón a WhatsApp.' },
};
const REPLY_TASKS = {
  reply: { label: 'Responder', fields: ['message'], hint: 'Pega la pregunta del cliente y la IA escribe una respuesta profesional y que vende.' },
};

const screens = {
  home() {
    const t = today();
    const soldToday = state.clients.filter((c) => c.status === 'vendido' && c.soldAt === t);
    const newToday = state.clients.filter((c) => c.createdAt === t).length;
    const pending = state.clients.filter((c) => ['nuevo', 'interesado', 'pendiente'].includes(c.status));
    const due = state.clients
      .filter((c) => c.reminder && c.reminder <= t && !['vendido', 'perdido'].includes(c.status))
      .sort((a, b) => a.reminder.localeCompare(b.reminder));

    const counts = {};
    state.clients.forEach((c) => {
      const p = (c.product || '').trim();
      if (p) counts[p] = (counts[p] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = top[0]?.[1] || 1;
    const used = usageToday();

    view.innerHTML = `
      <h1>¡Hola, ${esc(state.business.name)}! 👋</h1>
      <p class="sub">Así va tu negocio hoy.</p>
      <div class="kpis">
        <div class="kpi accent"><small>Ventas de hoy</small><b>${money(soldToday.reduce((s, c) => s + Number(c.amount || 0), 0))}</b><small>${soldToday.length} venta(s)</small></div>
        <div class="kpi"><small>Clientes nuevos</small><b>${newToday}</b></div>
        <div class="kpi"><small>Pendientes</small><b>${pending.length}</b></div>
        <div class="kpi"><small>Seguimientos hoy</small><b>${due.length}</b></div>
      </div>

      <section class="card">
        <h2>⏰ Seguimientos para hoy</h2>
        ${due.length ? `<ul class="list">${due.map((c) => `
          <li>
            <div class="avatar">${esc(initials(c.name))}</div>
            <div class="grow"><b>${esc(c.name)}</b><small>${esc(c.product || 'Sin producto')} · recordatorio ${fmtDate(c.reminder)}</small></div>
            <button class="btn sm primary" data-followup="${esc(c.id)}">Escribir</button>
          </li>`).join('')}</ul>`
          : '<p class="empty">No tienes seguimientos pendientes. ¡Buen trabajo! 🎉</p>'}
      </section>

      <section class="card">
        <h2>🔎 Productos más consultados</h2>
        ${top.length ? top.map(([p, n]) => `
          <div class="bar-row"><span>${esc(p)}</span><b>${n}</b><div class="bar"><i style="width:${(n / max) * 100}%"></i></div></div>`).join('')
          : '<p class="empty">Registra clientes con su producto de interés para ver estadísticas.</p>'}
      </section>

      ${isPremium() ? '' : `<section class="card usage">
        Plan gratis: ${used} de ${config.freeDailyLimit} mensajes con IA usados hoy.
        <div class="bar"><i style="width:${Math.min(100, (used / config.freeDailyLimit) * 100)}%"></i></div>
      </section>`}

      <div class="row">
        <button class="btn primary" data-go="reply">💬 Responder cliente</button>
        <button class="btn" data-new-client>➕ Nuevo cliente</button>
      </div>`;
  },

  reply() {
    view.innerHTML = '<h1>Asistente de respuestas</h1><p class="sub">Responde rápido, profesional y con intención de venta.</p>';
    view.append(generatorBlock({ tasks: REPLY_TASKS }));
  },

  sell(opts = {}) {
    view.innerHTML = '<h1>Generador de ventas</h1><p class="sub">Elige qué tipo de mensaje necesitas.</p>';
    view.append(generatorBlock({ tasks: SALES_TASKS, ...opts }));
  },

  content() {
    view.innerHTML = '<h1>Generador de contenido</h1><p class="sub">Publicaciones y anuncios para atraer más clientes a tu WhatsApp.</p>';
    view.append(generatorBlock({ tasks: CONTENT_TASKS }));
  },

  clients(filter = { q: '', status: '' }) {
    const q = filter.q.toLowerCase();
    const list = state.clients
      .filter((c) => (!filter.status || c.status === filter.status) &&
        (!q || `${c.name} ${c.product} ${c.phone}`.toLowerCase().includes(q)))
      .sort((a, b) => (b.lastContact || '').localeCompare(a.lastContact || ''));

    view.innerHTML = `
      <h1>Clientes</h1>
      <p class="sub">${state.clients.length} cliente(s)${isPremium() ? '' : ` · máximo ${FREE_CLIENT_LIMIT} en plan gratis`}</p>
      <input type="search" id="q" placeholder="🔍 Buscar por nombre, producto o teléfono" value="${esc(filter.q)}">
      <div class="chips" style="margin-top:10px">
        <button class="chip ${!filter.status ? 'active' : ''}" data-status="">Todos</button>
        ${Object.entries(STATUSES).map(([k, v]) => `<button class="chip ${filter.status === k ? 'active' : ''}" data-status="${k}">${v}</button>`).join('')}
      </div>
      <section class="card">
        ${list.length ? `<ul class="list">${list.map((c) => `
          <li data-edit="${esc(c.id)}" style="cursor:pointer">
            <div class="avatar">${esc(initials(c.name))}</div>
            <div class="grow"><b>${esc(c.name)}</b><small>${esc(c.product || 'Sin producto')} · contacto ${fmtDate(c.lastContact)}</small></div>
            <span class="status s-${c.status}">${STATUSES[c.status]}</span>
          </li>`).join('')}</ul>`
          : `<p class="empty">${state.clients.length ? 'Sin resultados.' : 'Aún no tienes clientes. Agrega el primero 👇'}</p>`}
      </section>
      <button class="btn primary block" data-new-client>➕ Agregar cliente</button>`;

    $('#q').addEventListener('input', (e) => {
      screens.clients({ ...filter, q: e.target.value });
      const input = $('#q');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
    view.querySelectorAll('[data-status]').forEach((b) => {
      b.onclick = () => screens.clients({ ...filter, status: b.dataset.status });
    });
  },

  plan() {
    view.innerHTML = `
      <h1>Planes</h1>
      <p class="sub">Empieza gratis. Pásate a Premium cuando la app ya te esté generando ventas.</p>
      <div class="plans">
        <section class="card plan ${isPremium() ? '' : 'featured'}">
          <h2>Gratis <span class="price">$0</span></h2>
          <ul>
            <li>${config.freeDailyLimit} mensajes con IA por día</li>
            <li>Hasta ${FREE_CLIENT_LIMIT} clientes</li>
            <li>Panel del negocio básico</li>
          </ul>
        </section>
        <section class="card plan ${isPremium() ? 'featured' : ''}">
          <h2>Premium <span class="price">$7.99<small>/mes</small></span></h2>
          <ul>
            <li>Mensajes con IA ilimitados</li>
            <li>Clientes ilimitados y recordatorios</li>
            <li>Contenido para redes y Meta Ads sin límite</li>
            <li>Soporte prioritario por WhatsApp</li>
          </ul>
          ${isPremium()
            ? '<p class="sub" style="margin-top:12px">✅ Tienes Premium activo.</p><button class="btn block" data-remove-premium>Quitar código</button>'
            : `<form id="premiumForm"><label>¿Ya pagaste? Ingresa tu código</label><input name="code" placeholder="Código Premium" autocomplete="off">
               <button class="btn primary block">Activar Premium</button></form>`}
        </section>
      </div>`;
    const form = $('#premiumForm');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const code = form.elements.code.value.trim();
        if (!code) return toast('Ingresa tu código');
        state.premiumCode = code;
        save();
        refreshChrome();
        toast('Premium activado ⭐');
        screens.plan();
      };
    }
    const rm = view.querySelector('[data-remove-premium]');
    if (rm) rm.onclick = () => { state.premiumCode = ''; save(); refreshChrome(); screens.plan(); };
  },

  settings() {
    view.innerHTML = '<h1>Mi negocio</h1><p class="sub">La IA usa esta información para escribir como tu negocio.</p>';
    view.append(businessForm(state.business, 'Guardar cambios'));
    const reset = document.createElement('button');
    reset.className = 'btn block';
    reset.textContent = '🗑️ Borrar todos los datos';
    reset.onclick = () => {
      if (!confirm('¿Seguro? Se borrarán tu negocio y tus clientes de este dispositivo.')) return;
      state = defaultState();
      save();
      start();
    };
    view.append(reset);
  },

  onboarding() {
    view.innerHTML = `
      <h1>Bienvenido a Ventas IA 👋</h1>
      <p class="sub">Cuéntanos de tu negocio en 1 minuto y la IA empezará a vender contigo por WhatsApp.</p>`;
    view.append(businessForm({ type: 'emprendedor', tone: 'auto' }, 'Empezar a vender 🚀'));
  },
};

function businessForm(b, submitLabel) {
  const form = document.createElement('form');
  form.className = 'card';
  form.innerHTML = `
    <label>Nombre del negocio</label>
    <input name="name" required placeholder="Ej: Barbería El Estilo" value="${esc(b.name)}">
    <label>Tipo de negocio</label>
    <div class="grid-chips">${Object.entries(BUSINESS_TYPES).map(([k, v]) =>
      `<button type="button" class="chip ${b.type === k ? 'active' : ''}" data-type="${k}">${v}</button>`).join('')}</div>
    <input type="hidden" name="type" value="${esc(b.type)}">
    <label>Productos o servicios y precios <span class="opt">(recomendado)</span></label>
    <textarea name="products" placeholder="Ej: Corte $8, Corte + barba $12, Cejas $3">${esc(b.products)}</textarea>
    <div class="row">
      <div><label>Ciudad <span class="opt">(opcional)</span></label><input name="city" placeholder="Ej: Lima, Perú" value="${esc(b.city)}"></div>
      <div><label>Horario <span class="opt">(opcional)</span></label><input name="hours" placeholder="Lun-Sáb 9-20h" value="${esc(b.hours)}"></div>
    </div>
    <label>Tono de los mensajes</label>
    <select name="tone">${Object.entries(TONES).map(([k, v]) => `<option value="${k}" ${b.tone === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <label>Info extra <span class="opt">(envíos, pagos, ubicación)</span></label>
    <input name="extra" placeholder="Ej: Delivery gratis desde $20. Aceptamos Yape y efectivo." value="${esc(b.extra)}">
    <button class="btn primary block">${submitLabel}</button>`;

  form.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-type]');
    if (!chip) return;
    form.querySelectorAll('[data-type]').forEach((c) => c.classList.toggle('active', c === chip));
    form.elements.type.value = chip.dataset.type;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.name.trim()) {
      form.elements.name.focus();
      return toast('Escribe el nombre de tu negocio');
    }
    const first = !state.business;
    state.business = data;
    save();
    refreshChrome();
    toast(first ? '¡Listo! Tu asistente está configurado ✅' : 'Cambios guardados ✅');
    go('home');
  });
  return form;
}

/* ================= Clientes (modal) ================= */

function openClient(id) {
  const existing = state.clients.find((c) => c.id === id);
  if (!existing && !isPremium() && state.clients.length >= FREE_CLIENT_LIMIT) {
    toast(`El plan gratis permite ${FREE_CLIENT_LIMIT} clientes. Pásate a Premium ⭐`);
    return go('plan');
  }
  const c = existing || { status: 'nuevo', lastContact: today() };
  modal.innerHTML = `
    <form method="dialog">
      <h2>${existing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
      <label>Nombre</label>
      <input name="name" required placeholder="Ej: Carlos Pérez" value="${esc(c.name)}">
      <label>WhatsApp <span class="opt">(con código de país)</span></label>
      <input name="phone" type="tel" inputmode="tel" placeholder="Ej: 51987654321" value="${esc(c.phone)}">
      <label>Producto de interés</label>
      <input name="product" placeholder="Ej: iPhone 13 128GB" value="${esc(c.product)}">
      <div class="row">
        <div><label>Estado</label><select name="status">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${c.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label>Monto <span class="opt">(si compró)</span></label><input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(c.amount)}"></div>
      </div>
      <div class="row">
        <div><label>Último contacto</label><input name="lastContact" type="date" value="${esc(c.lastContact)}"></div>
        <div><label>Recordatorio</label><input name="reminder" type="date" value="${esc(c.reminder)}"></div>
      </div>
      <label>Notas <span class="opt">(opcional)</span></label>
      <textarea name="notes" placeholder="Ej: Quiere pagar en 2 cuotas">${esc(c.notes)}</textarea>
      <div class="actions">
        <button class="btn primary" value="save">Guardar</button>
        ${existing ? `
          <button class="btn" type="button" data-act="followup">🔁 Seguimiento IA</button>
          ${c.phone ? `<a class="btn wa" target="_blank" rel="noopener" href="${esc(waLink('', c.phone))}">WhatsApp</a>` : ''}
          <button class="btn" type="button" data-act="delete" style="color:var(--danger)">Eliminar</button>` : ''}
        <button class="btn" value="cancel" formnovalidate>Cancelar</button>
      </div>
    </form>`;

  const form = modal.querySelector('form');
  form.addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'save') return;
    const data = Object.fromEntries(new FormData(form));
    if (!data.name.trim()) {
      e.preventDefault();
      form.elements.name.focus();
      return;
    }
    if (existing) {
      if (data.status === 'vendido' && existing.status !== 'vendido') data.soldAt = today();
      if (data.status !== 'vendido') data.soldAt = '';
      Object.assign(existing, data);
    } else {
      state.clients.push({ id: uid(), createdAt: today(), soldAt: data.status === 'vendido' ? today() : '', ...data });
    }
    save();
    toast('Cliente guardado ✅');
    setTimeout(() => go(currentView), 0);
  });
  form.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
    if (!confirm(`¿Eliminar a ${existing.name}?`)) return;
    state.clients = state.clients.filter((x) => x.id !== existing.id);
    save();
    modal.close();
    go(currentView);
  });
  form.querySelector('[data-act="followup"]')?.addEventListener('click', () => {
    modal.close();
    startFollowup(existing.id);
  });
  modal.showModal();
}

// Al enviar un mensaje a un cliente: actualiza el último contacto y cierra el recordatorio vencido.
function markContacted(id) {
  const c = state.clients.find((x) => x.id === id);
  if (!c) return;
  c.lastContact = today();
  if (c.reminder && c.reminder <= today()) c.reminder = '';
  save();
}

function startFollowup(id) {
  const c = state.clients.find((x) => x.id === id);
  if (!c) return;
  go('sell', { initialTask: 'followup', prefill: { clientId: c.id, customer: c.name, product: c.product, details: c.notes } });
}

/* ================= Navegación ================= */

function go(name, opts) {
  if (!state.business) name = 'onboarding';
  currentView = name;
  screens[name](opts);
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.go === name));
  $('.tabbar').hidden = name === 'onboarding';
  window.scrollTo(0, 0);
}

function refreshChrome() {
  $('#bizName').textContent = state.business?.name || 'Ventas IA WhatsApp';
  const badge = $('#planBadge');
  badge.textContent = isPremium() ? 'Premium' : 'Gratis';
  badge.classList.toggle('premium', isPremium());
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-go]');
  if (nav) return go(nav.dataset.go);
  if (e.target.closest('[data-new-client]')) return openClient();
  const edit = e.target.closest('[data-edit]');
  if (edit) return openClient(edit.dataset.edit);
  const fu = e.target.closest('[data-followup]');
  if (fu) return startFollowup(fu.dataset.followup);
});

async function start() {
  try {
    config = await (await fetch('/api/config')).json();
  } catch { /* sin servidor: se mantienen valores por defecto */ }
  $('#demoBanner').hidden = !config.demo;
  refreshChrome();
  go('home');
}

start();
