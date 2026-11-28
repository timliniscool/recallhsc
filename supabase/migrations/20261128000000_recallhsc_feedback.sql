-- RecallHSC · feedback: marking-mistake reports and handwriting samples (beta)
-- ---------------------------------------------------------------------------------------------------
-- Write-only for the app: anyone (signed in or not) can ADD a row; nobody can read, change or delete rows
-- through the API. Only the project owner reads them, in the Supabase dashboard (service role).
--   kind 'marking'   : a student says a check was marked wrongly (expected words, their answer, a note)
--   kind 'hw_sample' : a handwriting check from a signed-in beta user who hasn't turned samples off
-- Rows of signed-in users are linked to their account and removed with it (ON DELETE CASCADE).
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid        default auth.uid() references auth.users (id) on delete cascade,
  kind        text        not null,
  reason      text,
  note        text,
  mode        text,
  task_type   text,
  expected    text,
  answer      text,
  read_text   text,
  ok          boolean,
  images      jsonb,
  device      text,
  app_version text,
  constraint feedback_kind        check (kind in ('marking','hw_sample')),
  constraint feedback_reason_len  check (reason is null or char_length(reason) <= 40),
  constraint feedback_note_len    check (note is null or char_length(note) <= 1000),
  constraint feedback_mode_len    check (mode is null or char_length(mode) <= 20),
  constraint feedback_task_len    check (task_type is null or char_length(task_type) <= 20),
  constraint feedback_text_len    check (char_length(coalesce(expected,'')) <= 20000 and char_length(coalesce(answer,'')) <= 20000
                                         and char_length(coalesce(read_text,'')) <= 20000),
  constraint feedback_images_size check (images is null or (jsonb_typeof(images) = 'array' and octet_length(images::text) <= 3000000)),
  constraint feedback_device_len  check (device is null or char_length(device) <= 60),
  constraint feedback_version_len check (app_version is null or char_length(app_version) <= 40)
);

alter table public.feedback enable row level security;
alter table public.feedback force row level security;

-- the API may only insert, and only as itself (or anonymously)
revoke all on public.feedback from anon, authenticated;
grant insert (user_id, kind, reason, note, mode, task_type, expected, answer, read_text, ok, images, device, app_version)
  on public.feedback to anon, authenticated;

drop policy if exists feedback_insert_anon on public.feedback;
create policy feedback_insert_anon on public.feedback for insert to anon
  with check (user_id is null);
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert to authenticated
  with check (user_id is null or user_id = auth.uid());
-- no select / update / delete policies: rows can't be read back or changed through the API

create index if not exists feedback_kind_created_idx on public.feedback (kind, created_at desc);
comment on table public.feedback is
  'RecallHSC marking-mistake reports and beta handwriting samples. Insert-only via the API; read in the dashboard.';
