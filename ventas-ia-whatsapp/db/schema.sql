-- Ventas IA WhatsApp · Esquema PostgreSQL (Supabase compatible)
-- El MVP guarda los datos en el dispositivo (localStorage). Este esquema es
-- el paso a producción: cuentas, multi-dispositivo, suscripciones y métricas.

create extension if not exists "pgcrypto";

-- Usuarios (dueños del negocio). Con Supabase, id = auth.users.id
create table users (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique,                 -- login por WhatsApp/SMS OTP
  email         text unique,
  full_name     text,
  created_at    timestamptz not null default now()
);

-- Un usuario puede tener uno o más negocios (Premium: varios)
create table businesses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references users(id) on delete cascade,
  name          text not null,
  type          text not null check (type in ('restaurante','barberia','celulares','ropa','emprendedor','familiar')),
  tone          text not null default 'auto' check (tone in ('auto','amigable','formal','divertido')),
  city          text,
  country_code  char(2),                     -- PE, MX, CO, AR...
  currency      char(3) not null default 'USD',
  hours         text,
  extra_info    text,                         -- envíos, pagos, ubicación
  whatsapp_number text,
  created_at    timestamptz not null default now()
);
create index on businesses(owner_id);

-- Catálogo: la IA lo usa para no inventar precios
create table products (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  name          text not null,
  price         numeric(12,2),
  description   text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on products(business_id) where active;

-- Mini CRM
create type sale_status as enum ('nuevo','interesado','pendiente','vendido','perdido');

create table customers (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses(id) on delete cascade,
  name             text not null,
  phone            text,
  product_id       uuid references products(id) on delete set null,
  product_interest text,                      -- texto libre si no está en catálogo
  status           sale_status not null default 'nuevo',
  amount           numeric(12,2),             -- monto si compró
  sold_at          date,
  last_contact_at  date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on customers(business_id, status);
create index on customers(business_id, created_at);
create unique index on customers(business_id, phone) where phone is not null;

-- Recordatorios de seguimiento (varios por cliente)
create table reminders (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  due_date      date not null,
  note          text,
  done_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index on reminders(business_id, due_date) where done_at is null;

-- Historial de interacciones (alimenta el panel y futuras mejoras de IA)
create table interactions (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references customers(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  channel       text not null default 'whatsapp',
  direction     text not null check (direction in ('in','out')),
  body          text not null,
  created_at    timestamptz not null default now()
);
create index on interactions(customer_id, created_at);

-- Cada texto generado con IA (para métricas, plantillas favoritas y calidad)
create table ai_generations (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  customer_id   uuid references customers(id) on delete set null,
  task          text not null check (task in ('reply','sale','promo','followup','close','post','headlines','ad')),
  input         jsonb not null,
  output        text not null,
  model         text not null,
  input_tokens  int,
  output_tokens int,
  was_sent      boolean not null default false,   -- tocó "Enviar por WhatsApp"
  rating        smallint check (rating between -1 and 1), -- 👍 / 👎
  created_at    timestamptz not null default now()
);
create index on ai_generations(business_id, created_at);

-- Planes y suscripciones
create table plans (
  id                text primary key,             -- 'free', 'premium', 'pro'
  name              text not null,
  price_usd         numeric(8,2) not null,
  daily_ai_limit    int,                          -- null = ilimitado
  max_customers     int,
  max_businesses    int not null default 1
);
insert into plans values
  ('free',    'Gratis',  0,     15,   30,   1),
  ('premium', 'Premium', 7.99,  null, null, 1),
  ('pro',     'Pro',     19.99, null, null, 3);

create table subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  plan_id            text not null references plans(id),
  status             text not null check (status in ('trialing','active','past_due','canceled')),
  provider           text not null,               -- 'mercadopago', 'stripe', 'manual'
  provider_ref       text,
  current_period_end timestamptz,
  created_at         timestamptz not null default now()
);
create index on subscriptions(user_id) where status in ('trialing','active');

-- Contador diario para el límite del plan gratis
create table usage_counters (
  business_id   uuid not null references businesses(id) on delete cascade,
  day           date not null,
  ai_count      int not null default 0,
  primary key (business_id, day)
);

-- Vista para el panel del negocio
create view business_dashboard_today as
select
  b.id as business_id,
  coalesce(sum(c.amount) filter (where c.status = 'vendido' and c.sold_at = current_date), 0) as sales_today,
  count(*) filter (where c.status = 'vendido' and c.sold_at = current_date)                 as sales_count_today,
  count(*) filter (where c.created_at::date = current_date)                                 as new_customers_today,
  count(*) filter (where c.status in ('nuevo','interesado','pendiente'))                    as pending_customers
from businesses b
left join customers c on c.business_id = b.id
group by b.id;

-- Seguridad (Supabase RLS): cada dueño ve solo sus negocios
alter table businesses enable row level security;
alter table customers  enable row level security;
alter table products   enable row level security;
alter table reminders  enable row level security;
create policy own_business on businesses using (owner_id = auth.uid());
create policy own_customers on customers using (business_id in (select id from businesses where owner_id = auth.uid()));
create policy own_products on products using (business_id in (select id from businesses where owner_id = auth.uid()));
create policy own_reminders on reminders using (business_id in (select id from businesses where owner_id = auth.uid()));
