begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '13000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gamification-dev-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Gamification Developer"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '13000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gamification-owner-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Gamification Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '13000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'gamification-other-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Gamification Other"}', now(), now());

update public.profiles set role = 'developer', status = 'active'
where id = '13000000-0000-0000-0000-000000000001';
update public.profiles set status = 'active'
where id in ('13000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000003');

insert into public.quizzes (id, subject_id, title, is_published, created_by)
select '43000000-0000-0000-0000-000000000001', id, 'Gamification test quiz', true,
       '13000000-0000-0000-0000-000000000001'
from public.subjects where slug = 'physiology';
insert into public.quiz_questions (
  id, quiz_id, chapter, prompt, options, answer_index, status, submitted_by, reviewer_id, reviewed_at
) values (
  '53000000-0000-0000-0000-000000000001',
  '43000000-0000-0000-0000-000000000001',
  'Chapter 1',
  'Sample gamification prompt',
  '["Correct choice","Incorrect choice"]',
  0,
  'approved',
  '13000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  now()
);
insert into public.flashcards (id, subject_id, chapter, prompt, answer, is_published, created_by)
select '63000000-0000-0000-0000-000000000001', id, 'Chapter 1', 'Test prompt', 'Test answer',
       true, '13000000-0000-0000-0000-000000000001'
from public.subjects where slug = 'physiology';

select is(has_table_privilege('authenticated', 'public.user_progress', 'update'), false, 'users cannot directly edit their XP or streak');
select is(has_table_privilege('authenticated', 'public.user_badges', 'insert'), false, 'users cannot award themselves badges');

set local role authenticated;
set local request.jwt.claims = '{"sub":"13000000-0000-0000-0000-000000000002","role":"authenticated"}';
select set_config('test.gamification_attempt_id', public.start_quiz_attempt('standard', '43000000-0000-0000-0000-000000000001', null)::text, true);
select lives_ok(
  format(
    'select * from public.submit_quiz_attempt_answer(%L::uuid, %L::uuid, 0)',
    current_setting('test.gamification_attempt_id'),
    '53000000-0000-0000-0000-000000000001'
  ),
  'a checked quiz answer records study activity'
);
select is((select xp from public.user_progress where user_id = auth.uid()), 10, 'a correct answer awards ten XP');
select is((select current_streak from public.user_progress where user_id = auth.uid()), 1, 'study activity starts a daily streak');
select lives_ok(
  format('select public.finish_quiz_attempt(%L::uuid)', current_setting('test.gamification_attempt_id')),
  'the owner can complete the attempt'
);
select is(
  (select count(*)::integer from public.user_badges ub join public.badges b on b.id = ub.badge_id
   where ub.user_id = auth.uid() and b.slug = 'first-quiz'),
  1,
  'completing the first quiz awards the First quiz badge'
);
reset role;

update public.user_progress
set current_streak = 6, longest_streak = 6, last_studied_on = current_date - 1
where user_id = '13000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"13000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$select * from public.review_flashcard('63000000-0000-0000-0000-000000000001', 'good')$$,
  'flashcard review records study activity'
);
select is((select current_streak from public.user_progress where user_id = auth.uid()), 7, 'consecutive study activity increments the streak');
select is(
  (select count(*)::integer from public.user_badges ub join public.badges b on b.id = ub.badge_id
   where ub.user_id = auth.uid() and b.slug = 'seven-day-streak'),
  1,
  'reaching seven study days awards the 7-day streak badge'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"13000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.user_progress), 0, 'users cannot read another account progress');
select is((select count(*)::integer from public.user_badges), 0, 'users cannot read another account badges');
reset role;

select * from finish();
rollback;
