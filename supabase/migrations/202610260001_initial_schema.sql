create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('developer', 'teacher', 'student');
create type public.profile_status as enum ('invited', 'active', 'disabled');
create type public.note_status as enum ('pending', 'approved', 'rejected');
create type public.content_kind as enum ('note', 'quiz');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'student',
  status public.profile_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email = lower(email))
);

create unique index profiles_single_developer on public.profiles (role)
  where role = 'developer';

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (length(name) between 1 and 100),
  accent_color text not null check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.contribution_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_type public.content_kind not null,
  granted_by uuid not null references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, content_type),
  constraint permission_granted_by_developer check (granted_by is not null)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  title text not null check (length(title) between 1 and 200),
  author text not null default '' check (length(author) <= 200),
  edition text not null default '' check (length(edition) <= 80),
  description text not null default '' check (length(description) <= 1200),
  image_path text,
  price_amount numeric(12, 2) check (price_amount is null or price_amount >= 0),
  price_currency char(3) check (price_currency is null or price_currency ~ '^[A-Z]{3}$'),
  buy_url text check (buy_url is null or buy_url ~ '^https://[^[:space:]]+$'),
  price_verified_at date,
  course_confirmed boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_price_currency_pair check ((price_amount is null) = (price_currency is null))
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  book_id uuid not null references public.books (id) on delete restrict,
  chapter text not null check (length(chapter) between 1 and 160),
  topic text not null check (length(topic) between 1 and 160),
  docs_url text check (
    docs_url is null
    or docs_url ~ '^https://docs\.google\.com/document/d/[^/?#]+([/?#].*)?$'
  ),
  submitted_by uuid not null references public.profiles (id),
  status public.note_status not null default 'pending',
  reviewer_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(rejection_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_review_metadata check (
    (status = 'pending' and reviewer_id is null and reviewed_at is null and rejection_reason is null)
    or (status = 'approved' and reviewer_id is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and reviewer_id is not null and reviewed_at is not null)
  )
);
create index notes_public_subject_idx on public.notes (subject_id, book_id, chapter) where status = 'approved';
create index notes_review_queue_idx on public.notes (created_at) where status = 'pending';

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  title text not null check (length(title) between 1 and 160),
  description text not null default '' check (length(description) <= 1000),
  is_published boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  chapter text not null check (length(chapter) between 1 and 160),
  prompt text not null check (length(prompt) between 1 and 1200),
  options jsonb not null check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 8
  ),
  answer_index smallint not null check (answer_index >= 0 and answer_index < jsonb_array_length(options)),
  explanation text not null default '' check (length(explanation) <= 1600),
  status public.note_status not null default 'pending',
  submitted_by uuid not null references public.profiles (id),
  reviewer_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(rejection_reason) <= 1000),
  created_at timestamptz not null default now(),
  constraint quiz_question_review_metadata check (
    (status = 'pending' and reviewer_id is null and reviewed_at is null and rejection_reason is null)
    or (status = 'approved' and reviewer_id is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and reviewer_id is not null and reviewed_at is not null)
  )
);
create index quiz_questions_review_idx on public.quiz_questions (created_at) where status = 'pending';

create table public.quiz_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  selected_index smallint not null check (selected_index >= 0),
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);
create index quiz_attempt_answers_user_idx on public.quiz_attempt_answers (user_id, answered_at desc);

create table public.user_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= current_streak),
  last_studied_on date,
  daily_goal_minutes integer not null default 25 check (daily_goal_minutes between 5 and 480),
  updated_at timestamptz not null default now()
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (length(name) between 1 and 100),
  description text not null default '' check (length(description) <= 500),
  is_active boolean not null default true
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, note_id)
);

create table public.note_reactions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  helpful boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, note_id)
);

create table public.note_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  reason text not null check (length(reason) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  unique (user_id, note_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 4000),
  published_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.exam_dates (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (length(title) between 1 and 160),
  details text not null default '' check (length(details) <= 1000),
  starts_at timestamptz not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (length(action) between 1 and 100),
  entity_type text not null check (length(entity_type) between 1 and 80),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'developer' and p.status = 'active'
  );
$$;

create or replace function public.can_submit_content(p_kind public.content_kind)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_developer()
    or (
      public.is_active_user()
      and exists (
        select 1 from public.contribution_permissions cp
        where cp.user_id = auth.uid() and cp.content_type = p_kind
      )
    );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student',
    'invited'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.activate_my_profile()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  update public.profiles
  set status = 'active', updated_at = now()
  where id = auth.uid() and status = 'invited';
  if not found and not public.is_active_user() then
    raise exception 'This account is not active' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.record_audit_event(
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_actor_id is null or not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'developer' and status = 'active'
  ) then
    raise exception 'Active developer actor required' using errcode = '42501';
  end if;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

create or replace function public.owner_apply_invited_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_role public.app_role,
  p_can_submit_notes boolean,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_role not in ('teacher', 'student') then
    raise exception 'Only teacher or student invitations are allowed' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'developer' and status = 'active'
  ) then
    raise exception 'Active developer actor required' using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name, role, status)
  values (p_user_id, lower(p_email), p_full_name, p_role, 'invited')
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        status = 'invited',
        updated_at = now();

  if p_can_submit_notes then
    insert into public.contribution_permissions (user_id, content_type, granted_by)
    values (p_user_id, 'note', p_actor_id)
    on conflict (user_id, content_type) do update
      set granted_by = excluded.granted_by, granted_at = now();
  else
    delete from public.contribution_permissions
    where user_id = p_user_id and content_type = 'note';
  end if;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_id,
    'member.invited',
    'profile',
    p_user_id::text,
    jsonb_build_object('role', p_role, 'can_submit_notes', p_can_submit_notes)
  );
end;
$$;

create or replace function public.owner_update_member(
  p_user_id uuid,
  p_role public.app_role,
  p_can_submit_notes boolean,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_role public.app_role;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_role not in ('teacher', 'student') or p_user_id = p_actor_id then
    raise exception 'Invalid member role change' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'developer' and status = 'active'
  ) then
    raise exception 'Active developer actor required' using errcode = '42501';
  end if;

  select role into old_role from public.profiles where id = p_user_id for update;
  if not found or old_role = 'developer' then
    raise exception 'Member not found or not manageable' using errcode = 'P0002';
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_user_id;
  if p_can_submit_notes then
    insert into public.contribution_permissions (user_id, content_type, granted_by)
    values (p_user_id, 'note', p_actor_id)
    on conflict (user_id, content_type) do update
      set granted_by = excluded.granted_by, granted_at = now();
  else
    delete from public.contribution_permissions
    where user_id = p_user_id and content_type = 'note';
  end if;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_id,
    'member.permissions_updated',
    'profile',
    p_user_id::text,
    jsonb_build_object('previous_role', old_role, 'role', p_role, 'can_submit_notes', p_can_submit_notes)
  );
end;
$$;

create or replace function public.review_note(
  p_note_id uuid,
  p_status public.note_status,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_developer() then
    raise exception 'Developer permission required' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected' using errcode = '22023';
  end if;
  if p_status = 'rejected' and nullif(trim(p_rejection_reason), '') is null then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;
  update public.notes
  set status = p_status,
      reviewer_id = auth.uid(),
      reviewed_at = now(),
      rejection_reason = case when p_status = 'rejected' then left(trim(p_rejection_reason), 1000) else null end,
      updated_at = now()
  where id = p_note_id and status = 'pending';
  if not found then
    raise exception 'Pending note not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.review_quiz_question(
  p_question_id uuid,
  p_status public.note_status,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_developer() then
    raise exception 'Developer permission required' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected' using errcode = '22023';
  end if;
  if p_status = 'rejected' and nullif(trim(p_rejection_reason), '') is null then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;
  update public.quiz_questions
  set status = p_status,
      reviewer_id = auth.uid(),
      reviewed_at = now(),
      rejection_reason = case when p_status = 'rejected' then left(trim(p_rejection_reason), 1000) else null end
  where id = p_question_id and status = 'pending';
  if not found then
    raise exception 'Pending quiz question not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.submit_quiz_answer(p_question_id uuid, p_selected_index smallint)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  answer smallint;
  option_count integer;
  correct boolean;
begin
  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  select q.answer_index, jsonb_array_length(q.options)
  into answer, option_count
  from public.quiz_questions q
  join public.quizzes z on z.id = q.quiz_id
  where q.id = p_question_id and q.status = 'approved' and z.is_published;
  if not found then
    raise exception 'Published question not found' using errcode = 'P0002';
  end if;
  if p_selected_index < 0 or p_selected_index >= option_count then
    raise exception 'Selected option is invalid' using errcode = '22023';
  end if;
  correct := p_selected_index = answer;
  insert into public.quiz_attempt_answers (user_id, question_id, selected_index, is_correct)
  values (auth.uid(), p_question_id, p_selected_index, correct);
  insert into public.user_progress (user_id, xp, current_streak, longest_streak, last_studied_on)
  values (auth.uid(), case when correct then 10 else 0 end, 1, 1, current_date)
  on conflict (user_id) do update set
    xp = public.user_progress.xp + case when correct then 10 else 0 end,
    current_streak = case
      when public.user_progress.last_studied_on = current_date then public.user_progress.current_streak
      when public.user_progress.last_studied_on = current_date - 1 then public.user_progress.current_streak + 1
      else 1
    end,
    longest_streak = greatest(
      public.user_progress.longest_streak,
      case
        when public.user_progress.last_studied_on = current_date then public.user_progress.current_streak
        when public.user_progress.last_studied_on = current_date - 1 then public.user_progress.current_streak + 1
        else 1
      end
    ),
    last_studied_on = current_date,
    updated_at = now();
  return correct;
end;
$$;

create or replace function public.audit_note_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'note.' || new.status::text,
      'note',
      new.id::text,
      jsonb_build_object('submitted_by', new.submitted_by, 'rejection_reason', new.rejection_reason)
    );
  end if;
  return new;
end;
$$;
create trigger notes_review_audit
  after update of status on public.notes
  for each row execute function public.audit_note_review();

create or replace function public.audit_quiz_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'quiz_question.' || new.status::text,
      'quiz_question',
      new.id::text,
      jsonb_build_object('submitted_by', new.submitted_by, 'rejection_reason', new.rejection_reason)
    );
  end if;
  return new;
end;
$$;
create trigger quiz_questions_review_audit
  after update of status on public.quiz_questions
  for each row execute function public.audit_quiz_review();

create view public.notes_public as
select
  n.id,
  n.subject_id,
  s.name as subject,
  n.book_id,
  b.title as book,
  n.chapter,
  n.topic,
  n.docs_url,
  p.full_name as submitted_by,
  n.created_at,
  count(distinct r.user_id)::integer as helpful_count
from public.notes n
join public.subjects s on s.id = n.subject_id and s.is_active
join public.books b on b.id = n.book_id and b.is_active
join public.profiles p on p.id = n.submitted_by
left join public.note_reactions r on r.note_id = n.id and r.helpful
where n.status = 'approved'
group by n.id, s.name, b.title, p.full_name;

create view public.quiz_questions_public as
select
  q.id,
  q.quiz_id,
  z.subject_id,
  s.name as subject,
  z.title as quiz_title,
  q.chapter,
  q.prompt,
  q.options
from public.quiz_questions q
join public.quizzes z on z.id = q.quiz_id and z.is_published
join public.subjects s on s.id = z.subject_id and s.is_active
where q.status = 'approved';

create view public.member_summary as
select
  p.id,
  p.full_name,
  p.email,
  p.role,
  p.status,
  exists (
    select 1 from public.contribution_permissions cp
    where cp.user_id = p.id and cp.content_type = 'note'
  ) as can_submit_notes,
  exists (
    select 1 from public.contribution_permissions cp
    where cp.user_id = p.id and cp.content_type = 'quiz'
  ) as can_submit_quizzes
from public.profiles p;

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.contribution_permissions enable row level security;
alter table public.books enable row level security;
alter table public.notes enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempt_answers enable row level security;
alter table public.user_progress enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.bookmarks enable row level security;
alter table public.note_reactions enable row level security;
alter table public.note_reports enable row level security;
alter table public.announcements enable row level security;
alter table public.exam_dates enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_self_or_developer on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_developer());
create policy subjects_read_active_or_developer on public.subjects
  for select to authenticated using (is_active or public.is_developer());
create policy contribution_permissions_read_self_or_developer on public.contribution_permissions
  for select to authenticated using (user_id = auth.uid() or public.is_developer());
create policy books_read_active_or_developer on public.books
  for select to authenticated using ((is_active and public.is_active_user()) or public.is_developer());
create policy books_owner_insert on public.books
  for insert to authenticated with check (public.is_developer());
create policy books_owner_update on public.books
  for update to authenticated using (public.is_developer()) with check (public.is_developer());
create policy books_owner_delete on public.books
  for delete to authenticated using (public.is_developer());
create policy notes_read_approved_or_developer on public.notes
  for select to authenticated using ((status = 'approved' and public.is_active_user()) or public.is_developer());
create policy notes_submit_pending on public.notes
  for insert to authenticated with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and reviewer_id is null
    and reviewed_at is null
    and rejection_reason is null
    and public.can_submit_content('note')
  );
create policy quizzes_read_published_or_developer on public.quizzes
  for select to authenticated using ((is_published and public.is_active_user()) or public.is_developer());
create policy quizzes_owner_insert on public.quizzes
  for insert to authenticated with check (public.is_developer() and created_by = auth.uid());
create policy quizzes_owner_update on public.quizzes
  for update to authenticated using (public.is_developer()) with check (public.is_developer());
create policy quiz_questions_owner_read on public.quiz_questions
  for select to authenticated using (public.is_developer());
create policy quiz_questions_submit_pending on public.quiz_questions
  for insert to authenticated with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and reviewer_id is null
    and reviewed_at is null
    and rejection_reason is null
    and public.can_submit_content('quiz')
  );
create policy quiz_answers_read_self_or_developer on public.quiz_attempt_answers
  for select to authenticated using (user_id = auth.uid() or public.is_developer());
create policy user_progress_read_self_or_developer on public.user_progress
  for select to authenticated using (user_id = auth.uid() or public.is_developer());
create policy badges_read_active on public.badges
  for select to authenticated using (is_active and public.is_active_user());
create policy user_badges_read_self_or_developer on public.user_badges
  for select to authenticated using (user_id = auth.uid() or public.is_developer());
create policy bookmarks_manage_own on public.bookmarks
  for all to authenticated using (user_id = auth.uid() and public.is_active_user())
  with check (
    user_id = auth.uid()
    and public.is_active_user()
    and exists (select 1 from public.notes n where n.id = note_id and n.status = 'approved')
  );
create policy note_reactions_manage_own on public.note_reactions
  for all to authenticated using (user_id = auth.uid() and public.is_active_user())
  with check (
    user_id = auth.uid()
    and public.is_active_user()
    and exists (select 1 from public.notes n where n.id = note_id and n.status = 'approved')
  );
create policy note_reports_insert_own on public.note_reports
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_active_user()
    and exists (select 1 from public.notes n where n.id = note_id and n.status = 'approved')
  );
create policy note_reports_read_developer on public.note_reports
  for select to authenticated using (public.is_developer());
create policy announcements_read_published on public.announcements
  for select to authenticated using (published_at is not null and public.is_active_user());
create policy announcements_owner_all on public.announcements
  for all to authenticated using (public.is_developer()) with check (public.is_developer());
create policy exam_dates_read_active on public.exam_dates
  for select to authenticated using (public.is_active_user());
create policy exam_dates_owner_all on public.exam_dates
  for all to authenticated using (public.is_developer()) with check (public.is_developer());
create policy audit_events_read_developer on public.audit_events
  for select to authenticated using (public.is_developer());

grant usage on schema public to authenticated;
grant select on public.profiles, public.subjects, public.contribution_permissions, public.books,
  public.notes, public.quizzes, public.quiz_questions, public.quiz_attempt_answers, public.user_progress,
  public.badges, public.user_badges, public.bookmarks, public.note_reactions, public.note_reports,
  public.announcements, public.exam_dates, public.audit_events to authenticated;
grant insert on public.notes, public.quiz_questions, public.bookmarks, public.note_reactions, public.note_reports to authenticated;
grant update, delete on public.bookmarks, public.note_reactions to authenticated;
grant insert, update, delete on public.books, public.quizzes, public.announcements, public.exam_dates to authenticated;
grant select on public.notes_public, public.quiz_questions_public to authenticated;

revoke insert, update, delete on public.profiles, public.contribution_permissions,
  public.audit_events, public.quiz_attempt_answers, public.user_progress, public.user_badges from anon, authenticated;
revoke update, delete on public.notes, public.quiz_questions from anon, authenticated;
revoke select on public.quiz_questions from anon, authenticated;
revoke all on public.member_summary from anon, authenticated;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_developer() from public, anon;
revoke all on function public.can_submit_content(public.content_kind) from public, anon;
revoke all on function public.activate_my_profile() from public, anon;
revoke all on function public.record_audit_event(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.owner_apply_invited_profile(uuid, text, text, public.app_role, boolean, uuid) from public, anon, authenticated;
revoke all on function public.owner_update_member(uuid, public.app_role, boolean, uuid) from public, anon, authenticated;
revoke all on function public.review_note(uuid, public.note_status, text) from public, anon;
revoke all on function public.review_quiz_question(uuid, public.note_status, text) from public, anon;
revoke all on function public.submit_quiz_answer(uuid, smallint) from public, anon;
grant execute on function public.is_active_user(), public.is_developer(), public.can_submit_content(public.content_kind) to authenticated;
grant execute on function public.activate_my_profile(), public.review_note(uuid, public.note_status, text),
  public.review_quiz_question(uuid, public.note_status, text), public.submit_quiz_answer(uuid, smallint) to authenticated;
grant execute on function public.record_audit_event(uuid, text, text, text, jsonb),
  public.owner_apply_invited_profile(uuid, text, text, public.app_role, boolean, uuid),
  public.owner_update_member(uuid, public.app_role, boolean, uuid) to service_role;

insert into public.subjects (slug, name, accent_color, display_order) values
  ('physiology', 'Physiology', '#8CBcff', 1),
  ('organic-chemistry', 'Organic Chemistry', '#76DB9C', 2),
  ('physical-pharmacy', 'Physical Pharmacy', '#F29C9A', 3),
  ('biochemistry', 'Biochemistry', '#D4A4F5', 4),
  ('english', 'English', '#9AB8FF', 5);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy book_covers_public_read on storage.objects
  for select to public using (bucket_id = 'book-covers');
create policy book_covers_developer_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'book-covers' and public.is_developer());
create policy book_covers_developer_update on storage.objects
  for update to authenticated using (bucket_id = 'book-covers' and public.is_developer())
  with check (bucket_id = 'book-covers' and public.is_developer());
create policy book_covers_developer_delete on storage.objects
  for delete to authenticated using (bucket_id = 'book-covers' and public.is_developer());
