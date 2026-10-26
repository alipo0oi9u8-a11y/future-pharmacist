begin;

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  import_key text unique check (import_key is null or length(import_key) between 1 and 160),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  chapter text not null check (length(chapter) between 1 and 160),
  prompt text not null check (length(prompt) between 1 and 1200),
  answer text not null check (length(answer) between 1 and 2400),
  is_sample boolean not null default false,
  is_published boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.flashcards is
  'Developer-managed study cards; sample cards remain explicitly labeled until faculty review.';

create table public.user_flashcard_reviews (
  user_id uuid not null references public.profiles (id) on delete cascade,
  flashcard_id uuid not null references public.flashcards (id) on delete cascade,
  due_at timestamptz not null default now(),
  interval_seconds integer not null default 0 check (interval_seconds >= 0),
  ease_factor numeric(3, 2) not null default 2.50 check (ease_factor between 1.30 and 3.00),
  repetitions integer not null default 0 check (repetitions >= 0),
  last_rating text check (last_rating is null or last_rating in ('again', 'good', 'easy')),
  updated_at timestamptz not null default now(),
  primary key (user_id, flashcard_id)
);
comment on table public.user_flashcard_reviews is
  'Private spaced-repetition schedule owned by one active user.';

create index flashcards_subject_chapter_idx on public.flashcards (subject_id, chapter);
create index user_flashcard_reviews_due_idx on public.user_flashcard_reviews (user_id, due_at);

alter table public.flashcards enable row level security;
alter table public.user_flashcard_reviews enable row level security;

-- Active users read published cards; only the developer can manage the shared bank.
create policy flashcards_read_published on public.flashcards
  for select to authenticated using (is_published and public.is_active_user());
comment on policy flashcards_read_published on public.flashcards is
  'Active users may read published cards only.';
create policy flashcards_developer_insert on public.flashcards
  for insert to authenticated with check (public.is_developer() and created_by = auth.uid());
comment on policy flashcards_developer_insert on public.flashcards is
  'Only the active developer may create shared flashcards as themselves.';
create policy flashcards_developer_update on public.flashcards
  for update to authenticated using (public.is_developer()) with check (public.is_developer());
comment on policy flashcards_developer_update on public.flashcards is
  'Only the active developer may edit or publish shared flashcards.';
create policy flashcards_developer_delete on public.flashcards
  for delete to authenticated using (public.is_developer());
comment on policy flashcards_developer_delete on public.flashcards is
  'Only the active developer may remove shared flashcards.';

-- Each account can read only its own spaced-repetition schedule.
create policy user_flashcard_reviews_read_self on public.user_flashcard_reviews
  for select to authenticated using (user_id = auth.uid() and public.is_active_user());
comment on policy user_flashcard_reviews_read_self on public.user_flashcard_reviews is
  'Users can read only their own spaced-repetition schedule.';

grant select on public.flashcards to authenticated;
grant insert, update, delete on public.flashcards to authenticated;
grant select on public.user_flashcard_reviews to authenticated;
revoke insert, update, delete on public.user_flashcard_reviews from anon, authenticated;

create or replace function public.review_flashcard(p_flashcard_id uuid, p_rating text)
returns table (due_at timestamptz, interval_seconds integer, repetitions integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous public.user_flashcard_reviews%rowtype;
  next_interval integer;
  next_repetitions integer;
  next_ease numeric(3, 2);
begin
  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_flashcard_id is null or p_rating is null or p_rating not in ('again', 'good', 'easy') then
    raise exception 'Choose a valid flashcard rating' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.flashcards f
    where f.id = p_flashcard_id and f.is_published
  ) then
    raise exception 'Published flashcard not found' using errcode = 'P0002';
  end if;

  select * into previous
  from public.user_flashcard_reviews r
  where r.user_id = auth.uid() and r.flashcard_id = p_flashcard_id
  for update;

  if p_rating = 'again' then
    next_interval := 600;
    next_repetitions := 0;
    next_ease := greatest(1.30, coalesce(previous.ease_factor, 2.50) - 0.20);
  elsif p_rating = 'good' then
    next_repetitions := coalesce(previous.repetitions, 0) + 1;
    next_interval := case
      when coalesce(previous.repetitions, 0) = 0 then 86400
      when previous.repetitions = 1 then 259200
      else greatest(86400, ceil(previous.interval_seconds * coalesce(previous.ease_factor, 2.50))::integer)
    end;
    next_ease := coalesce(previous.ease_factor, 2.50);
  else
    next_repetitions := coalesce(previous.repetitions, 0) + 1;
    next_interval := case
      when coalesce(previous.repetitions, 0) = 0 then 345600
      else greatest(86400, ceil(previous.interval_seconds * coalesce(previous.ease_factor, 2.50) * 1.30)::integer)
    end;
    next_ease := least(3.00, coalesce(previous.ease_factor, 2.50) + 0.15);
  end if;

  return query
  insert into public.user_flashcard_reviews as current_review (
    user_id, flashcard_id, due_at, interval_seconds, ease_factor, repetitions, last_rating, updated_at
  ) values (
    auth.uid(), p_flashcard_id, now() + make_interval(secs => next_interval),
    next_interval, next_ease, next_repetitions, p_rating, now()
  )
  on conflict (user_id, flashcard_id) do update set
    due_at = excluded.due_at,
    interval_seconds = excluded.interval_seconds,
    ease_factor = excluded.ease_factor,
    repetitions = excluded.repetitions,
    last_rating = excluded.last_rating,
    updated_at = now()
  returning current_review.due_at, current_review.interval_seconds, current_review.repetitions;
end;
$$;

revoke all on function public.review_flashcard(uuid, text) from public, anon;
grant execute on function public.review_flashcard(uuid, text) to authenticated;

insert into public.flashcards (id, import_key, subject_id, chapter, prompt, answer, is_sample, is_published, created_by)
select
  '62000000-0000-0000-0000-000000000001',
  'sample-study-reflection-v1',
  s.id,
  'Study strategies · sample',
  'What should you do before learning an unfamiliar textbook chapter?',
  'Preview the learning objective, then note unfamiliar terms.',
  true,
  true,
  p.id
from public.subjects s
cross join public.profiles p
where s.slug = 'biochemistry' and p.role = 'developer' and p.status = 'active'
on conflict (id) do nothing;

commit;
