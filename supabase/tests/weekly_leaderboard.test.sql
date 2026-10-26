begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '17000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'leaderboard-one-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Learner One"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '17000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'leaderboard-two-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Learner Two"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '17000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'leaderboard-optout-test@example.edu', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Opted Out"}', now(), now());

update public.profiles set status = 'active'
where id in (
  '17000000-0000-0000-0000-000000000001',
  '17000000-0000-0000-0000-000000000002',
  '17000000-0000-0000-0000-000000000003'
);
insert into public.user_preferences (user_id, leaderboard_opt_in)
values
  ('17000000-0000-0000-0000-000000000001', true),
  ('17000000-0000-0000-0000-000000000002', true),
  ('17000000-0000-0000-0000-000000000003', false);
insert into public.user_progress (user_id, xp, current_streak, longest_streak)
values
  ('17000000-0000-0000-0000-000000000001', 12, 1, 1),
  ('17000000-0000-0000-0000-000000000002', 7, 1, 1),
  ('17000000-0000-0000-0000-000000000003', 99, 1, 1);
insert into public.user_xp_events (user_id, xp, created_at)
values ('17000000-0000-0000-0000-000000000001', 100, now() - interval '8 days');

select is(has_table_privilege('authenticated', 'public.user_xp_events', 'insert'), false, 'clients cannot create XP events');
select is(has_table_privilege('authenticated', 'public.user_xp_events', 'update'), false, 'clients cannot change XP events');
select is(
  (select count(*)::integer from information_schema.parameters
   where specific_schema = 'public' and routine_name = 'weekly_leaderboard' and parameter_name = 'email'),
  0,
  'leaderboard RPC exposes no email parameter or column'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.weekly_leaderboard()), 2, 'only opted-in active users with weekly XP appear');
select is((select display_name from public.weekly_leaderboard() order by rank_position limit 1), 'Learner One', 'weekly XP determines the leaderboard order');
select is((select weekly_xp from public.weekly_leaderboard() where display_name = 'Learner One'), 12, 'older XP awards are excluded from the weekly score');
select is((select count(*)::integer from public.user_xp_events where user_id = auth.uid()), 2, 'users can read only their own XP event history');
select is((select weekly_xp from public.weekly_leaderboard() where display_name = 'Learner Two'), 7, 'other opted-in display names and weekly scores are visible');
select is((select count(*)::integer from public.weekly_leaderboard() where display_name = 'Opted Out'), 0, 'users who did not opt in are excluded');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.user_xp_events), 1, 'a second user cannot read another account XP events');
reset role;

select * from finish();
rollback;
