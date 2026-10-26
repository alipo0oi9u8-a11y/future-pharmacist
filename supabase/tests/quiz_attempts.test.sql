begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '11000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'quiz-owner-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Quiz Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'quiz-student-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Quiz Student"}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'quiz-other-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Other Student"}', now(), now());

update public.profiles set role = 'developer', status = 'active'
where id = '11000000-0000-0000-0000-000000000001';
update public.profiles set status = 'active'
where id in ('11000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000003');

insert into public.quizzes (id, subject_id, title, is_published, created_by)
select '41000000-0000-0000-0000-000000000001', id, 'Attempt test quiz', true,
       '11000000-0000-0000-0000-000000000001'
from public.subjects where slug = 'physiology';
insert into public.quiz_questions (
  id, quiz_id, chapter, prompt, options, answer_index, status, submitted_by, reviewer_id, reviewed_at
) values (
  '51000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  'Chapter 1',
  'Sample test prompt',
  '["Correct choice","Incorrect choice"]',
  0,
  'approved',
  '11000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  now()
);

select is(has_table_privilege('anon', 'public.quiz_attempts', 'select'), false, 'anonymous users cannot read quiz attempts');
select is(has_table_privilege('authenticated', 'public.quiz_attempts', 'insert'), false, 'clients cannot create or edit attempts directly');
select is(has_column_privilege('authenticated', 'public.quiz_choices', 'is_correct', 'select'), false, 'clients cannot select correctness from normalized choices');
select is(
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public' and table_name = 'quiz_questions_public'
     and column_name in ('answer_index', 'is_correct', 'explanation')),
  0,
  'public quiz view excludes answer and explanation fields'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}';
select set_config('test.quiz_attempt_id', public.start_quiz_attempt('standard', '41000000-0000-0000-0000-000000000001', null)::text, true);
select is(current_setting('test.quiz_attempt_id') <> '', true, 'an active user can start a supported quiz attempt');
select is(
  (select jsonb_array_length(options)::integer from public.quiz_questions_public where id = '51000000-0000-0000-0000-000000000001'),
  2,
  'published view exposes available choice text'
);
select is(
  (select correct from public.submit_quiz_attempt_answer(
    current_setting('test.quiz_attempt_id')::uuid,
    '51000000-0000-0000-0000-000000000001',
    1
  )),
  false,
  'server reports an incorrect choice without revealing the correct choice in advance'
);
select is(
  (select count(*)::integer from public.quiz_attempt_answers
   where attempt_id = current_setting('test.quiz_attempt_id')::uuid and user_id = auth.uid()),
  1,
  'answer submission records an owner-bound attempt answer'
);
select is(
  (select question_count from public.quiz_attempts where id = current_setting('test.quiz_attempt_id')::uuid),
  1,
  'attempt question count is maintained by the server'
);
select throws_ok(
  format(
    'select * from public.submit_quiz_attempt_answer(%L::uuid, %L::uuid, 0)',
    current_setting('test.quiz_attempt_id'),
    '51000000-0000-0000-0000-000000000001'
  ),
  '23505',
  null,
  'a question cannot be answered twice in one attempt'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.quiz_attempts), 0, 'another student cannot read this user attempt');
select throws_ok(
  format('select public.finish_quiz_attempt(%L::uuid)', current_setting('test.quiz_attempt_id')),
  'P0002',
  null,
  'another student cannot finish this user attempt'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  format('select public.finish_quiz_attempt(%L::uuid)', current_setting('test.quiz_attempt_id')),
  'the attempt owner can finish their attempt'
);
select ok(
  (select completed_at is not null from public.quiz_attempts where id = current_setting('test.quiz_attempt_id')::uuid),
  'completion is recorded for the attempt owner'
);
select throws_ok(
  $$select public.start_quiz_attempt('unsupported', null, null)$$,
  '22023',
  null,
  'unsupported quiz modes are rejected'
);

select * from finish();
rollback;
