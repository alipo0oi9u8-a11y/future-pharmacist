insert into public.badges (slug, name, description) values
  ('first-quiz', 'First Quiz', 'Complete your first practice quiz.'),
  ('seven-day-streak', 'Seven-Day Streak', 'Study on seven consecutive days.')
on conflict (slug) do nothing;
