begin;

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('approved_note', 'announcement')),
  note_id uuid unique references public.notes (id) on delete cascade,
  announcement_id uuid unique references public.announcements (id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  message text not null default '' check (length(message) <= 1000),
  created_at timestamptz not null default now(),
  constraint notification_event_target check (
    (event_type = 'approved_note' and note_id is not null and announcement_id is null)
    or (event_type = 'announcement' and announcement_id is not null and note_id is null)
  )
);
comment on table public.notification_events is
  'Shared notification feed entries created by approved-note and published-announcement triggers.';

create table public.user_notification_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_id uuid not null references public.notification_events (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);
comment on table public.user_notification_reads is
  'Per-user read state; absence of a row means the notification is unread for that user.';

create index notification_events_created_idx on public.notification_events (created_at desc);
create index user_notification_reads_notification_idx on public.user_notification_reads (notification_id);

alter table public.notification_events enable row level security;
alter table public.user_notification_reads enable row level security;

-- Active accounts can read feed entries; only trusted database triggers create them.
create policy notification_events_read_active on public.notification_events
  for select to authenticated using (public.is_active_user());
comment on policy notification_events_read_active on public.notification_events is
  'Active accounts may read shared notifications; there is no client write policy.';

-- Each active account can read only its own notification read state.
create policy user_notification_reads_read_self on public.user_notification_reads
  for select to authenticated using (user_id = auth.uid() and public.is_active_user());
comment on policy user_notification_reads_read_self on public.user_notification_reads is
  'An active account may read only its own read/unread state.';

revoke all on public.notification_events, public.user_notification_reads from anon, authenticated;
grant select on public.notification_events, public.user_notification_reads to authenticated;

create or replace function public.create_approved_note_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.notification_events (event_type, note_id, title, message)
    values ('approved_note', new.id, new.topic, new.chapter)
    on conflict (note_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.create_approved_note_notification() from public, anon, authenticated;
create trigger approved_note_notification
after update of status on public.notes
for each row execute function public.create_approved_note_notification();

create or replace function public.create_announcement_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.published_at is not null and (tg_op = 'INSERT' or old.published_at is null) then
    insert into public.notification_events (event_type, announcement_id, title, message)
    values ('announcement', new.id, new.title, new.body)
    on conflict (announcement_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.create_announcement_notification() from public, anon, authenticated;
create trigger published_announcement_notification
after insert or update on public.announcements
for each row execute function public.create_announcement_notification();

create or replace function public.mark_notification_read(p_notification_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  marked_count integer;
begin
  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  if p_notification_id is null then
    insert into public.user_notification_reads (user_id, notification_id, read_at)
    select auth.uid(), n.id, now() from public.notification_events n
    on conflict (user_id, notification_id) do update set read_at = excluded.read_at;
  else
    if not exists (select 1 from public.notification_events n where n.id = p_notification_id) then
      raise exception 'Notification not found' using errcode = 'P0002';
    end if;
    insert into public.user_notification_reads (user_id, notification_id, read_at)
    values (auth.uid(), p_notification_id, now())
    on conflict (user_id, notification_id) do update set read_at = excluded.read_at;
  end if;
  get diagnostics marked_count = row_count;
  return marked_count;
end;
$$;
revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

commit;
