begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '12000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'flashcard-dev-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Flashcard Developer"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '12000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'flashcard-owner-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Flashcard Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '12000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'flashcard-other-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Flashcard Other"}', now(), now());

update public.profiles set role = 'developer', status = 'active'
where id = '12000000-0000-0000-0000-000000000001';
update public.profiles set status = 'active'
where id in ('12000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000003');

insert into public.flashcards (
  id, subject_id, chapter, prompt, answer, is_published, created_by
)
select
  '62000000-0000-0000-0000-000000000002', id, 'Flashcard RLS test',
  'Test prompt', 'Test answer', true, '12000000-0000-0000-0000-000000000001'
from public.subjects where slug = 'physiology';
insert into public.flashcards (
  id, subject_id, chapter, prompt, answer, is_published, created_by
)
select
  '62000000-0000-0000-0000-000000000003', id, 'Unpublished test',
  'Hidden prompt', 'Hidden answer', false, '12000000-0000-0000-0000-000000000001'
from public.subjects where slug = 'physiology';

select is(has_table_privilege('anon', 'public.user_flashcard_reviews', 'select'), false, 'anonymous users cannot read private review schedules');
select is(has_table_privilege('authenticated', 'public.user_flashcard_reviews', 'insert'), false, 'users cannot directly insert review schedules');
select is(has_table_privilege('authenticated', 'public.user_flashcard_reviews', 'update'), false, 'users cannot directly update review schedules');

set local role authenticated;
set local request.jwt.claims = '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.flashcards where id = '62000000-0000-0000-0000-000000000003'), 0, 'unpublished cards are hidden from ordinary users');
select is((select count(*)::integer from public.flashcards where id = '62000000-0000-0000-0000-000000000002'), 1, 'active users can read published cards');
select lives_ok(
  $$select * from public.review_flashcard('62000000-0000-0000-0000-000000000002', 'good')$$,
  'active users can schedule a published card through the rating function'
);
select is(
  (select interval_seconds from public.user_flashcard_reviews where flashcard_id = '62000000-0000-0000-0000-000000000002' and user_id = auth.uid()),
  86400,
  'Good schedules the first review for one day later'
);
select throws_ok(
  $$select * from public.review_flashcard('62000000-0000-0000-0000-000000000002', 'invalid')$$,
  '22023',
  null,
  'unsupported ratings are rejected'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.user_flashcard_reviews), 0, 'users cannot read another account review schedule');
reset role;

select * from finish();
rollback;
