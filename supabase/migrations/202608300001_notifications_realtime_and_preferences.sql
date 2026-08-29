-- Немедленная доставка событий и настройки подписок для аккаунта AniShiki.
-- Миграция идемпотентна: её можно применить после старой полной схемы.

alter table public.profiles
  add column if not exists is_episode_notifications_enabled boolean not null default true,
  add column if not exists is_related_release_notifications_enabled boolean not null default true,
  add column if not exists is_comment_notifications_enabled boolean not null default true,
  add column if not exists is_my_collection_comment_notifications_enabled boolean not null default true,
  add column if not exists is_report_process_notifications_enabled boolean not null default true;

-- Полный аналог privacy_* Anixart: 0 — всем, 1 — друзьям, 2 — никому.
-- В отличие от старых булевых флагов состояние «только друзьям» теперь
-- применяется и интерфейсом, и RLS правилами статистики.
alter table public.profiles
  add column if not exists privacy_stats smallint,
  add column if not exists privacy_counts smallint,
  add column if not exists privacy_social smallint,
  add column if not exists privacy_friend_requests smallint;

update public.profiles
set
  privacy_stats = coalesce(privacy_stats, case when is_stats_hidden then 2 else 0 end),
  privacy_counts = coalesce(privacy_counts, case when is_counts_hidden then 2 else 0 end),
  privacy_social = coalesce(privacy_social, case when is_social_hidden then 2 else 0 end),
  privacy_friend_requests = coalesce(privacy_friend_requests, case when is_friend_requests_disallowed then 2 else 0 end);

alter table public.profiles
  alter column privacy_stats set default 0,
  alter column privacy_counts set default 0,
  alter column privacy_social set default 0,
  alter column privacy_friend_requests set default 0,
  alter column privacy_stats set not null,
  alter column privacy_counts set not null,
  alter column privacy_social set not null,
  alter column privacy_friend_requests set not null;

alter table public.profiles
  drop constraint if exists profiles_privacy_stats_check,
  drop constraint if exists profiles_privacy_counts_check,
  drop constraint if exists profiles_privacy_social_check,
  drop constraint if exists profiles_privacy_friend_requests_check,
  add constraint profiles_privacy_stats_check check (privacy_stats between 0 and 2),
  add constraint profiles_privacy_counts_check check (privacy_counts between 0 and 2),
  add constraint profiles_privacy_social_check check (privacy_social between 0 and 2),
  add constraint profiles_privacy_friend_requests_check check (privacy_friend_requests in (0, 2));

-- Одинаковая проверка используется для списков, оценок, избранного, истории
-- и динамики.  Роль authenticated сама по себе недостаточна: доступ даёт
-- только владелец, «всем» или подтверждённая дружба.
drop policy if exists "favorites public read" on public.favorites;
drop policy if exists "favorites visible by privacy" on public.favorites;
create policy "favorites visible by privacy" on public.favorites for select using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = favorites.user_id and (
      p.privacy_stats = 0 or (
        p.privacy_stats = 1 and exists (
          select 1 from public.friendships f where f.status = 'accepted' and
            ((f.requester = auth.uid() and f.addressee = favorites.user_id) or
             (f.addressee = auth.uid() and f.requester = favorites.user_id))
        )
      )
    )
  )
);

drop policy if exists "lists public read" on public.lists;
drop policy if exists "lists visible by privacy" on public.lists;
create policy "lists visible by privacy" on public.lists for select using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = lists.user_id and (
      p.privacy_stats = 0 or (p.privacy_stats = 1 and exists (
        select 1 from public.friendships f where f.status = 'accepted' and
          ((f.requester = auth.uid() and f.addressee = lists.user_id) or
           (f.addressee = auth.uid() and f.requester = lists.user_id))
      ))
    )
  )
);

drop policy if exists "ratings public read" on public.ratings;
drop policy if exists "ratings visible by privacy" on public.ratings;
create policy "ratings visible by privacy" on public.ratings for select using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = ratings.user_id and (
      p.privacy_stats = 0 or (p.privacy_stats = 1 and exists (
        select 1 from public.friendships f where f.status = 'accepted' and
          ((f.requester = auth.uid() and f.addressee = ratings.user_id) or
           (f.addressee = auth.uid() and f.requester = ratings.user_id))
      ))
    )
  )
);

drop policy if exists "history visible by privacy" on public.history;
create policy "history visible by privacy" on public.history for select using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = history.user_id and (
      p.privacy_stats = 0 or (p.privacy_stats = 1 and exists (
        select 1 from public.friendships f where f.status = 'accepted' and
          ((f.requester = auth.uid() and f.addressee = history.user_id) or
           (f.addressee = auth.uid() and f.requester = history.user_id))
      ))
    )
  )
);

drop policy if exists "activity select own or friends" on public.activity;
drop policy if exists "activity visible by privacy" on public.activity;
create policy "activity visible by privacy" on public.activity for select using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = activity.user_id and (
      p.privacy_stats = 0 or (p.privacy_stats = 1 and exists (
        select 1 from public.friendships f where f.status = 'accepted' and
          ((f.requester = auth.uid() and f.addressee = activity.user_id) or
           (f.addressee = auth.uid() and f.requester = activity.user_id))
      ))
    )
  )
);

-- Realtime подписывается на INSERT только для текущего user_id, а RLS таблицы
-- notifications уже разрешает пользователю читать только собственные строки.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
