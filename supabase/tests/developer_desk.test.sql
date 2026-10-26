begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '18000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'desk-dev-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Desk Developer"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '18000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'desk-student-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Desk Student"}', now(), now());

update public.profiles set role = 'developer', status = 'active'
where id = '18000000-0000-0000-0000-000000000001';
update public.profiles set status = 'active'
where id = '18000000-0000-0000-0000-000000000002';

insert into public.notes (
  id, subject_id, book_id, chapter, topic, submitted_by, created_at
)
select id, s.id, b.id, 'Chapter 1', topic, '18000000-0000-0000-0000-000000000002', created_at
from (
  values
    ('38000000-0000-0000-0000-000000000001'::uuid, 'Bulk approval one', now()),
    ('38000000-0000-0000-0000-000000000002'::uuid, 'Bulk approval two', now()),
    ('38000000-0000-0000-0000-000000000003'::uuid, 'Bulk rejection', now()),
    ('38000000-0000-0000-0000-000000000004'::uuid, 'Old pending item', now() - interval '45 minutes')
) as items(id, topic, created_at)
cross join public.subjects s
join public.books b on b.subject_id = s.id
where s.slug = 'physiology';
insert into public.notes (
  id, subject_id, book_id, chapter, topic, submitted_by, status, reviewer_id, reviewed_at
)
select '38000000-0000-0000-0000-000000000005', s.id, b.id, 'Chapter 2', 'Popular subject test',
       '18000000-0000-0000-0000-000000000001', 'approved',
       '18000000-0000-0000-0000-000000000001', now()
from public.subjects s join public.books b on b.subject_id = s.id where s.slug = 'physiology' limit 1;
insert into public.note_reactions (user_id, note_id, helpful)
values ('18000000-0000-0000-0000-000000000002', '38000000-0000-0000-0000-000000000005', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.review_notes_bulk(array['38000000-0000-0000-0000-000000000001'::uuid], 'approved', null)$$,
  '42501',
  null,
  'ordinary users cannot review notes in bulk'
);
select throws_ok(
  $$select public.developer_analytics()$$,
  '42501',
  null,
  'ordinary users cannot access developer analytics'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.review_notes_bulk(
    array['38000000-0000-0000-0000-000000000001'::uuid, '38000000-0000-0000-0000-000000000002'::uuid],
    'approved',
    null
  )$$,
  'the developer can bulk approve pending notes'
);
select is(
  (select count(*)::integer from public.notes
   where id in ('38000000-0000-0000-0000-000000000001', '38000000-0000-0000-0000-000000000002')
     and status = 'approved' and reviewer_id = auth.uid() and reviewed_at is not null),
  2,
  'bulk approval records reviewer and review time'
);
select throws_ok(
  $$select public.review_notes_bulk(array['38000000-0000-0000-0000-000000000003'::uuid], 'rejected', null)$$,
  '22023',
  null,
  'bulk rejection requires a reason'
);
select lives_ok(
  $$select public.review_notes_bulk(array['38000000-0000-0000-0000-000000000003'::uuid], 'rejected', 'Insufficient source details')$$,
  'the developer can bulk reject with a reason'
);
select is(
  (select rejection_reason from public.notes where id = '38000000-0000-0000-0000-000000000003'),
  'Insufficient source details',
  'bulk rejection saves the provided reason'
);
select is((public.developer_analytics()->>'activeUsers')::integer, 2, 'analytics report active user count');
select is(public.developer_analytics()->'popularSubjects'->0->>'subject', 'Physiology', 'analytics identifies subjects with the most helpful reactions');
select ok((public.developer_analytics()->>'pendingQueueAgeMinutes')::integer >= 44, 'analytics reports the age of the oldest pending note');
select throws_ok(
  $$select public.review_notes_bulk(
    array['38000000-0000-0000-0000-000000000004'::uuid, '38000000-0000-0000-0000-000000000004'::uuid],
    'approved',
    null
  )$$,
  '22023',
  null,
  'duplicate identifiers are rejected before bulk review'
);
reset role;

select * from finish();
rollback;
