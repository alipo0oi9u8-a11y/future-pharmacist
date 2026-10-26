begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '14000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'preferences-owner-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Preferences Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '14000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'preferences-other-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Preferences Other"}', now(), now());

update public.profiles set status = 'active'
where id in ('14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002');

select is(has_table_privilege('anon', 'public.user_preferences', 'select'), false, 'anonymous users cannot read preferences');
select is(has_table_privilege('authenticated', 'public.user_preferences', 'insert'), false, 'clients cannot insert preferences directly');
select is(has_table_privilege('authenticated', 'public.user_preferences', 'update'), false, 'clients cannot update preferences directly');

set local role authenticated;
set local request.jwt.claims = '{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.save_user_preferences('light', null, null, null)$$,
  'active users can change preferences through the owner-bound RPC'
);
select is(
  (select theme from public.user_preferences where user_id = auth.uid()),
  'light',
  'the selected theme is saved for the current user'
);
select is(
  (select sound_enabled and leaderboard_opt_in from public.user_preferences where user_id = auth.uid()),
  false,
  'sound and leaderboard participation default to off'
);
select throws_ok(
  $$select public.save_user_preferences('system', null, null, null)$$,
  '22023',
  null,
  'unsupported theme values are rejected'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"14000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.user_preferences), 0, 'users cannot read another account preferences');
reset role;

select * from finish();
rollback;
