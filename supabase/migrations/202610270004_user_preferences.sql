begin;

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  reduce_animations boolean not null default false,
  sound_enabled boolean not null default false,
  leaderboard_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table public.user_preferences is
  'Per-account presentation and optional leaderboard preferences; leaderboard participation defaults off.';

alter table public.user_preferences enable row level security;

-- Each active account can read only its own preferences.
create policy user_preferences_read_self on public.user_preferences
  for select to authenticated using (user_id = auth.uid() and public.is_active_user());
comment on policy user_preferences_read_self on public.user_preferences is
  'An active user may read only their own preference row.';

revoke all on public.user_preferences from anon, authenticated;
grant select on public.user_preferences to authenticated;

create or replace function public.save_user_preferences(
  p_theme text default null,
  p_reduce_animations boolean default null,
  p_sound_enabled boolean default null,
  p_leaderboard_opt_in boolean default null
)
returns public.user_preferences
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_preferences public.user_preferences%rowtype;
begin
  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_theme is not null and p_theme not in ('dark', 'light') then
    raise exception 'Theme must be dark or light' using errcode = '22023';
  end if;
  if p_theme is null and p_reduce_animations is null
     and p_sound_enabled is null and p_leaderboard_opt_in is null then
    raise exception 'At least one preference is required' using errcode = '22023';
  end if;

  insert into public.user_preferences (
    user_id, theme, reduce_animations, sound_enabled, leaderboard_opt_in
  ) values (
    auth.uid(),
    coalesce(p_theme, 'dark'),
    coalesce(p_reduce_animations, false),
    coalesce(p_sound_enabled, false),
    coalesce(p_leaderboard_opt_in, false)
  )
  on conflict (user_id) do update set
    theme = coalesce(p_theme, public.user_preferences.theme),
    reduce_animations = coalesce(p_reduce_animations, public.user_preferences.reduce_animations),
    sound_enabled = coalesce(p_sound_enabled, public.user_preferences.sound_enabled),
    leaderboard_opt_in = coalesce(p_leaderboard_opt_in, public.user_preferences.leaderboard_opt_in),
    updated_at = now()
  returning * into saved_preferences;

  return saved_preferences;
end;
$$;
revoke all on function public.save_user_preferences(text, boolean, boolean, boolean) from public, anon;
grant execute on function public.save_user_preferences(text, boolean, boolean, boolean) to authenticated;

commit;
