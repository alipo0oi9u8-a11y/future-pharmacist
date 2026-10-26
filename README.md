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
- Contributors can submit pending notes only. Only the developer can approve or reject them; rejected notes require a reason. Ordinary users read approved content only.
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

The login form, protected `/app` page, invite-only auth flow, note submission/review, member role and permission changes, book catalog update and cover upload, personal note activity, course announcements/exam dates, and server-checked quiz answers use Supabase-backed server routes when configured. The installable PWA caches only the public login shell and static assets; authenticated pages and API responses are never cached. No live Supabase project credentials are included in this repository.

The visual-preview button intentionally uses local sample content and in-memory changes only. Sample quiz questions are not faculty reviewed. The live app also shows these sample questions only when the database contains no approved quiz questions. Notification delivery/inbox, opt-in leaderboard, cross-device theme and animation preferences, scheduled flashcard review, full-text command search, bulk review, and analytics are not yet connected to persisted backend data. The current preview progress indicators and example notes are illustrative only. Do not treat the app as a complete production release until Supabase is configured and its RLS tests pass.
