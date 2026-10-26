begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '16000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'notifications-dev-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Notifications Developer"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '16000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'notifications-owner-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Notifications Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '16000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'notifications-other-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Notifications Other"}', now(), now());

update public.profiles set role = 'developer', status = 'active'
where id = '16000000-0000-0000-0000-000000000001';
update public.profiles set status = 'active'
where id in ('16000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000003');

insert into public.notes (
  id, subject_id, book_id, chapter, topic, submitted_by
)
select '36000000-0000-0000-0000-000000000001', s.id, b.id, 'Chapter 1', 'Notification test note',
       '16000000-0000-0000-0000-000000000001'
from public.subjects s join public.books b on b.subject_id = s.id where s.slug = 'physiology' limit 1;
update public.notes
set status = 'approved', reviewer_id = '16000000-0000-0000-0000-000000000001', reviewed_at = now()
where id = '36000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.announcements (title, body, published_at, created_by)
values ('Notification test announcement', 'Sample test announcement body.', now(), auth.uid());
reset role;

select is(has_table_privilege('authenticated', 'public.notification_events', 'insert'), false, 'clients cannot create shared notification events');
select is(has_table_privilege('authenticated', 'public.user_notification_reads', 'insert'), false, 'clients cannot write read state directly');

set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.notification_events), 2, 'approved notes and published announcements appear in the shared feed');
select is((select count(*)::integer from public.user_notification_reads where user_id = auth.uid()), 0, 'new notifications begin unread for each user');
select set_config('test.notification_id', (select id::text from public.notification_events where event_type = 'approved_note'), true);
select lives_ok(
  format('select public.mark_notification_read(%L::uuid)', current_setting('test.notification_id')),
  'an active user can mark a notification read through the owner-bound RPC'
);
select is((select count(*)::integer from public.user_notification_reads where user_id = auth.uid()), 1, 'reading one item changes only the current user state');
select lives_ok(
  $$select public.mark_notification_read(null)$$,
  'an active user can mark all visible notifications read'
);
select is((select count(*)::integer from public.user_notification_reads where user_id = auth.uid()), 2, 'mark all records both read states');
select throws_ok(
  $$select public.mark_notification_read('96000000-0000-0000-0000-000000000099')$$,
  'P0002',
  null,
  'unknown notification identifiers are rejected'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.notification_events), 2, 'active users can read the shared feed');
select is((select count(*)::integer from public.user_notification_reads), 0, 'users cannot read another account notification state');
reset role;

select * from finish();
rollback;
