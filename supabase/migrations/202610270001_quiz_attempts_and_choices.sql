begin;

alter table public.quizzes
  add column is_sample boolean not null default false,
  add column import_key text unique check (import_key is null or length(import_key) between 1 and 160);

alter table public.quiz_questions
  add column import_key text unique check (import_key is null or length(import_key) between 1 and 160);

comment on column public.quizzes.is_sample is
  'Sample content is visibly labeled Sample — not yet faculty reviewed.';

create table public.quiz_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  position smallint not null check (position between 0 and 7),
  choice_text text not null check (length(choice_text) between 1 and 500),
  is_correct boolean not null default false,
  unique (question_id, position)
);

comment on table public.quiz_choices is
  'Normalized quiz choices. Correctness is available only to trusted answer-checking functions.';

insert into public.quiz_choices (question_id, position, choice_text, is_correct)
select
  q.id,
  choice.ordinality::smallint - 1,
  choice.value,
  choice.ordinality::smallint - 1 = q.answer_index
from public.quiz_questions q
cross join lateral jsonb_array_elements_text(q.options) with ordinality as choice(value, ordinality)
on conflict (question_id, position) do nothing;

alter table public.quiz_attempt_answers
  add column attempt_id uuid;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quiz_id uuid references public.quizzes (id) on delete set null,
  mode text not null check (mode in ('standard', 'timed', 'daily-challenge', 'review-mistakes')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds between 30 and 7200),
  question_count integer not null default 0 check (question_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0 and correct_count <= question_count),
  constraint quiz_attempt_completion check (completed_at is null or completed_at >= started_at)
);

alter table public.quiz_attempt_answers
  add constraint quiz_attempt_answers_attempt_fk
    foreign key (attempt_id) references public.quiz_attempts (id) on delete cascade;

create index quiz_attempts_user_started_idx on public.quiz_attempts (user_id, started_at desc);
create index quiz_attempt_answers_attempt_idx on public.quiz_attempt_answers (attempt_id, answered_at);
create index quiz_choices_question_position_idx on public.quiz_choices (question_id, position);

alter table public.quiz_choices enable row level security;
alter table public.quiz_attempts enable row level security;

create or replace function public.sync_quiz_choices()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.quiz_choices where question_id = new.id;
  insert into public.quiz_choices (question_id, position, choice_text, is_correct)
  select new.id, choice.ordinality::smallint - 1, choice.value,
         choice.ordinality::smallint - 1 = new.answer_index
  from jsonb_array_elements_text(new.options) with ordinality as choice(value, ordinality);
  return new;
end;
$$;

create trigger quiz_question_choices_sync
  after insert or update of options, answer_index on public.quiz_questions
  for each row execute function public.sync_quiz_choices();

create or replace function public.can_read_quiz_choices(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user() and exists (
    select 1
    from public.quiz_questions q
    join public.quizzes z on z.id = q.quiz_id
    join public.subjects s on s.id = z.subject_id
    where q.id = p_question_id
      and q.status = 'approved'
      and z.is_published
      and s.is_active
  );
$$;

-- Only choice text for active, published quiz questions is readable; correctness is not a granted column.
create policy quiz_choices_read_published on public.quiz_choices
  for select to authenticated using (
    public.can_read_quiz_choices(question_id)
  );
comment on policy quiz_choices_read_published on public.quiz_choices is
  'Expose choice text for published approved questions only; correctness is never granted to clients.';

-- Each user reads only their own attempts; the developer may inspect all attempts for support.
create policy quiz_attempts_read_self_or_developer on public.quiz_attempts
  for select to authenticated using (user_id = auth.uid() or public.is_developer());
comment on policy quiz_attempts_read_self_or_developer on public.quiz_attempts is
  'Users may read only their own attempt metadata; only the active developer may read all attempts.';

grant select on public.quiz_attempts to authenticated;
grant select (id, question_id, position, choice_text) on public.quiz_choices to authenticated;
revoke insert, update, delete on public.quiz_choices, public.quiz_attempts from anon, authenticated;
revoke select (is_correct) on public.quiz_choices from anon, authenticated;

create or replace view public.quiz_questions_public as
select
  q.id,
  q.quiz_id,
  z.subject_id,
  s.name as subject,
  z.title as quiz_title,
  q.chapter,
  q.prompt,
  coalesce(
    (
      select jsonb_agg(c.choice_text order by c.position)
      from public.quiz_choices c
      where c.question_id = q.id
    ),
    q.options
  ) as options,
  z.is_sample
from public.quiz_questions q
join public.quizzes z on z.id = q.quiz_id and z.is_published
join public.subjects s on s.id = z.subject_id and s.is_active
where q.status = 'approved'
  and public.is_active_user();

comment on view public.quiz_questions_public is
  'Published approved quiz prompts and ordered choice text; never exposes correctness or answer explanations.';
grant select on public.quiz_questions_public to authenticated;

create or replace function public.start_quiz_attempt(
  p_mode text,
  p_quiz_id uuid default null,
  p_time_limit_seconds integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_attempt_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_mode is null or p_mode not in ('standard', 'timed', 'daily-challenge', 'review-mistakes') then
    raise exception 'Unsupported quiz mode' using errcode = '22023';
  end if;
  if p_mode = 'timed' and (p_time_limit_seconds is null or p_time_limit_seconds not between 30 and 7200) then
    raise exception 'Timed quizzes require a valid time limit' using errcode = '22023';
  end if;
  if p_mode <> 'timed' and p_time_limit_seconds is not null then
    raise exception 'Time limits apply only to timed quizzes' using errcode = '22023';
  end if;
  if p_quiz_id is not null and not exists (
    select 1 from public.quizzes z where z.id = p_quiz_id and z.is_published
  ) then
    raise exception 'Published quiz not found' using errcode = 'P0002';
  end if;

  insert into public.quiz_attempts (user_id, quiz_id, mode, time_limit_seconds)
  values (auth.uid(), p_quiz_id, p_mode, p_time_limit_seconds)
  returning id into new_attempt_id;
  return new_attempt_id;
end;
$$;

create or replace function public.submit_quiz_attempt_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_index smallint
)
returns table (correct boolean, explanation text, attempt_question_count integer, attempt_correct_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt_row public.quiz_attempts%rowtype;
  correct_answer boolean;
  choice_count integer;
  result_explanation text;
begin
  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_attempt_id is null or p_question_id is null or p_selected_index is null then
    raise exception 'Attempt, question, and selected choice are required' using errcode = '22023';
  end if;
  select * into attempt_row
  from public.quiz_attempts a
  where a.id = p_attempt_id and a.user_id = auth.uid()
  for update;
  if not found then
    raise exception 'Quiz attempt not found' using errcode = 'P0002';
  end if;
  if attempt_row.completed_at is not null then
    raise exception 'Quiz attempt is already complete' using errcode = '22023';
  end if;
  if attempt_row.time_limit_seconds is not null
     and now() > attempt_row.started_at + make_interval(secs => attempt_row.time_limit_seconds) then
    update public.quiz_attempts set completed_at = now() where id = attempt_row.id;
    raise exception 'Timed quiz has expired' using errcode = '22023';
  end if;
  select count(*)::integer,
         coalesce(bool_or(c.is_correct and c.position = p_selected_index), false),
         q.explanation
  into choice_count, correct_answer, result_explanation
  from public.quiz_questions q
  join public.quizzes z on z.id = q.quiz_id
  join public.quiz_choices c on c.question_id = q.id
  where q.id = p_question_id
    and q.status = 'approved'
    and z.is_published
    and (attempt_row.quiz_id is null or z.id = attempt_row.quiz_id)
  group by q.id;
  if not found then
    raise exception 'Published question not found' using errcode = 'P0002';
  end if;
  if p_selected_index < 0 or p_selected_index >= choice_count then
    raise exception 'Selected option is invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.quiz_attempt_answers a
    where a.attempt_id = p_attempt_id and a.question_id = p_question_id
  ) then
    raise exception 'Question already answered in this attempt' using errcode = '23505';
  end if;

  insert into public.quiz_attempt_answers (attempt_id, user_id, question_id, selected_index, is_correct)
  values (p_attempt_id, auth.uid(), p_question_id, p_selected_index, correct_answer);

  update public.quiz_attempts a
  set question_count = a.question_count + 1,
      correct_count = a.correct_count + case when correct_answer then 1 else 0 end
  where a.id = p_attempt_id
  returning a.question_count, a.correct_count into attempt_question_count, attempt_correct_count;

  return query select correct_answer, result_explanation, attempt_question_count, attempt_correct_count;
end;
$$;

create or replace function public.finish_quiz_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  update public.quiz_attempts
  set completed_at = now()
  where id = p_attempt_id
    and user_id = auth.uid()
    and completed_at is null;
  if not found then
    raise exception 'Open quiz attempt not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.start_quiz_attempt(text, uuid, integer) from public, anon;
revoke all on function public.submit_quiz_attempt_answer(uuid, uuid, smallint) from public, anon;
revoke all on function public.finish_quiz_attempt(uuid) from public, anon;
revoke all on function public.can_read_quiz_choices(uuid) from public, anon;
grant execute on function public.start_quiz_attempt(text, uuid, integer) to authenticated;
grant execute on function public.submit_quiz_attempt_answer(uuid, uuid, smallint) to authenticated;
grant execute on function public.finish_quiz_attempt(uuid) to authenticated;
grant execute on function public.can_read_quiz_choices(uuid) to authenticated;

commit;
