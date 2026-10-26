begin;

create table public.user_xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  xp integer not null check (xp between 1 and 100),
  created_at timestamptz not null default now()
);
comment on table public.user_xp_events is
  'Immutable positive XP awards used to calculate current-week opt-in leaderboard totals.';
create index user_xp_events_user_created_idx on public.user_xp_events (user_id, created_at desc);
create index user_xp_events_created_idx on public.user_xp_events (created_at desc);

alter table public.user_xp_events enable row level security;

-- Users can read only their own XP award history; database triggers alone write events.
create policy user_xp_events_read_self on public.user_xp_events
  for select to authenticated using (user_id = auth.uid() and public.is_active_user());
comment on policy user_xp_events_read_self on public.user_xp_events is
  'An active user may read only their own XP events; there is no client write policy.';

revoke all on public.user_xp_events from anon, authenticated;
grant select on public.user_xp_events to authenticated;

create or replace function public.record_xp_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  awarded_xp integer;
begin
  if tg_op = 'INSERT' then
    awarded_xp := new.xp;
  else
    awarded_xp := new.xp - old.xp;
  end if;
  if awarded_xp > 0 then
    insert into public.user_xp_events (user_id, xp)
    values (new.user_id, awarded_xp);
  end if;
  return new;
end;
$$;
revoke all on function public.record_xp_event() from public, anon, authenticated;
create trigger user_progress_xp_event
after insert or update on public.user_progress
for each row execute function public.record_xp_event();

create or replace function public.weekly_leaderboard()
returns table (display_name text, weekly_xp integer, rank_position bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  return query
  with totals as (
    select p.id as profile_id,
           coalesce(nullif(trim(p.full_name), ''), 'Study partner') as name,
           sum(e.xp)::integer as points
    from public.user_xp_events e
    join public.profiles p on p.id = e.user_id and p.status = 'active'
    join public.user_preferences preferences
      on preferences.user_id = p.id and preferences.leaderboard_opt_in
    where e.created_at >= (date_trunc('week', timezone('UTC', now())) at time zone 'UTC')
    group by p.id, p.full_name
  )
  select totals.name,
         totals.points,
         row_number() over (order by totals.points desc, totals.name asc, totals.profile_id asc)
  from totals
  order by totals.points desc, totals.name asc, totals.profile_id asc
  limit 100;
end;
$$;
revoke all on function public.weekly_leaderboard() from public, anon;
grant execute on function public.weekly_leaderboard() to authenticated;

commit;
