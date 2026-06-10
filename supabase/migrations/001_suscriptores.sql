-- Ejecutar en: Supabase Dashboard → SQL Editor → pegar y ejecutar
-- Crea la tabla de suscriptores con RLS habilitado.
-- INSERT / UPDATE / DELETE solo vía service_role (backend/webhooks de Stripe).

create table if not exists public.suscriptores (
  id                 uuid        primary key default gen_random_uuid(),
  email              text        unique not null,
  estado             text        not null default 'inactivo'
                                 check (estado in ('activo', 'cancelado', 'pago_fallido', 'inactivo')),
  stripe_customer_id text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Actualizar updated_at automáticamente al modificar una fila
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger suscriptores_updated_at
  before update on public.suscriptores
  for each row execute procedure public.set_updated_at();

-- Row Level Security
alter table public.suscriptores enable row level security;

-- Solo SELECT: el usuario autenticado lee únicamente su propia fila
create policy "suscriptores_select_own"
  on public.suscriptores
  for select
  to authenticated
  using (email = (auth.jwt() ->> 'email'));
