-- Полная схема аккаунта сайта AniShiki.
-- Снята с боевой базы и годится как сценарий развёртывания на чистом проекте:
-- применить целиком, затем перелить данные (см. README.md).

-- ── Профиль ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ── Избранное, списки, оценки, история ─────────────────────────────────────
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id integer not null,
  title text,
  image text,
  created_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

-- status: 1 смотрю, 2 в планах, 3 просмотрено, 4 отложено, 5 брошено
create table if not exists public.lists (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id integer not null,
  status smallint not null check (status between 1 and 5),
  title text,
  image text,
  updated_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

create table if not exists public.ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id integer not null,
  vote smallint not null check (vote between 1 and 10),
  title text,
  image text,
  updated_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

create table if not exists public.history (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id integer not null,
  title text,
  image text,
  episode_position integer,
  source_id integer,
  dubber_id integer,
  seconds real not null default 0 check (seconds >= 0),
  duration real not null default 0 check (duration >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

-- ── Соцчасть ───────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee),
  primary key (requester, addressee)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id integer not null,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('watch', 'rate', 'list')),
  release_id integer not null,
  title text,
  image text,
  meta text,
  created_at timestamptz not null default now()
);

-- ── Уведомления ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('friend_request', 'friend_accepted', 'comment', 'episode')),
  title text not null,
  body text,
  release_id integer,
  image text,
  url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Коллекции ──────────────────────────────────────────────────────────────
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 1000),
  cover text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  release_id integer not null,
  title text,
  image text,
  added_at timestamptz not null default now(),
  primary key (collection_id, release_id)
);

-- ── Индексы ────────────────────────────────────────────────────────────────
create index if not exists favorites_user_idx on public.favorites(user_id);
create index if not exists lists_user_idx on public.lists(user_id);
create index if not exists ratings_user_idx on public.ratings(user_id);
create index if not exists history_user_updated_idx on public.history(user_id, updated_at desc);
create index if not exists friendships_addressee_idx on public.friendships(addressee);
create index if not exists comments_release_created_idx on public.comments(release_id, created_at desc);
create index if not exists activity_user_created_idx on public.activity(user_id, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id) where is_read = false;
create index if not exists collections_user_idx on public.collections(user_id, updated_at desc);
create index if not exists collections_public_idx on public.collections(updated_at desc) where is_public;
create index if not exists collection_items_collection_idx on public.collection_items(collection_id, added_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.lists enable row level security;
alter table public.ratings enable row level security;
alter table public.history enable row level security;
alter table public.friendships enable row level security;
alter table public.comments enable row level security;
alter table public.activity enable row level security;
alter table public.notifications enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

-- Профиль виден всем, менять — только свой.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles insert" on public.profiles;
create policy "profiles insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update using (auth.uid() = id);

-- Списки, оценки и избранное показываются в публичном профиле.
-- История просмотра намеренно остаётся приватной.
drop policy if exists "favorites own" on public.favorites;
create policy "favorites own" on public.favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "favorites public read" on public.favorites;
create policy "favorites public read" on public.favorites for select using (true);

drop policy if exists "lists own" on public.lists;
create policy "lists own" on public.lists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lists public read" on public.lists;
create policy "lists public read" on public.lists for select using (true);

drop policy if exists "ratings own" on public.ratings;
create policy "ratings own" on public.ratings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ratings public read" on public.ratings;
create policy "ratings public read" on public.ratings for select using (true);

drop policy if exists "history own" on public.history;
create policy "history own" on public.history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Дружба: свои связи, заявку создаёт только сам отправитель.
drop policy if exists "fr select" on public.friendships;
create policy "fr select" on public.friendships for select
  using (auth.uid() = requester or auth.uid() = addressee);
drop policy if exists "fr insert" on public.friendships;
create policy "fr insert" on public.friendships for insert
  with check (auth.uid() = requester and requester <> addressee);
drop policy if exists "fr update" on public.friendships;
create policy "fr update" on public.friendships for update
  using (auth.uid() = addressee or auth.uid() = requester);
drop policy if exists "fr delete" on public.friendships;
create policy "fr delete" on public.friendships for delete
  using (auth.uid() = requester or auth.uid() = addressee);

drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select using (true);
drop policy if exists "comments insert" on public.comments;
create policy "comments insert" on public.comments for insert with check (auth.uid() = user_id);
drop policy if exists "comments delete" on public.comments;
create policy "comments delete" on public.comments for delete using (auth.uid() = user_id);

-- Активность видят автор и принятые друзья.
drop policy if exists "activity insert" on public.activity;
create policy "activity insert" on public.activity for insert with check (auth.uid() = user_id);
drop policy if exists "activity select own or friends" on public.activity;
create policy "activity select own or friends" on public.activity for select using (
  auth.uid() = user_id or exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = activity.user_id)
        or (f.addressee = auth.uid() and f.requester = activity.user_id))
  )
);

drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications for select using (auth.uid() = user_id);
-- Автор события подписывается собой: чужим именем уведомление не создать.
drop policy if exists "notifications insert as actor" on public.notifications;
create policy "notifications insert as actor" on public.notifications for insert
  with check (auth.uid() = actor_id or auth.uid() = user_id);
drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications delete own" on public.notifications for delete using (auth.uid() = user_id);

drop policy if exists "collections read public or own" on public.collections;
create policy "collections read public or own" on public.collections for select
  using (is_public or auth.uid() = user_id);
drop policy if exists "collections write own" on public.collections;
create policy "collections write own" on public.collections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "collection items read" on public.collection_items;
create policy "collection items read" on public.collection_items for select using (
  exists (select 1 from public.collections c
          where c.id = collection_id and (c.is_public or c.user_id = auth.uid()))
);
drop policy if exists "collection items write own" on public.collection_items;
create policy "collection items write own" on public.collection_items for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));

-- ── Хранилище аватаров ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
