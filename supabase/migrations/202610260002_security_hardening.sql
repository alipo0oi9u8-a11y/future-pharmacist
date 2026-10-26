-- Security hardening and controlled bootstrap for the initial schema.
-- Public privileges are revoked first; only the minimum authenticated operations are re-granted.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles, public.subjects, public.contribution_permissions, public.books,
  public.notes, public.quizzes, public.quiz_questions, public.quiz_attempt_answers, public.user_progress,
  public.badges, public.user_badges, public.bookmarks, public.note_reactions, public.note_reports,
  public.announcements, public.exam_dates, public.audit_events to authenticated;
grant select on public.notes_public, public.quiz_questions_public to authenticated;
grant insert on public.notes, public.quiz_questions, public.bookmarks, public.note_reactions, public.note_reports to authenticated;
grant update, delete on public.bookmarks, public.note_reactions to authenticated;
grant insert, update, delete on public.books, public.quizzes, public.announcements, public.exam_dates to authenticated;
grant insert, update, delete on public.subjects to authenticated;

create policy subjects_owner_insert on public.subjects
  for insert to authenticated with check (public.is_developer());
create policy subjects_owner_update on public.subjects
  for update to authenticated using (public.is_developer()) with check (public.is_developer());
create policy subjects_owner_delete on public.subjects
  for delete to authenticated using (public.is_developer());

create policy note_reports_owner_update on public.note_reports
  for update to authenticated using (public.is_developer()) with check (public.is_developer());

create or replace function public.bootstrap_developer(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actual_email text;
  current_owner uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select id into current_owner from public.profiles where role = 'developer' limit 1;
  if current_owner is not null and current_owner <> p_user_id then
    raise exception 'The developer account has already been bootstrapped' using errcode = '42501';
  end if;
  select lower(email) into actual_email from auth.users where id = p_user_id;
  if actual_email is null or actual_email <> lower(trim(p_email)) then
    raise exception 'The account email does not match the requested developer email' using errcode = '42501';
  end if;
  update public.profiles
  set role = 'developer', status = 'active', updated_at = now()
  where id = p_user_id;
  if not found then
    raise exception 'Profile was not created by the auth trigger' using errcode = 'P0002';
  end if;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (p_user_id, 'developer.bootstrapped', 'profile', p_user_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.bootstrap_developer(uuid, text) from public, anon, authenticated;
grant execute on function public.bootstrap_developer(uuid, text) to service_role;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.audit_note_review() from public, anon, authenticated;
revoke all on function public.audit_quiz_review() from public, anon, authenticated;

-- Empty catalog entries let the owner attach the correct books without inventing requirements.
insert into public.books (subject_id, title, description, course_confirmed)
select s.id, 'Not provided — developer to confirm', 'Confirm the required title and edition with the current course outline or faculty.', false
from public.subjects s
where not exists (select 1 from public.books b where b.subject_id = s.id);

comment on table public.profiles is 'Auth-linked roles; users can only read their own profile. Server-side service operations manage roles.';
comment on table public.contribution_permissions is 'Developer-granted submission capability; never permits publication.';
comment on table public.notes is 'Contributors may insert pending rows only; only the developer may read the review queue and approve/reject via RPC.';
comment on table public.quiz_questions is 'Correct answers are not selectable by clients; public quiz view exposes prompt/options and server RPC checks answers.';
comment on table public.quiz_attempt_answers is 'Attempt records are readable only by their owner or the developer and written by the answer RPC.';
comment on table public.user_progress is 'Progress is readable only by its owner or developer and updated by the answer RPC.';
comment on table public.audit_events is 'Server functions and review triggers write audit events; only the developer can read them.';
comment on table public.books is 'Active book metadata is visible to active users; only the developer may write.';
comment on table public.subjects is 'Active subjects are visible to authenticated users; only the developer may edit.';
comment on table public.announcements is 'Published announcements are visible to active users; only the developer may manage.';
comment on table public.exam_dates is 'Exam dates are visible to active users; only the developer may manage.';
comment on table public.bookmarks is 'Each user may manage bookmarks only for their own account and approved notes.';
comment on table public.note_reactions is 'Each user may create one reaction per approved note.';
comment on table public.note_reports is 'Users may report approved notes; only the developer may review reports.';
comment on table public.badges is 'Active badge definitions are visible to active users; awards are not client-writable.';
comment on table public.user_badges is 'Awards are readable only by their owner or the developer and are not client-writable.';
comment on table public.quizzes is 'Published quizzes are visible to active users; only the developer may manage quiz metadata.';
