import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const databaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const developerEmail = process.env.DEVELOPER_EMAIL?.trim().toLowerCase();
if (!databaseUrl || !serviceKey || !developerEmail) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DEVELOPER_EMAIL in web/.env.local.");
}

const bankPath = resolve(process.argv[2] ?? "supabase/quiz-bank.sample.json");
const bank = JSON.parse(await readFile(bankPath, "utf8"));
if (!Array.isArray(bank.quizzes) || bank.quizzes.length < 1) {
  throw new Error("Quiz bank must contain at least one quiz.");
}

for (const quiz of bank.quizzes) {
  if (quiz.isSample !== true || typeof quiz.quizKey !== "string" || quiz.quizKey.length > 160
    || typeof quiz.subjectSlug !== "string" || typeof quiz.title !== "string" || quiz.title.length < 1 || quiz.title.length > 160
    || typeof quiz.description !== "string" || quiz.description.length > 1000
    || !Array.isArray(quiz.questions) || quiz.questions.length < 1) {
    throw new Error("Each imported quiz needs a sample label, subject, title, description, and questions.");
  }
  for (const question of quiz.questions) {
    if (typeof question.key !== "string" || question.key.length > 160
      || typeof question.chapter !== "string" || question.chapter.length < 1 || question.chapter.length > 160
      || typeof question.prompt !== "string" || question.prompt.length < 1 || question.prompt.length > 1200
      || typeof question.explanation !== "string" || question.explanation.length > 1600
      || !Array.isArray(question.choices) || question.choices.length < 2 || question.choices.length > 8
      || question.choices.some((choice) => typeof choice !== "string" || choice.length < 1 || choice.length > 500)
      || !Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.choices.length) {
      throw new Error("A quiz question does not meet the database field limits.");
    }
  }
}

const admin = createClient(databaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: developer, error: profileError } = await admin
  .from("profiles")
  .select("id")
  .eq("email", developerEmail)
  .eq("role", "developer")
  .eq("status", "active")
  .single();
if (profileError || !developer) throw new Error("The active developer profile could not be verified.");

let importedQuestions = 0;
for (const quizEntry of bank.quizzes) {
  const { data: subject, error: subjectError } = await admin
    .from("subjects")
    .select("id")
    .eq("slug", quizEntry.subjectSlug)
    .eq("is_active", true)
    .single();
  if (subjectError || !subject) throw new Error(`No active subject found for quiz key ${quizEntry.quizKey}.`);

  const { data: quiz, error: quizError } = await admin
    .from("quizzes")
    .upsert({
      import_key: quizEntry.quizKey,
      subject_id: subject.id,
      title: quizEntry.title,
      description: quizEntry.description,
      is_published: true,
      is_sample: true,
      created_by: developer.id,
    }, { onConflict: "import_key" })
    .select("id")
    .single();
  if (quizError || !quiz) throw new Error(`Quiz import failed for key ${quizEntry.quizKey}.`);

  const questionRows = quizEntry.questions.map((question) => ({
    import_key: question.key,
    quiz_id: quiz.id,
    chapter: question.chapter,
    prompt: question.prompt,
    options: question.choices,
    answer_index: question.correctIndex,
    explanation: question.explanation,
    status: "approved",
    submitted_by: developer.id,
    reviewer_id: developer.id,
    reviewed_at: new Date().toISOString(),
  }));
  const { error: questionError } = await admin
    .from("quiz_questions")
    .upsert(questionRows, { onConflict: "import_key" });
  if (questionError) throw new Error(`Question import failed for quiz key ${quizEntry.quizKey}.`);
  importedQuestions += questionRows.length;
}

console.log(`Imported ${importedQuestions} explicitly labeled sample questions.`);
