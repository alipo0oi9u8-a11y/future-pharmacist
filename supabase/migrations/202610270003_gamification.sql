begin;

insert into public.badges (slug, name, description, is_active)
values
  ('first-quiz', 'First quiz', 'Complete your first quiz attempt.', true),
  ('seven-day-streak', '7-day streak', 'Study on seven consecutive days.', true)
on conflict (slug) do nothing;

create or replace function public.record_study_activity(p_user_id uuid, p_xp integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resulting_streak integer;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() or not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_xp is null or p_xp not between 0 and 100 then
    raise exception 'Invalid activity points' using errcode = '22023';
  end if;

  insert into public.user_progress (user_id, xp, current_streak, longest_streak, last_studied_on)
  values (p_user_id, p_xp, 1, 1, current_date)
  on conflict (user_id) do update set
    xp = public.user_progress.xp + excluded.xp,
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
    updated_at = now()
  returning current_streak into resulting_streak;

  if resulting_streak >= 7 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, b.id from public.badges b where b.slug = 'seven-day-streak'
    on conflict (user_id, badge_id) do nothing;
  end if;
end;
$$;
revoke all on function public.record_study_activity(uuid, integer) from public, anon, authenticated;

create or replace function public.record_quiz_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.question_count > old.question_count then
    perform public.record_study_activity(
      new.user_id,
      case when new.correct_count > old.correct_count then 10 else 0 end
    );
  end if;
  return new;
end;
$$;
revoke all on function public.record_quiz_activity() from public, anon, authenticated;
create trigger quiz_attempt_activity
after update of question_count on public.quiz_attempts
for each row execute function public.record_quiz_activity();

create or replace function public.record_flashcard_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.record_study_activity(new.user_id, 2);
  return new;
end;
$$;
revoke all on function public.record_flashcard_activity() from public, anon, authenticated;
create trigger flashcard_review_activity
after insert or update on public.user_flashcard_reviews
for each row execute function public.record_flashcard_activity();

create or replace function public.award_first_quiz_badge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.completed_at is null and new.completed_at is not null and new.question_count > 0 then
    insert into public.user_badges (user_id, badge_id)
    select new.user_id, b.id from public.badges b where b.slug = 'first-quiz'
    on conflict (user_id, badge_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.award_first_quiz_badge() from public, anon, authenticated;
create trigger first_quiz_badge
after update of completed_at on public.quiz_attempts
for each row execute function public.award_first_quiz_badge();

commit;
