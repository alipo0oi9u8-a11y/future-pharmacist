# Future Pharmacists

A Pharm D Semester 1 study workspace built with Next.js App Router, TypeScript, Tailwind CSS, Motion, and Supabase. The visual preview is separate from real sign-in and is explicitly temporary; it must not be used to make security claims.

## Requirements

- Node.js 20+
- npm
- Docker Desktop for a local Supabase stack
- A Supabase project for deployment

## Local development

```powershell
npm install
Copy-Item .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

The local Supabase CLI prints the local API URL and keys. Put its `API URL` and `anon key` in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Set `SUPABASE_SERVICE_ROLE_KEY` from the local service-role key. Never expose that service key in client code, a public environment variable, a commit, or a browser request. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` and `DEVELOPER_EMAIL` to the owner email you will bootstrap.

Run schema tests with:

```powershell
npx supabase test db
```

Do not present the app as production-secure unless the migrations apply cleanly and the RLS tests pass against the current schema.

## Initial developer account

After the local schema is applied and the four environment values above are set, run:

```powershell
npm run bootstrap:developer
```

The script sends an invitation to the single `DEVELOPER_EMAIL`, then calls the service-role-only `bootstrap_developer` RPC. It refuses to proceed if a developer profile already exists. The role is not selectable in the UI and there is no public account-creation route. Keep the service-role key only in the server environment. To retry after a partial failure, first reconcile the invitation/user in Supabase Auth and confirm no developer profile exists.

## Supabase and invitations

- Apply versioned migrations with `npx supabase db reset` locally and `npx supabase db push` for a linked remote project.
- Keep Supabase Auth public sign-up disabled. Invited members accept their email invitation through `/auth/callback`.
- The developer desk uses trusted server routes and Supabase Admin API for invitations; roles and contribution grants are written through guarded RPC functions.
- The developer desk supports atomic bulk note review, a searchable view of the latest 30 audit events, and guarded analytics for active accounts, popular subjects (helpful reactions), and oldest pending-note age.
- Contributors can submit pending notes only. Only the developer can approve or reject them; rejected notes require a reason. Ordinary users read approved content only.
- Note bookmarks, one helpful reaction per user/note, broken-link reports, and the real rolling seven-day “New this week” badge are account-backed. Open reports appear in the developer-only review queue.
- Approved-note and published-announcement notifications are generated in the database; read/unread state is private per account, and the bell supports marking one or all as read.
- Quiz questions and normalized choice rows are stored in Supabase. The client receives prompts and choice text only; authenticated answer submissions are checked and recorded by an RPC. Add questions with the database fields `chapter`, `prompt`, `options`, and `answer_index`; the migration synchronizes normalized choices. Attempts have a per-user owner policy.
- After applying the current migrations, an owner may import the included explicitly labeled sample bank with `npm run import:sample-quiz-bank`. It reads `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DEVELOPER_EMAIL` from `web/.env.local`; the script verifies the active developer profile, validates field limits, and must only be run in a trusted local environment. Do not expose or commit the service key.
- RLS behavior and the purpose of each policy are documented in [supabase/RLS.md](./supabase/RLS.md).
- Notes use a Google Docs URL; the document owner must grant readers access. A URL is not guaranteed permanent, valid, or readable.
- Book cover files are restricted to JPEG, PNG, or WebP, 5 MiB maximum, and stored in the controlled `book-covers` bucket.

## Vercel deployment

1. Import the `web` directory as the Vercel project root.
2. Add `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DEVELOPER_EMAIL` to server environment settings. Only the first three `NEXT_PUBLIC_*` values are intentionally browser-visible.
3. Configure the Supabase Auth Site URL and allowed redirect URL as `https://YOUR_DOMAIN/auth/callback`.
4. Keep email sign-up disabled and configure Supabase invitation email delivery.
5. Apply migrations, run `npx supabase test db` against a test database, and bootstrap the initial developer using a trusted local/CI environment. Never expose the bootstrap command as a public endpoint.
6. Deploy only after verifying the production environment variables, Auth redirect, Storage bucket, migrations, and RLS test results.

## Validation

```powershell
npm run lint
npx tsc --noEmit
npx supabase test db
npm run build
```

The login form, protected `/app` page, invite-only auth flow, note submission/review, member role and permission changes, book catalog update and cover upload, personal note activity, course announcements/exam dates, server-checked quiz answers, flashcard review schedules, quiz/flashcard XP, streaks and badge awards, per-user theme/motion/sound/leaderboard preferences, and the opt-in weekly leaderboard use Supabase-backed server routes/RPCs when configured. The leaderboard returns display names and weekly XP only; it never returns emails. The installable PWA caches only the public login shell and static assets; authenticated pages and API responses are never cached. No live Supabase project credentials are included in this repository.

The visual-preview button intentionally uses local sample content and in-memory changes only. Sample quiz questions and flashcards are not faculty reviewed. Live users see database-published content only; if the flashcard migration has not been applied or no cards have been published, the live flashcard view is empty. Full-text command search remains outstanding. Quiz attempts require migration `202610270001_quiz_attempts_and_choices.sql`; flashcard scheduling/gamification require `202610270002_flashcard_scheduling.sql` and `202610270003_gamification.sql`; per-user settings require `202610270004_user_preferences.sql`; notifications require `202610270005_notifications.sql`; the opt-in weekly leaderboard requires `202610270006_weekly_leaderboard.sql`; bulk review and developer analytics require `202610270007_developer_desk.sql`. The current preview progress indicators and example notes are illustrative only. Do not treat the app as a complete production release until Supabase is configured and its RLS tests pass.

The visible **Reduce animations** setting applies across the login and study pages. Signed-in users can sync theme, reduced motion, sound preference, and leaderboard opt-in to their account; signed-out and preview settings remain in this browser under versioned `future-pharmacists.*.v1` keys. Sound is off by default; the app does not currently play sound effects. The weekly leaderboard is opt-in and displays names only.
