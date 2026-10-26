begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'student-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Student Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'writer-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Writer Test"}', now(), now());

update public.profiles set role = 'developer', status = 'active'
where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set status = 'active'
where id in ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003');
insert into public.contribution_permissions (user_id, content_type, granted_by)
values ('10000000-0000-0000-0000-000000000003', 'note', '10000000-0000-0000-0000-000000000001');

insert into public.books (id, subject_id, title)
select '20000000-0000-0000-0000-000000000001', id, 'Test Physiology Resource'
from public.subjects where slug = 'physiology';
insert into public.notes (id, subject_id, book_id, chapter, topic, submitted_by, status, reviewer_id, reviewed_at)
select '30000000-0000-0000-0000-000000000001', s.id, b.id, 'Chapter 1', 'Approved fixture',
       '10000000-0000-0000-0000-000000000001', 'approved', '10000000-0000-0000-0000-000000000001', now()
from public.subjects s join public.books b on b.subject_id = s.id
where s.slug = 'physiology' and b.id = '20000000-0000-0000-0000-000000000001';
insert into public.notes (id, subject_id, book_id, chapter, topic, submitted_by)
select '30000000-0000-0000-0000-000000000002', s.id, b.id, 'Chapter 2', 'Pending fixture',
       '10000000-0000-0000-0000-000000000003'
from public.subjects s join public.books b on b.subject_id = s.id
where s.slug = 'physiology' and b.id = '20000000-0000-0000-0000-000000000001';
insert into public.notes (id, subject_id, book_id, chapter, topic, submitted_by, status, reviewer_id, reviewed_at, rejection_reason)
select '30000000-0000-0000-0000-000000000003', s.id, b.id, 'Chapter 3', 'Rejected fixture',
       '10000000-0000-0000-0000-000000000003', 'rejected', '10000000-0000-0000-0000-000000000001', now(), 'Test rejection'
from public.subjects s join public.books b on b.subject_id = s.id
where s.slug = 'physiology' and b.id = '20000000-0000-0000-0000-000000000001';

insert into public.quizzes (id, subject_id, title, is_published, created_by)
select '40000000-0000-0000-0000-000000000001', id, 'Sample quiz', true,
       '10000000-0000-0000-0000-000000000001'
from public.subjects where slug = 'physiology';
insert into public.quiz_questions (id, quiz_id, chapter, prompt, options, answer_index, status, submitted_by, reviewer_id, reviewed_at)
values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Chapter 1',
        'Sample prompt', '["correct","incorrect"]', 0, 'approved',
        '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now());

select is(has_table_privilege('anon', 'public.notes', 'select'), false, 'anonymous users cannot select note rows');
select is(has_table_privilege('authenticated', 'public.profiles', 'update'), false, 'authenticated users cannot update profile roles');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.notes where id in ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003')), 0, 'students cannot see pending or rejected notes');
select is((select count(*)::integer from public.notes_public where id = '30000000-0000-0000-0000-000000000001'), 1, 'students can see approved notes');
select throws_ok(
  $$insert into public.notes (subject_id, book_id, chapter, topic, submitted_by, status)
    select s.id, b.id, 'Chapter', 'Attempted direct publication', auth.uid(), 'approved'
    from public.subjects s join public.books b on b.subject_id = s.id where s.slug = 'physiology' limit 1$$,
  '42501', null, 'students cannot submit directly as approved'
);
select throws_ok(
  $$insert into public.notes (subject_id, book_id, chapter, topic, submitted_by, status)
    select s.id, b.id, 'Chapter', 'Attempt without permission', auth.uid(), 'pending'
    from public.subjects s join public.books b on b.subject_id = s.id where s.slug = 'physiology' limit 1$$,
  '42501', null, 'students without explicit contribution permission cannot submit'
);
select throws_ok(
  $$update public.profiles set role = 'developer' where id = auth.uid()$$,
  '42501', null, 'users cannot escalate their own role'
);
select throws_ok(
  $$select public.owner_update_member('10000000-0000-0000-0000-000000000002', 'teacher', true, auth.uid())$$,
  '42501', null, 'users cannot grant roles or contribution permissions'
);
select throws_ok(
  $$select public.review_note('30000000-0000-0000-0000-000000000002', 'approved', null)$$,
  '42501', null, 'students cannot approve notes'
);
select is(
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public' and table_name = 'quiz_questions_public' and column_name = 'answer_index'),
  0, 'public quiz view does not expose correct-answer indices'
);
select throws_ok(
  $$select public.submit_quiz_answer('50000000-0000-0000-0000-000000000001', 99)$$,
  '22023', null, 'quiz RPC rejects a choice outside the question'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok(
  $$insert into public.notes (subject_id, book_id, chapter, topic, submitted_by, status)
    select s.id, b.id, 'Chapter 3', 'Allowed pending submission', auth.uid(), 'pending'
    from public.subjects s join public.books b on b.subject_id = s.id where s.slug = 'physiology' limit 1$$,
  'permitted contributors may submit pending notes'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.review_note('30000000-0000-0000-0000-000000000002', 'approved', null)$$,
  'developer may approve a pending note'
);
select is(
  (select count(*)::integer from public.notes_public where id = '30000000-0000-0000-0000-000000000002'),
  1, 'approved note becomes visible'
);
select is(
  (select reviewer_id from public.notes where id = '30000000-0000-0000-0000-000000000002'),
  '10000000-0000-0000-0000-000000000001'::uuid, 'approval records its reviewer'
);
select ok(
  (select reviewed_at is not null from public.notes where id = '30000000-0000-0000-0000-000000000002'),
  'approval records its review timestamp'
);

select * from finish();
rollback;
