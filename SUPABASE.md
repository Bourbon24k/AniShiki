# Настройка Supabase (аккаунт AniShiki + совместный просмотр)

Эти фичи опциональны. Пока ключи не заданы — сайт работает как раньше
(только вход через Anixart), а кнопки аккаунта сайта и совместного просмотра скрыты.

## 1. Создать проект

1. Зайти на https://supabase.com → **New project** (бесплатный тариф).
2. После создания: **Project Settings → API** скопировать:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## 2. Прописать ключи

**Локально:** создать файл `.env` (см. `.env.example`):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**На Vercel:** Project → Settings → Environment Variables — добавить те же две
переменные, затем Redeploy.

## 3. Создать таблицу профилей

Supabase Dashboard → **SQL Editor** → выполнить:

```sql
-- Профили пользователей сайта
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Профили видны всем, редактировать может только владелец
create policy "profiles read"   on public.profiles for select using (true);
create policy "profiles insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update" on public.profiles for update using (auth.uid() = id);

-- Автосоздание профиля при регистрации (username из метаданных)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

## 4. (Опц.) Отключить подтверждение email для быстрой регистрации

Dashboard → **Authentication → Providers → Email** → выключить
*Confirm email*, если хочешь, чтобы аккаунт активировался сразу без письма.

## Что включится

- **Регистрация/вход на сайте** — вкладка «Аккаунт сайта» на `/login` и форма на `/register`.
- **Совместный просмотр** — кнопка «Создать комнату» в плеере: общая ссылка,
  синхронизация play/pause/перемотки/серии и чат. Работает через Supabase
  Realtime (включён по умолчанию, отдельная настройка не нужна).
