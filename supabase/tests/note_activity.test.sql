begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '15000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'note-activity-dev-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Note Activity Developer"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '15000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'note-activity-owner-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Note Activity Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '15000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'note-activity-other-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Note Activity Other"}', now(), now());

update public.profiles set role = 'developer', status = 'active'
where id = '15000000-0000-0000-0000-000000000001';
update public.profiles set status = 'active'
where id in ('15000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000003');

insert into public.notes (
  id, subject_id, book_id, chapter, topic, submitted_by, status, reviewer_id, reviewed_at
)
select '35000000-0000-0000-0000-000000000001', s.id, b.id, 'Chapter 1', 'Approved test note',
       '15000000-0000-0000-0000-000000000001', 'approved',
       '15000000-0000-0000-0000-000000000001', now()
from public.subjects s join public.books b on b.subject_id = s.id where s.slug = 'physiology' limit 1;
insert into public.notes (
  id, subject_id, book_id, chapter, topic, submitted_by
)
select '35000000-0000-0000-0000-000000000002', s.id, b.id, 'Chapter 2', 'Pending test note',
       '15000000-0000-0000-0000-000000000001'
from public.subjects s join public.books b on b.subject_id = s.id where s.slug = 'physiology' limit 1;

select is(has_table_privilege('anon', 'public.bookmarks', 'select'), false, 'anonymous users cannot read bookmarks');

set local role authenticated;
set local request.jwt.claims = '{"sub":"15000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$insert into public.bookmarks (user_id, note_id) values (auth.uid(), '35000000-0000-0000-0000-000000000001')$$,
  'an active user can bookmark an approved note'
);
select lives_ok(
  $$insert into public.note_reactions (user_id, note_id, helpful) values (auth.uid(), '35000000-0000-0000-0000-000000000001', true)$$,
  'an active user can react helpful to an approved note'
);
select throws_ok(
  $$insert into public.note_reactions (user_id, note_id, helpful) values (auth.uid(), '35000000-0000-0000-0000-000000000001', true)$$,
  '23505',
  null,
  'the primary key permits only one reaction per user and note'
);
select lives_ok(
  $$insert into public.note_reports (user_id, note_id, reason) values (auth.uid(), '35000000-0000-0000-0000-000000000001', 'Possible broken link test report')$$,
  'an active user can create a broken-link report for an approved note'
);
select is(
  (select count(*)::integer from public.bookmarks where user_id = auth.uid())
  + (select count(*)::integer from public.note_reactions where user_id = auth.uid()),
  2,
  'the owner can read their bookmark and helpful reaction'
);
select is((select count(*)::integer from public.note_reports), 0, 'ordinary users cannot read the developer review queue');
select throws_ok(
  $$insert into public.bookmarks (user_id, note_id) values (auth.uid(), '35000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'users cannot bookmark a pending note'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"15000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (select count(*)::integer from public.bookmarks)
  + (select count(*)::integer from public.note_reactions)
  + (select count(*)::integer from public.note_reports),
  0,
  'users cannot read another account note activity'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.note_reports), 1, 'the developer can read the open broken-link report');
reset role;

select * from finish();
rollback;
