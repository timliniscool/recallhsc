-- =====================================================================================================
-- RecallHSC optional cloud sync · schema version 1
-- =====================================================================================================
-- Apply with the Supabase SQL editor (paste and run) or `supabase db push`. Safe to re-run: tables use
-- IF NOT EXISTS, policies are dropped before being re-created, functions use CREATE OR REPLACE.
--
-- Security model
--   * Every row belongs to exactly one auth user (user_id, defaulting to auth.uid()).
--   * Row Level Security is ENABLED and FORCED on every table. Only the `authenticated` role has
--     policies, and each policy is restricted to auth.uid() = user_id. The `anon` role has no table
--     privileges at all, so the public (publishable / anon) key alone can read or write nothing.
--   * updated_at is always set by the server clock (trigger), so a device with a wrong clock cannot
--     reorder history, and user_id can never be changed on an existing row.
--   * public.delete_my_account() lets a signed-in user erase all of their data and their auth user.
--
-- What is stored (see docs/CLOUD_SYNC.md): essay title/text/type, learned-sentence flags and position,
-- per-device aggregate statistics, preferences. Raw keystroke timings are never uploaded.
-- =====================================================================================================

-- ---------------------------------------------------------------------------------------------------
-- Schema version marker (one row per applied version; the client may read it to detect drift).
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.recallhsc_schema (
  version    int primary key,
  applied_at timestamptz not null default now()
);
comment on table public.recallhsc_schema is 'RecallHSC cloud-sync schema version marker. Current version: 1.';
insert into public.recallhsc_schema (version) values (1) on conflict (version) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- essays: one row per (user, essay). Deleted essays stay as tombstones (deleted = true, body cleared
-- by the client) so the deletion propagates to the user's other devices.
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.essays (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  essay_id    text        not null,
  title       text        not null default '',
  body        text        not null default '',
  kind        text        not null default 'essay',
  rev         text        not null default '',
  ver         int         not null default 0,
  deleted     boolean     not null default false,
  deleted_ver int,
  device_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, essay_id),
  constraint essays_essay_id_format check (essay_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint essays_title_len       check (char_length(title) <= 60),
  constraint essays_body_len        check (char_length(body) <= 200000),
  constraint essays_kind_valid      check (kind in ('essay', 'creative')),
  constraint essays_rev_len         check (char_length(rev) <= 64),
  constraint essays_ver_nonneg      check (ver >= 0),
  constraint essays_deleted_ver     check (deleted_ver is null or deleted_ver >= 0),
  constraint essays_device_id_len   check (device_id is null or char_length(device_id) <= 64)
);
comment on table public.essays is 'RecallHSC essay library, one row per user essay (soft-deleted rows are tombstones).';

-- ---------------------------------------------------------------------------------------------------
-- progress: learning progress for one essay revision. Keyed by rev so sentence flags are never applied
-- to a different version of the text. epoch increments on every intentional "Reset progress".
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.progress (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  essay_id   text        not null,
  rev        text        not null,
  epoch      int         not null default 0,
  learned    text        not null default '',
  g          int         not null default 0,
  ti         int         not null default 0,
  start_g    int         not null default 0,
  part       jsonb,
  game       jsonb,
  device_id  text,
  updated_at timestamptz not null default now(),
  primary key (user_id, essay_id, rev),
  constraint progress_essay_id_format check (essay_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint progress_rev_len         check (char_length(rev) between 1 and 64),
  constraint progress_epoch_nonneg    check (epoch >= 0),
  constraint progress_learned_bits    check (char_length(learned) <= 20000 and learned ~ '^[01]*$'),
  constraint progress_position        check (g >= 0 and ti >= 0 and start_g >= 0),
  constraint progress_part_size       check (part is null or octet_length(part::text) <= 1000),
  constraint progress_game_size       check (game is null or octet_length(game::text) <= 100000),
  constraint progress_device_id_len   check (device_id is null or char_length(device_id) <= 64)
);
comment on table public.progress is 'RecallHSC per-essay-revision learning progress (sentence flags as a 0/1 bitstring).';

-- ---------------------------------------------------------------------------------------------------
-- stats: aggregate statistics, one row per (user, essay, device). Each device only ever writes its own
-- contribution, so totals are computed client-side by summing rows without double counting.
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.stats (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  essay_id   text        not null,
  device_id  text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, essay_id, device_id),
  constraint stats_essay_id_format check (essay_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint stats_device_id_len   check (char_length(device_id) between 1 and 64),
  constraint stats_data_object     check (jsonb_typeof(data) = 'object'),
  constraint stats_data_size       check (octet_length(data::text) <= 200000)
);
comment on table public.stats is 'RecallHSC per-device aggregate statistics for one essay (no keystroke timings).';

-- ---------------------------------------------------------------------------------------------------
-- prefs: one settings document per user.
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.prefs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint prefs_data_object check (jsonb_typeof(data) = 'object'),
  constraint prefs_data_size   check (octet_length(data::text) <= 50000)
);
comment on table public.prefs is 'RecallHSC per-user preferences document.';

-- ---------------------------------------------------------------------------------------------------
-- Indexes for incremental pulls ("give me everything changed since T").
-- ---------------------------------------------------------------------------------------------------
create index if not exists essays_user_updated_idx   on public.essays   (user_id, updated_at);
create index if not exists progress_user_updated_idx on public.progress (user_id, updated_at);
create index if not exists stats_user_updated_idx    on public.stats    (user_id, updated_at);
create index if not exists prefs_user_updated_idx    on public.prefs    (user_id, updated_at);

-- ---------------------------------------------------------------------------------------------------
-- Trigger: server-side updated_at and immutable ownership.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.recallhsc_touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- essays additionally keep their original created_at (a client cannot rewrite it on update).
create or replace function public.recallhsc_touch_essay()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists recallhsc_touch on public.essays;
create trigger recallhsc_touch before insert or update on public.essays
  for each row execute function public.recallhsc_touch_row();
drop trigger if exists recallhsc_touch_created on public.essays;
create trigger recallhsc_touch_created before update on public.essays
  for each row execute function public.recallhsc_touch_essay();

drop trigger if exists recallhsc_touch on public.progress;
create trigger recallhsc_touch before insert or update on public.progress
  for each row execute function public.recallhsc_touch_row();

drop trigger if exists recallhsc_touch on public.stats;
create trigger recallhsc_touch before insert or update on public.stats
  for each row execute function public.recallhsc_touch_row();

drop trigger if exists recallhsc_touch on public.prefs;
create trigger recallhsc_touch before insert or update on public.prefs
  for each row execute function public.recallhsc_touch_row();

-- Trigger functions are not meant to be called directly.
revoke execute on function public.recallhsc_touch_row()   from public, anon, authenticated;
revoke execute on function public.recallhsc_touch_essay() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Privileges: no anon access at all; authenticated users get DML, narrowed further by RLS.
-- ---------------------------------------------------------------------------------------------------
revoke all on public.essays, public.progress, public.stats, public.prefs, public.recallhsc_schema from anon;
revoke all on public.essays, public.progress, public.stats, public.prefs, public.recallhsc_schema from public;
grant select, insert, update, delete on public.essays, public.progress, public.stats, public.prefs to authenticated;
revoke all on public.recallhsc_schema from authenticated;
grant select on public.recallhsc_schema to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------------
alter table public.essays           enable row level security;
alter table public.essays           force  row level security;
alter table public.progress         enable row level security;
alter table public.progress         force  row level security;
alter table public.stats            enable row level security;
alter table public.stats            force  row level security;
alter table public.prefs            enable row level security;
alter table public.prefs            force  row level security;
alter table public.recallhsc_schema enable row level security;
alter table public.recallhsc_schema force  row level security;

-- essays
drop policy if exists essays_select_own on public.essays;
drop policy if exists essays_insert_own on public.essays;
drop policy if exists essays_update_own on public.essays;
drop policy if exists essays_delete_own on public.essays;
create policy essays_select_own on public.essays for select to authenticated
  using ((select auth.uid()) = user_id);
create policy essays_insert_own on public.essays for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy essays_update_own on public.essays for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy essays_delete_own on public.essays for delete to authenticated
  using ((select auth.uid()) = user_id);

-- progress
drop policy if exists progress_select_own on public.progress;
drop policy if exists progress_insert_own on public.progress;
drop policy if exists progress_update_own on public.progress;
drop policy if exists progress_delete_own on public.progress;
create policy progress_select_own on public.progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy progress_insert_own on public.progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy progress_update_own on public.progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy progress_delete_own on public.progress for delete to authenticated
  using ((select auth.uid()) = user_id);

-- stats
drop policy if exists stats_select_own on public.stats;
drop policy if exists stats_insert_own on public.stats;
drop policy if exists stats_update_own on public.stats;
drop policy if exists stats_delete_own on public.stats;
create policy stats_select_own on public.stats for select to authenticated
  using ((select auth.uid()) = user_id);
create policy stats_insert_own on public.stats for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy stats_update_own on public.stats for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy stats_delete_own on public.stats for delete to authenticated
  using ((select auth.uid()) = user_id);

-- prefs
drop policy if exists prefs_select_own on public.prefs;
drop policy if exists prefs_insert_own on public.prefs;
drop policy if exists prefs_update_own on public.prefs;
drop policy if exists prefs_delete_own on public.prefs;
create policy prefs_select_own on public.prefs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy prefs_insert_own on public.prefs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy prefs_update_own on public.prefs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy prefs_delete_own on public.prefs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- schema marker: readable by signed-in users, never writable through the API.
drop policy if exists recallhsc_schema_select on public.recallhsc_schema;
create policy recallhsc_schema_select on public.recallhsc_schema for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------------------------------
-- Account deletion: removes every RecallHSC row of the caller, then the caller's auth user.
-- SECURITY DEFINER is required to delete from auth.users; the body only ever touches auth.uid()'s rows.
-- Note: because RLS is FORCED, the explicit deletes below only remove rows if the function owner can
-- bypass RLS (the Supabase `postgres` role can). Either way the final delete from auth.users removes
-- everything, because every table references auth.users ON DELETE CASCADE and referential actions are
-- not subject to row security.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from public.progress where user_id = uid;
  delete from public.stats    where user_id = uid;
  delete from public.prefs    where user_id = uid;
  delete from public.essays   where user_id = uid;
  delete from auth.users      where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
comment on function public.delete_my_account() is
  'Deletes all RecallHSC cloud data of the calling user and their auth account. Irreversible.';
