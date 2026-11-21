-- ============================================================================
-- FESTIVAL'S LIFE — Supabase PostgreSQL Schema (Step 2)
-- Wklej cały ten plik w Supabase -> SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. PROFILES (rozszerzenie auth.users o Hometown i ustawienia)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text default '',
  hometown text default 'Poznań',
  hometown_lat double precision default 52.4064,
  hometown_lng double precision default 16.9252,
  theme text default 'dark',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Automatyczne tworzenie profilu po rejestracji użytkownika
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CITIES CACHE (wspólny cache współrzędnych miast — 0 zbędnych zapytań)
create table if not exists public.cities_cache (
  city text primary key,
  country text default '',
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz default now()
);

-- 3. CONCERTS (główna historia przeżytych koncertów)
create table if not exists public.concerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  rok integer,
  event text not null default '',
  artysta text not null,
  data date,
  dzien text default '',
  godzina text default '',
  scena text default '',
  miejsce text default '',
  miasto text default '',
  district text default '',
  kraj text default 'Polska',
  gatunek text default '',
  podgatunek text default '',
  kto text default 'Razem',
  z_kim text default '',
  ocena smallint default 0 check (ocena between 0 and 5),
  cena numeric(10,2),
  uwagi text default '',
  setlist_url text default '',
  created_at timestamptz default now()
);

create index if not exists idx_concerts_user_data on public.concerts (user_id, data desc);
create index if not exists idx_concerts_user_rok on public.concerts (user_id, rok);
create index if not exists idx_concerts_user_miasto on public.concerts (user_id, miasto);

-- 4. UPCOMING CONCERTS (nadchodzące koncerty + portfel biletów)
create table if not exists public.upcoming_concerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  rok integer,
  event text not null default '',
  artysta text not null,
  data date,
  dzien text default '',
  godzina text default '',
  miejsce text default '',
  miasto text default '',
  kraj text default 'Polska',
  gatunek text default '',
  z_kim text default '',
  status_biletu text default 'Kupiony',
  cena numeric(10,2),
  ticket_file_path text default '',
  uwagi text default '',
  created_at timestamptz default now()
);

create index if not exists idx_upcoming_user_data on public.upcoming_concerts (user_id, data asc);

-- 5. EVENTS META (plakaty, zdjęcia z wydarzeń i pełne line-upy)
create table if not exists public.events_meta (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  poster_path text default '',
  photos jsonb not null default '[]'::jsonb,
  lineup jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  unique (user_id, event_key)
);

-- 6. BUCKET LIST (lista marzeń koncertowych — gotowe pod Krok 4)
create table if not exists public.bucket_list (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  artist text not null,
  priority smallint default 2 check (priority between 1 and 3),
  notes text default '',
  seen boolean default false,
  seen_concert_id bigint references public.concerts(id) on delete set null,
  created_at timestamptz default now()
);

-- 7. TRIP EXPENSES (rozliczenia wyjazdów ze znajomymi — gotowe pod Krok 4)
create table if not exists public.trip_expenses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  title text not null,
  amount_pln numeric(10,2) not null,
  paid_by text not null,
  split_with jsonb not null default '[]'::jsonb,
  settled boolean default false,
  created_at timestamptz default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — każdy użytkownik widzi i edytuje tylko swoje dane
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.cities_cache enable row level security;
alter table public.concerts enable row level security;
alter table public.upcoming_concerts enable row level security;
alter table public.events_meta enable row level security;
alter table public.bucket_list enable row level security;
alter table public.trip_expenses enable row level security;

-- Profiles
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Cities cache (odczyt dla wszystkich zalogowanych, dopisywanie dla zalogowanych)
drop policy if exists "cities_read_auth" on public.cities_cache;
create policy "cities_read_auth" on public.cities_cache
  for select to authenticated using (true);

drop policy if exists "cities_insert_auth" on public.cities_cache;
create policy "cities_insert_auth" on public.cities_cache
  for insert to authenticated with check (true);

-- Concerts
drop policy if exists "concerts_own" on public.concerts;
create policy "concerts_own" on public.concerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Upcoming
drop policy if exists "upcoming_own" on public.upcoming_concerts;
create policy "upcoming_own" on public.upcoming_concerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Events Meta
drop policy if exists "events_meta_own" on public.events_meta;
create policy "events_meta_own" on public.events_meta
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bucket List
drop policy if exists "bucket_list_own" on public.bucket_list;
create policy "bucket_list_own" on public.bucket_list
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trip Expenses
drop policy if exists "trip_expenses_own" on public.trip_expenses;
create policy "trip_expenses_own" on public.trip_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- SUPABASE STORAGE — buckety na zdjęcia/plakaty i prywatne bilety PDF
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', false)
on conflict (id) do nothing;

-- Dostęp tylko do własnego podfolderu: <user_id>/<plik>
drop policy if exists "event_media_own" on storage.objects;
create policy "event_media_own" on storage.objects
  for all to authenticated
  using (bucket_id = 'event-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'event-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "tickets_own" on storage.objects;
create policy "tickets_own" on storage.objects
  for all to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'tickets' and (storage.foldername(name))[1] = auth.uid()::text);
