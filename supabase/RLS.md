# Row-level security policy guide

RLS is enabled on every application table by the initial migration. The security-hardening migration revokes the default table and sequence privileges from `anon` and `authenticated`, then grants only the operations required by application routes. Policies are additive; the grants do not bypass RLS. Privileged server operations require an authenticated developer check before using the service-role client, and guarded RPCs independently verify the trusted actor.

| Table / view | Policy behavior |
| --- | --- |
| `profiles` | A user reads their own profile; the active developer can read profiles. Clients have no write grant, so users cannot assign roles or activate accounts. |
| `contribution_permissions` | A user reads their own grants; the developer can read all. No client write policy exists. Guarded service-role RPCs manage grants and write audit events. |
| `subjects` | Authenticated users read active subjects; only the developer can insert, update, or delete. |
| `books` | Active users read active catalog items; only the developer can write. Book cover uploads use a developer-checked server route and controlled Storage bucket. |
| `notes` | Active users read approved rows; the developer may read all rows for review. Insert requires the authenticated submitter, pending status, no review metadata, and an explicit contribution permission. There is no client update/delete grant. |
| `notes_public` | Authenticated clients read only approved notes joined to active subject/book metadata. The view omits moderation fields and relies on a fixed approved-only predicate. |
| `note_reports` | Active users may report approved notes once per note; only the developer can read/review report records. |
| `note_reactions` | A user may read and manage their own reaction for approved notes. The primary key enforces one reaction per user/note. |
| `bookmarks` | A user may read and manage their own bookmarks for approved notes. |
| `quizzes` | Active users read published quizzes; only the developer can create or update quiz metadata. |
| `quiz_questions` | The developer can read moderation data. A contributor with explicit quiz permission can insert pending questions only. There is no client update/delete grant. |
| `quiz_choices` | Authenticated users can select only choice text for published, approved questions. Column privileges and the policy helper exclude the `is_correct` field. |
| `quiz_questions_public` | Authenticated clients read published, approved question prompts/options and the sample label only. Correct answer indices and explanations are not exposed. |
| `quiz_attempts` | Users read only their own attempt metadata; the developer can read attempts for support. Server RPCs create and complete rows. |
| `quiz_attempt_answers` | Users read only their own answer records; answers are created by the owner-checked server quiz RPC and linked to a quiz attempt. |
| `flashcards` | Active users read published cards; only the developer can manage the shared card bank. |
| `user_flashcard_reviews` | Users can read only their own schedule. Client inserts/updates are revoked; the `review_flashcard` RPC derives the owner from `auth.uid()` and accepts only Again/Good/Easy ratings for published cards. |
| `user_progress` | Users read only their own progress. The quiz-answer RPC updates XP/streaks; no authenticated write grant is given. |
| `badges` / `user_badges` | Active users read active definitions; users read only their own awards. No client write grant is given. |
| `announcements` | Active users read published announcements; only the developer can manage them. |
| `exam_dates` | Active users can read exam dates; only the developer can manage them. |
| `audit_events` | Only the developer can read audit events. Server-only guarded functions and review triggers write them. |

Security-definer functions use a fixed `search_path`. Service-only RPCs verify `auth.role() = 'service_role'` and the supplied active developer actor. Public signup is disabled in Supabase Auth configuration; new users are created by developer-checked invitation routes. A contributor permission only authorizes pending submission and never publication.

Run `npx supabase test db` after any policy/schema change. A passing local test suite does not replace production project configuration review.
