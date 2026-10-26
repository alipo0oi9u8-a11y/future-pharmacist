"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, Ref } from "react";
import type { Variants } from "motion/react";
import type { AppRole } from "@/lib/supabase/types";

type PageKey = "dashboard" | "notes" | "quiz" | "books" | "developer";
type Role = AppRole;
type NoteStatus = "pending" | "approved" | "rejected";
type AuthenticatedUser = { id: string; name: string; email: string; role: Role; canSubmitNotes: boolean };
type CatalogSubject = { id: string; name: string; accent_color: string };
type Note = {
  id: string;
  subject: string;
  book: string;
  chapter: string;
  topic: string;
  docsUrl: string;
  status: NoteStatus;
  submittedBy: string;
  createdAt: string;
  helpful: number;
};
type Member = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, "developer">;
  canSubmit: boolean;
  status: "invited" | "active" | "disabled";
};
type Book = {
  id: string;
  subjectId?: string;
  subject: string;
  title: string;
  author: string;
  edition: string;
  description: string;
  price: string;
  currency: string;
  buyUrl: string;
  verifiedAt: string;
  imageName: string;
  accent: string;
  courseConfirmed: boolean;
};
type ApiNote = {
  id: string; subject_id: string; subject: string; book_id: string; book: string;
  chapter: string; topic: string; docs_url: string | null; submitted_by: string;
  created_at: string; helpful_count: number;
};
type ApiBook = {
  id: string; subject_id: string; title: string; author: string; edition: string;
  description: string; image_path: string | null; price_amount: number | null;
  price_currency: string | null; buy_url: string | null; price_verified_at: string | null;
  course_confirmed: boolean;
};
type CourseAnnouncement = { id: string; title: string; body: string; published_at: string };
type CourseExam = { id: string; title: string; details: string; starts_at: string; subjects: { name: string } | null };
type StudyQuestion = {
  id?: string;
  subject: string;
  chapter: string;
  prompt: string;
  options: string[];
  sample?: boolean;
};
type StudyFlashcard = {
  id: string;
  subject: string;
  chapter: string;
  prompt: string;
  answer: string;
  sample: boolean;
  dueAt: string | null;
  intervalSeconds: number;
  repetitions: number;
};
type GamificationSummary = {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastStudiedOn: string | null;
  badges: Array<{ slug: string; name: string; description: string; awardedAt: string }>;
};

const logoPath = "/assets/future-pharmacists-logo.jpeg";
export const LAYERED_LOGO_MODE = false;
const logoDecorations = Array.from({ length: 12 }, (_, index) => index);
const ambientParticleCount = Array.from({ length: 9 }, (_, index) => index);
const subjects = [
  { name: "Physiology", mark: "♡", color: "var(--subject-physiology)", book: "Course textbook not confirmed" },
  { name: "Organic Chemistry", mark: "⌬", color: "var(--subject-organic)", book: "Course textbook not confirmed" },
  { name: "Physical Pharmacy", mark: "⚗", color: "var(--subject-physical)", book: "Course textbook not confirmed" },
  { name: "Biochemistry", mark: "✳", color: "var(--subject-biochemistry)", book: "Course textbook not confirmed" },
  { name: "English", mark: "A", color: "var(--subject-english)", book: "Course resource not confirmed" },
];
const initialNotes: Note[] = [
  { id: "note-1", subject: "Biochemistry", book: "Biochemistry textbook · confirm title", chapter: "Chapter 1 · Course outline to confirm", topic: "Introduction to biochemistry", docsUrl: "", status: "approved", submittedBy: "Course preview", createdAt: "2026-10-20", helpful: 8 },
  { id: "note-2", subject: "Physiology", book: "Physiology textbook · confirm title", chapter: "Chapter 1 · Course outline to confirm", topic: "Homeostasis: sample study topic", docsUrl: "", status: "approved", submittedBy: "Course preview", createdAt: "2026-10-21", helpful: 5 },
  { id: "note-3", subject: "Organic Chemistry", book: "Organic chemistry textbook · confirm title", chapter: "Chapter 1 · Course outline to confirm", topic: "Molecular structure: sample study topic", docsUrl: "", status: "approved", submittedBy: "Course preview", createdAt: "2026-10-22", helpful: 3 },
  { id: "note-4", subject: "Physical Pharmacy", book: "Physical pharmacy textbook · confirm title", chapter: "Chapter 1 · Course outline to confirm", topic: "Solutions: sample study topic", docsUrl: "", status: "approved", submittedBy: "Course preview", createdAt: "2026-10-23", helpful: 4 },
  { id: "note-5", subject: "English", book: "English resource · confirm title", chapter: "Unit 1 · Course outline to confirm", topic: "Academic reading: sample study topic", docsUrl: "", status: "approved", submittedBy: "Course preview", createdAt: "2026-10-24", helpful: 2 },
  { id: "note-6", subject: "Biochemistry", book: "Biochemistry textbook · confirm title", chapter: "Chapter 2 · Course outline to confirm", topic: "Buffers: sample review topic", docsUrl: "", status: "pending", submittedBy: "Invited student preview", createdAt: "2026-10-25", helpful: 0 },
];
const initialMembers: Member[] = [
  { id: "member-1", name: "Dr. Ayesha Khan", email: "teacher@example.edu", role: "teacher", canSubmit: true, status: "active" },
  { id: "member-2", name: "Student Preview", email: "student@example.edu", role: "student", canSubmit: false, status: "active" },
  { id: "member-3", name: "Invited Classmate", email: "invite@example.edu", role: "student", canSubmit: true, status: "invited" },
];
const initialBooks: Book[] = subjects.map((subject, index) => ({
  id: `book-${index}`,
  subject: subject.name,
  title: subject.book,
  author: "Not provided",
  edition: "Not provided",
  description: "Confirm the required title and edition with the current course outline or faculty.",
  price: "",
  currency: "",
  buyUrl: "",
  verifiedAt: "",
  imageName: "",
  accent: ["#254f6b", "#245b3f", "#633b3f", "#554072", "#273a61"][index],
  courseConfirmed: false,
}));
const sampleQuestions: StudyQuestion[] = [
  { subject: "Physiology", chapter: "Homeostasis · sample", prompt: "Which term describes maintaining a relatively stable internal environment?", options: ["Homeostasis", "Metabolism", "Diffusion", "Filtration"] },
  { subject: "Organic Chemistry", chapter: "Bonding · sample", prompt: "How many covalent bonds does a neutral carbon atom commonly form?", options: ["Two", "Three", "Four", "Five"] },
  { subject: "Physical Pharmacy", chapter: "Solutions · sample", prompt: "Which term describes the amount of solute in a defined quantity of solution?", options: ["Concentration", "Filtration", "Adsorption", "Sublimation"] },
  { subject: "Biochemistry", chapter: "Biomolecules · sample", prompt: "Which class includes glucose, a commonly used cellular fuel?", options: ["Carbohydrates", "Nucleic acids", "Steroids", "Minerals"] },
  { subject: "English", chapter: "Paragraphs · sample", prompt: "What does a topic sentence usually introduce?", options: ["The paragraph's main idea", "A reference list", "A new chapter", "A page number"] },
];
const previewFlashcard: StudyFlashcard = {
  id: "preview-flashcard",
  subject: "Study strategies",
  chapter: "Sample reflection",
  prompt: "What should you do before learning an unfamiliar textbook chapter?",
  answer: "Preview the learning objective, then note unfamiliar terms.",
  sample: true,
  dueAt: null,
  intervalSeconds: 0,
  repetitions: 0,
};
const previewGamification: GamificationSummary = {
  xp: 240,
  level: 3,
  xpIntoLevel: 40,
  xpForNextLevel: 100,
  currentStreak: 3,
  longestStreak: 7,
  lastStudiedOn: null,
  badges: [
    { slug: "first-quiz", name: "First quiz", description: "Complete your first quiz attempt.", awardedAt: "" },
    { slug: "seven-day-streak", name: "7-day streak", description: "Study on seven consecutive days.", awardedAt: "" },
  ],
};
const navItems: { key: PageKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "notes", label: "Notes library", icon: "▤" },
  { key: "quiz", label: "Quizzes & study", icon: "✳" },
  { key: "books", label: "Books & resources", icon: "▣" },
];
const pageTitle: Record<PageKey, string> = {
  dashboard: "Dashboard",
  notes: "Notes library",
  quiz: "Quizzes & study",
  books: "Books & resources",
  developer: "Developer desk",
};
const themeChangeEvent = "future-pharmacists-theme-change";
const reduceAnimationsChangeEvent = "future-pharmacists-reduce-animations-change";
const subscribeToNoChanges = () => () => {};
const getLowPowerDeviceSnapshot = () => (navigator.hardwareConcurrency || 8) <= 4;
const getServerLowPowerSnapshot = () => false;
const getReduceAnimationsSnapshot = () => localStorage.getItem("future-pharmacists.reduce-animations.v1") === "true";
const getServerReduceAnimationsSnapshot = () => false;
const subscribeToReduceAnimations = (callback: () => void) => {
  window.addEventListener(reduceAnimationsChangeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(reduceAnimationsChangeEvent, callback);
    window.removeEventListener("storage", callback);
  };
};
function setStoredReduceAnimations(enabled: boolean) {
  localStorage.setItem("future-pharmacists.reduce-animations.v1", String(enabled));
  window.dispatchEvent(new Event(reduceAnimationsChangeEvent));
}
const subscribeToTheme = (callback: () => void) => {
  window.addEventListener(themeChangeEvent, callback);
  return () => window.removeEventListener(themeChangeEvent, callback);
};
const getThemeSnapshot = (): "dark" | "light" => localStorage.getItem("fp-theme-v1") === "light" ? "light" : "dark";
const getServerThemeSnapshot = (): "dark" | "light" => "dark";
const setStoredTheme = (theme: "dark" | "light") => {
  localStorage.setItem("fp-theme-v1", theme);
  window.dispatchEvent(new Event(themeChangeEvent));
};
const subjectColor = (name: string) => subjects.find((subject) => subject.name === name)?.color ?? "var(--color-ring)";
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const isGoogleDocsUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "docs.google.com" && /^\/document\/d\/[^/]+/.test(url.pathname);
  } catch {
    return false;
  }
};
const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
const bookCoverUrl = (path: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || !path) return null;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/book-covers/${encodedPath}`;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "The request could not be completed.";
    throw new Error(message);
  }
  return body as T;
}

export default function FuturePharmacistsApp({ authenticatedUser = null }: { authenticatedUser?: AuthenticatedUser | null }) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const reduceAnimations = useSyncExternalStore(subscribeToReduceAnimations, getReduceAnimationsSnapshot, getServerReduceAnimationsSnapshot);
  const motionEnabled = !reduceMotion && !reduceAnimations;
  const [page, setPage] = useState<PageKey>("dashboard");
  const [preview, setPreview] = useState(false);
  const [intro, setIntro] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [notes, setNotes] = useState<Note[]>(authenticatedUser ? [] : initialNotes);
  const [members, setMembers] = useState<Member[]>(authenticatedUser ? [] : initialMembers);
  const [books, setBooks] = useState<Book[]>(authenticatedUser ? [] : initialBooks);
  const [catalogSubjects, setCatalogSubjects] = useState<CatalogSubject[]>([]);
  const [dataLoading, setDataLoading] = useState(Boolean(authenticatedUser));
  const [loginError, setLoginError] = useState("");
  const [loginShake, setLoginShake] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [loginFlight, setLoginFlight] = useState<{ top: number; left: number; width: number; height: number; x: number; y: number; scale: number } | null>(null);
  const loginLogoRef = useRef<HTMLImageElement>(null);
  const [pageVisible, setPageVisible] = useState(true);
  const lowPowerDevice = useSyncExternalStore(subscribeToNoChanges, getLowPowerDeviceSnapshot, getServerLowPowerSnapshot);
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All subjects");
  const [bookFilter, setBookFilter] = useState("All books");
  const [chapterFilter, setChapterFilter] = useState("All chapters");
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [helpfulNotes, setHelpfulNotes] = useState<string[]>([]);
  const [reportedNotes, setReportedNotes] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState("");
  const [quizLastAnswerCorrect, setQuizLastAnswerCorrect] = useState(false);
  const [liveQuestions, setLiveQuestions] = useState<StudyQuestion[]>([]);
  const [flashcards, setFlashcards] = useState<StudyFlashcard[]>([]);
  const [quizAttemptId, setQuizAttemptId] = useState("");
  const [quizTimeRemaining, setQuizTimeRemaining] = useState<number | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [announcements, setAnnouncements] = useState<CourseAnnouncement[]>([]);
  const [examDates, setExamDates] = useState<CourseExam[]>([]);
  const [quizMode, setQuizMode] = useState("standard");
  const [flashcardSide, setFlashcardSide] = useState(false);
  const [flashcardRating, setFlashcardRating] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [noticeCount, setNoticeCount] = useState(2);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);
  const [toast, setToast] = useState("");
  const [dialog, setDialog] = useState<"note" | "invite" | "book" | "announcement" | "exam" | null>(null);
  const [activeBookId, setActiveBookId] = useState("");
  const [noteSubjectId, setNoteSubjectId] = useState("");
  const [noteFormError, setNoteFormError] = useState("");
  const [modalError, setModalError] = useState("");
  const [auditEntries, setAuditEntries] = useState<string[]>(authenticatedUser ? [] : ["Developer preview started", "Sample notes loaded for visual preview"]);

  useEffect(() => {
    if (!authenticatedUser) return;
    let cancelled = false;
    void (async () => {
      try {
        const studyData = await requestJson<{ notes: ApiNote[]; subjects: CatalogSubject[]; books: ApiBook[] }>("/api/notes");
        if (cancelled) return;
        setCatalogSubjects(studyData.subjects);
        setNoteSubjectId(studyData.subjects[0]?.id ?? "");
        const subjectNames = new Map(studyData.subjects.map((subject) => [subject.id, subject.name]));
        setNotes(studyData.notes.map((note) => ({
          id: note.id,
          subject: note.subject,
          book: note.book,
          chapter: note.chapter,
          topic: note.topic,
          docsUrl: note.docs_url ?? "",
          status: "approved",
          submittedBy: note.submitted_by,
          createdAt: note.created_at,
          helpful: note.helpful_count,
        })));
        setBooks(studyData.books.map((book) => {
          const subject = studyData.subjects.find((item) => item.id === book.subject_id);
          return {
            id: book.id,
            subjectId: book.subject_id,
            subject: subjectNames.get(book.subject_id) ?? "Unassigned subject",
            title: book.title,
            author: book.author,
            edition: book.edition,
            description: book.description,
            price: book.price_amount === null ? "" : String(book.price_amount),
            currency: book.price_currency ?? "",
            buyUrl: book.buy_url ?? "",
            verifiedAt: book.price_verified_at ?? "",
            imageName: book.image_path ?? "",
            accent: subject?.accent_color ?? "var(--color-ring)",
            courseConfirmed: book.course_confirmed,
          };
        }));
        const activity = await requestJson<{ bookmarks: string[]; helpful: string[]; reported: string[] }>("/api/note-activity");
        if (cancelled) return;
        setSavedNotes(activity.bookmarks);
        setHelpfulNotes(activity.helpful);
        setReportedNotes(activity.reported);
        const quizData = await requestJson<{ questions: Array<{ id: string; subject: string; quiz_title: string; chapter: string; prompt: string; options: string[]; sample: boolean }> }>("/api/quizzes");
        if (cancelled) return;
        setLiveQuestions(quizData.questions.map((question) => ({
          id: question.id,
          subject: question.subject,
          chapter: `${question.quiz_title} · ${question.chapter}`,
          prompt: question.prompt,
          options: question.options,
          sample: question.sample,
        })));
        if (quizData.questions.length) {
          const attempt = await requestJson<{ attemptId: string; timeLimitSeconds: number | null }>("/api/quizzes/attempts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "standard" }),
          });
          if (cancelled) return;
          setQuizAttemptId(attempt.attemptId);
          setQuizTimeRemaining(attempt.timeLimitSeconds);
        }
        const courseData = await requestJson<{ announcements: CourseAnnouncement[]; exams: CourseExam[] }>("/api/course-content");
        if (cancelled) return;
        setAnnouncements(courseData.announcements);
        setExamDates(courseData.exams);
        const flashcardData = await requestJson<{ flashcards: StudyFlashcard[] }>("/api/flashcards");
        if (cancelled) return;
        setFlashcards(flashcardData.flashcards);
        const gamificationData = await requestJson<GamificationSummary>("/api/gamification");
        if (cancelled) return;
        setGamification(gamificationData);
        if (authenticatedUser.role === "developer") {
          const desk = await requestJson<{
            pendingNotes: Array<{
              id: string; subject_id: string; book_id: string; chapter: string; topic: string;
              docs_url: string | null; created_at: string; subjects: { name: string };
              books: { title: string }; profiles: { full_name: string; email: string };
            }>;
            members: Array<{
              id: string; email: string; full_name: string; role: Exclude<Role, "developer">;
              status: "invited" | "active" | "disabled"; contribution_permissions: Array<{ content_type: string }>;
            }>;
            audit: Array<{ action: string; entity_type: string; entity_id: string | null; created_at: string }>;
          }>("/api/developer/desk");
          if (cancelled) return;
          const pending = desk.pendingNotes.map((note): Note => ({
            id: note.id,
            subject: note.subjects.name,
            book: note.books.title,
            chapter: note.chapter,
            topic: note.topic,
            docsUrl: note.docs_url ?? "",
            status: "pending",
            submittedBy: note.profiles.full_name || note.profiles.email,
            createdAt: note.created_at,
            helpful: 0,
          }));
          setNotes((current) => [...pending, ...current]);
          setMembers(desk.members.map((member) => ({
            id: member.id,
            name: member.full_name || member.email,
            email: member.email,
            role: member.role,
            canSubmit: member.contribution_permissions.some((permission) => permission.content_type === "note"),
            status: member.status,
          })));
          setAuditEntries(desk.audit.map((entry) => `${entry.action} · ${entry.entity_type} ${entry.entity_id ?? ""} · ${entry.created_at}`));
        }
      } catch (error) {
        if (!cancelled) openToast(error instanceof Error ? error.message : "Study data could not be loaded.");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authenticatedUser]);

  useEffect(() => {
    const seen = sessionStorage.getItem("fp-intro-seen-v1");
    let endTimer: number | undefined;
    const beginTimer = window.setTimeout(() => {
      if (seen || !motionEnabled) {
        setIntroReady(true);
        setIntro(false);
        return;
      }
      setIntro(true);
      endTimer = window.setTimeout(() => {
        setIntro(false);
        setIntroReady(true);
        sessionStorage.setItem("fp-intro-seen-v1", "true");
      }, 2500);
    }, 0);
    return () => {
      window.clearTimeout(beginTimer);
      if (endTimer) window.clearTimeout(endTimer);
    };
  }, [motionEnabled]);

  useEffect(() => {
    const authState = new URLSearchParams(window.location.search).get("auth");
    if (!authState) return;
    const message = authState === "callback_error"
      ? "Your sign-in link may have expired or could not be verified. Ask the developer for a fresh invitation."
      : authState === "not_invited"
        ? "This invitation is no longer active. Ask the developer to send a new one."
        : authState === "missing_code"
          ? "The invitation link is incomplete. Ask the developer to send a new one."
          : "";
    if (message) window.setTimeout(() => displayLoginError(message), 0);
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Could not register the offline app shell.", error);
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setDialog(null);
        if (intro) finishIntro();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [intro]);

  useEffect(() => {
    if (quizTimeRemaining === null || quizTimeRemaining <= 0) return;
    const timer = window.setInterval(() => setQuizTimeRemaining((remaining) => remaining === null ? null : Math.max(0, remaining - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [quizTimeRemaining]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const approvedNotes = useMemo(() => notes.filter((note) => note.status === "approved"), [notes]);
  const pendingNotes = useMemo(() => notes.filter((note) => note.status === "pending"), [notes]);
  const activeBook = books.find((book) => book.id === activeBookId);
  const quizQuestions = preview || !authenticatedUser ? sampleQuestions : liveQuestions;
  const currentQuestion = quizQuestions.length ? quizQuestions[questionIndex % quizQuestions.length] : null;
  const sampleQuestionActive = preview || !authenticatedUser || Boolean(currentQuestion?.sample);

  function displayLoginError(message: string) {
    setLoginError(message);
    setLoginShake(false);
    window.requestAnimationFrame(() => setLoginShake(true));
    window.setTimeout(() => setLoginShake(false), 320);
  }

  function finishIntro() {
    setIntro(false);
    setIntroReady(true);
    sessionStorage.setItem("fp-intro-seen-v1", "true");
  }
  function go(nextPage: PageKey) {
    setPage(nextPage);
    setCommandOpen(false);
    window.scrollTo({ top: 0, behavior: motionEnabled ? "smooth" : "auto" });
  }
  function openToast(message: string) {
    setToast(message);
  }
  async function refreshGamification() {
    try {
      setGamification(await requestJson<GamificationSummary>("/api/gamification"));
    } catch (error) {
      openToast(error instanceof Error ? error.message : "Study progress could not be refreshed.");
    }
  }
  function enterPreview() {
    setPreview(true);
    setPage("dashboard");
    setAuditEntries((entries) => [`Entered visual-only developer preview`, ...entries]);
  }
  async function attemptLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoginPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await requestJson<{ next: string }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      setLoginPending(false);
      setLoginSuccess(true);
      const logo = loginLogoRef.current;
      if (motionEnabled && logo) {
        const source = logo.getBoundingClientRect();
        const mobile = window.matchMedia("(max-width: 760px)").matches;
        const target = {
          top: mobile ? 12 : 20,
          left: mobile ? 15 : 21,
          width: mobile ? 32 : 45,
        };
        setLoginFlight({
          top: source.top,
          left: source.left,
          width: source.width,
          height: source.height,
          x: target.left - source.left,
          y: target.top - source.top,
          scale: target.width / source.width,
        });
        window.setTimeout(() => router.push(result.next), 720);
      } else {
        window.setTimeout(() => router.push(result.next), 160);
      }
    } catch (error) {
      displayLoginError(error instanceof Error ? error.message : "Sign-in failed.");
      setLoginPending(false);
    }
  }
  async function signOut() {
    if (preview) {
      setPreview(false);
      setPage("dashboard");
      return;
    }
    try {
      await requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (error) {
      openToast(error instanceof Error ? error.message : "Sign-out failed.");
    }
  }
  async function updateNoteStatus(id: string, status: NoteStatus) {
    if (!preview && authenticatedUser?.role !== "developer") return openToast("Developer permission required.");
    let reason = "";
    if (status === "rejected" && !preview) {
      const input = window.prompt("Enter a reason for rejecting this submission.");
      if (input === null) return;
      reason = input.trim();
      if (!reason || reason.length > 1000) return openToast("A rejection reason of 1–1,000 characters is required.");
    }
    if (!preview) {
      try {
        await requestJson<{ ok: boolean }>(`/api/notes/${encodeURIComponent(id)}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reason }),
        });
      } catch (error) {
        return openToast(error instanceof Error ? error.message : "Review action failed.");
      }
    }
    setNotes((items) => items.map((note) => note.id === id ? { ...note, status } : note));
    if (preview) setAuditEntries((entries) => [`${status === "approved" ? "Approved" : "Rejected"} sample note ${id}`, ...entries]);
    openToast(preview
      ? status === "approved" ? "Preview note approved and published in this demo." : "Preview note rejected in this demo."
      : status === "approved" ? "Note approved and published." : "Note rejected with the reason recorded.");
  }
  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoteFormError("");
    const form = new FormData(event.currentTarget);
    const docsUrl = String(form.get("docsUrl") ?? "").trim();
    if (docsUrl && !isGoogleDocsUrl(docsUrl)) {
      setNoteFormError("Enter a valid HTTPS Google Docs document URL, or leave it empty.");
      return;
    }
    const submittedSubject = String(form.get("subject") ?? "");
    const submittedBook = String(form.get("book") ?? "");
    if (authenticatedUser) {
      try {
        await requestJson<{ id: string; status: NoteStatus }>("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectId: submittedSubject,
            bookId: submittedBook,
            chapter: String(form.get("chapter") ?? "").trim(),
            topic: String(form.get("topic") ?? "").trim(),
            docsUrl,
          }),
        });
        setDialog(null);
        openToast("Submission saved as pending. It will remain private until the developer approves it.");
      } catch (error) {
        setNoteFormError(error instanceof Error ? error.message : "The note could not be submitted.");
      }
      return;
    }
    const note: Note = {
      id: crypto.randomUUID(),
      subject: subjects.find((subject) => subject.name === submittedSubject)?.name ?? submittedSubject,
      book: submittedBook.trim(),
      chapter: String(form.get("chapter")).trim(),
      topic: String(form.get("topic")).trim(),
      docsUrl,
      status: "pending",
      submittedBy: "Developer preview",
      createdAt: new Date().toISOString().slice(0, 10),
      helpful: 0,
    };
    setNotes((items) => [note, ...items]);
    setDialog(null);
    go("developer");
    openToast("Preview submission saved as pending. It is not visible in the notes library.");
  }
  async function changePermission(id: string, role?: Exclude<Role, "developer">) {
    if (!preview) {
      const member = members.find((item) => item.id === id);
      if (!member) return openToast("Member not found.");
      const nextRole = role ?? member.role;
      const nextCanSubmit = role === undefined ? !member.canSubmit : member.canSubmit;
      try {
        await requestJson<{ ok: boolean }>(`/api/developer/members/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextRole, canSubmitNotes: nextCanSubmit }),
        });
      } catch (error) {
        return openToast(error instanceof Error ? error.message : "Permission update failed.");
      }
    }
    setMembers((items) => items.map((member) => member.id === id ? {
      ...member,
      role: role ?? member.role,
      canSubmit: role === undefined ? !member.canSubmit : member.canSubmit,
    } : member));
    if (preview) setAuditEntries((entries) => [`Updated member access for ${id}`, ...entries]);
    openToast(preview ? "Preview member access changed in memory only." : "Member access updated.");
  }
  async function answerQuiz(answer: string) {
    if (quizAnswered || !currentQuestion) return;
    if (quizTimeRemaining === 0) return openToast("The timed quiz has expired.");
    const selectedIndex = currentQuestion.options.indexOf(answer);
    try {
      let result: { correct: boolean };
      if (authenticatedUser && !preview) {
        if (!quizAttemptId || !currentQuestion.id) return openToast("Start a quiz attempt before answering.");
        result = await requestJson<{ correct: boolean }>(`/api/quizzes/${encodeURIComponent(currentQuestion.id)}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedIndex, attemptId: quizAttemptId }),
        });
      } else {
        result = await requestJson<{ correct: boolean }>("/api/sample-quizzes/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionIndex: questionIndex % sampleQuestions.length, selectedIndex }),
        });
      }
      setQuizAnswered(true);
      setQuizSelectedAnswer(answer);
      setQuizLastAnswerCorrect(result.correct);
      if (authenticatedUser && !preview) void refreshGamification();
      if (result.correct) {
        const score = quizScore + 1;
        setQuizScore(score);
        if (score / quizQuestions.length >= .8) void confetti({ particleCount: 65, spread: 58, origin: { y: .68 }, colors: ["#3dff7a", "#b6ff7a", "#f2b01e", "#f4f1e8"] });
      }
    } catch (error) {
      openToast(error instanceof Error ? error.message : "Your answer could not be checked.");
    }
  }
  async function changeQuizMode(mode: string) {
    setQuizMode(mode);
    setQuizAttemptId("");
    setQuizTimeRemaining(null);
    setQuestionIndex(0);
    setQuizScore(0);
    setQuizAnswered(false);
    setQuizSelectedAnswer("");
    setQuizLastAnswerCorrect(false);
    setQuizCompleted(false);
    setLiveQuestions([]);
    if (preview || !authenticatedUser) return;
    try {
      const questions = await requestJson<{ questions: Array<{ id: string; subject: string; quiz_title: string; chapter: string; prompt: string; options: string[]; sample: boolean }> }>(`/api/quizzes?mode=${encodeURIComponent(mode)}`);
      const mapped = questions.questions.map((question) => ({
        id: question.id,
        subject: question.subject,
        chapter: `${question.quiz_title} · ${question.chapter}`,
        prompt: question.prompt,
        options: question.options,
        sample: question.sample,
      }));
      setLiveQuestions(mapped);
      if (!mapped.length) return;
      const attempt = await requestJson<{ attemptId: string; timeLimitSeconds: number | null }>("/api/quizzes/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      setQuizAttemptId(attempt.attemptId);
      setQuizTimeRemaining(attempt.timeLimitSeconds);
    } catch (error) {
      openToast(error instanceof Error ? error.message : "The quiz mode could not be started.");
    }
  }
  async function rateFlashcard(rating: string) {
    if (preview || !authenticatedUser) {
      setFlashcardRating(`Preview rating: ${rating}`);
      setFlashcardSide(false);
      return;
    }
    const flashcard = flashcards[0];
    if (!flashcard) return openToast("No published flashcards are available.");
    try {
      const result = await requestJson<{ schedule: { due_at: string; interval_seconds: number; repetitions: number } }>("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashcardId: flashcard.id, rating: rating.toLowerCase() }),
      });
      setFlashcards((items) => items.map((item) => item.id === flashcard.id ? {
        ...item,
        dueAt: result.schedule.due_at,
        intervalSeconds: result.schedule.interval_seconds,
        repetitions: result.schedule.repetitions,
      } : item).sort((left, right) => (Date.parse(left.dueAt ?? "") || 0) - (Date.parse(right.dueAt ?? "") || 0)));
      setFlashcardRating(`${rating} · due ${new Date(result.schedule.due_at).toLocaleString()}`);
      setFlashcardSide(false);
      void refreshGamification();
    } catch (error) {
      openToast(error instanceof Error ? error.message : "The flashcard rating could not be saved.");
    }
  }
  function nextQuestion() {
    if (questionIndex === quizQuestions.length - 1) {
      if (quizAttemptId) {
        void requestJson<{ ok: boolean }>("/api/quizzes/attempts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: quizAttemptId }),
        }).catch((error: unknown) => openToast(error instanceof Error ? error.message : "The quiz attempt could not be completed."));
        setQuizAttemptId("");
      }
      setQuizCompleted(true);
      return;
    }
    setQuestionIndex((index) => index + 1);
    setQuizAnswered(false);
    setQuizSelectedAnswer("");
    setQuizLastAnswerCorrect(false);
  }
  function filteredNotes() {
    const q = query.trim().toLowerCase();
    return approvedNotes.filter((note) => {
      const matchesText = [note.topic, note.subject, note.book, note.chapter].join(" ").toLowerCase().includes(q);
      return matchesText
        && (subjectFilter === "All subjects" || subjectFilter === note.subject)
        && (bookFilter === "All books" || bookFilter === note.book)
        && (chapterFilter === "All chapters" || chapterFilter === note.chapter);
    });
  }
  async function toggleSaved(id: string) {
    const nextSaved = !savedNotes.includes(id);
    if (authenticatedUser) {
      try {
        await requestJson<{ ok: boolean }>("/api/note-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "bookmark", noteId: id, enabled: nextSaved }),
        });
      } catch (error) {
        return openToast(error instanceof Error ? error.message : "Bookmark could not be updated.");
      }
    }
    setSavedNotes((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }
  async function markHelpful(id: string) {
    if (helpfulNotes.includes(id)) return;
    if (authenticatedUser) {
      try {
        await requestJson<{ ok: boolean }>("/api/note-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "helpful", noteId: id, enabled: true }),
        });
      } catch (error) {
        return openToast(error instanceof Error ? error.message : "Reaction could not be saved.");
      }
    }
    setHelpfulNotes((items) => [...items, id]);
    setNotes((items) => items.map((note) => note.id === id ? { ...note, helpful: note.helpful + 1 } : note));
  }
  async function reportLink(id: string) {
    if (reportedNotes.includes(id)) return openToast("You have already reported this sample note.");
    if (authenticatedUser) {
      try {
        await requestJson<{ ok: boolean }>("/api/note-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "report", noteId: id }),
        });
      } catch (error) {
        return openToast(error instanceof Error ? error.message : "Broken-link report could not be saved.");
      }
    }
    setReportedNotes((items) => [...items, id]);
    if (preview) setAuditEntries((entries) => [`Reported a possible broken link for ${id}`, ...entries]);
    openToast(preview ? "Report added to this temporary preview." : "Broken-link report sent to the developer review queue.");
  }
  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBook) return;
    const form = new FormData(event.currentTarget);
    const buyUrl = String(form.get("buyUrl") ?? "").trim();
    if (buyUrl && !isHttpsUrl(buyUrl)) return setModalError("The buying link must start with HTTPS.");
    const price = String(form.get("price") ?? "").trim();
    const currency = String(form.get("currency") ?? "").trim();
    const file = form.get("cover");
    let uploadedImagePath = activeBook.imageName;
    if (!preview) {
      try {
        if (file instanceof File && file.size > 0) {
          const uploadForm = new FormData();
          uploadForm.set("cover", file);
          const upload = await requestJson<{ path: string }>(`/api/books/${encodeURIComponent(activeBook.id)}/cover`, {
            method: "POST",
            body: uploadForm,
          });
          uploadedImagePath = upload.path;
        }
        await requestJson<{ ok: boolean }>("/api/books", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activeBook.id,
            title: String(form.get("title")).trim(),
            author: String(form.get("author")).trim(),
            edition: String(form.get("edition")).trim(),
            description: String(form.get("description")).trim(),
            priceAmount: price,
            priceCurrency: currency,
            buyUrl,
            priceVerifiedAt: String(form.get("verifiedAt") ?? "") || null,
            imagePath: uploadedImagePath,
            courseConfirmed: form.get("courseConfirmed") === "on",
          }),
        });
      } catch (error) {
        setModalError(error instanceof Error ? error.message : "The book listing could not be saved.");
        return;
      }
    }
    setBooks((items) => items.map((book) => book.id === activeBook.id ? {
      ...book,
      title: String(form.get("title")).trim(),
      author: String(form.get("author")).trim(),
      edition: String(form.get("edition")).trim(),
      description: String(form.get("description")).trim(),
      price,
      currency,
      buyUrl,
      verifiedAt: String(form.get("verifiedAt") ?? ""),
      imageName: preview && file instanceof File && file.size ? file.name : uploadedImagePath,
      courseConfirmed: form.get("courseConfirmed") === "on",
    } : book));
    if (preview) setAuditEntries((entries) => [`Updated book listing ${activeBook.subject}`, ...entries]);
    setDialog(null);
    setModalError("");
    openToast(preview ? "Book changes are visible in this preview only." : "Book listing saved.");
  }
  async function addInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    if (members.some((member) => member.email.toLowerCase() === email)) {
      setModalError("That email is already in the preview member list.");
      return;
    }
    const name = String(form.get("name")).trim();
    const role = String(form.get("role")) as Exclude<Role, "developer">;
    const canSubmit = form.get("canSubmit") === "on";
    let invitedUserId = "";
    if (!preview) {
      try {
        const result = await requestJson<{ ok: boolean; userId: string; status: string }>("/api/developer/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, role, canSubmitNotes: canSubmit }),
        });
        invitedUserId = result.userId;
      } catch (error) {
        setModalError(error instanceof Error ? error.message : "The invitation could not be sent.");
        return;
      }
    }
    const member: Member = {
      id: preview ? crypto.randomUUID() : invitedUserId,
      name,
      email,
      role,
      canSubmit,
      status: "invited",
    };
    setMembers((items) => [...items, member]);
    if (preview) setAuditEntries((entries) => [`Created local invitation preview for ${email}`, ...entries]);
    setDialog(null);
    setModalError("");
    openToast(preview ? "Local preview invitation created. No email was sent." : "Supabase invitation sent and permissions recorded.");
  }
  async function saveCourseContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const details = String(form.get("details") ?? "").trim();
    const date = String(form.get("date") ?? "");
    if (preview) {
      const id = crypto.randomUUID();
      if (dialog === "announcement") {
        setAnnouncements((items) => [{ id, title, body: details, published_at: new Date().toISOString() }, ...items]);
      } else {
        setExamDates((items) => [{ id, title, details, starts_at: date ? new Date(date).toISOString() : new Date().toISOString(), subjects: null }, ...items]);
      }
      setDialog(null);
      openToast("Saved in this visual preview only.");
      return;
    }
    try {
      await requestJson<{ ok: boolean; id: string }>("/api/course-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: dialog,
          title,
          body: details,
          details,
          startsAt: date ? new Date(date).toISOString() : "",
          subjectId: String(form.get("subjectId") ?? "") || null,
        }),
      });
      const updates = await requestJson<{ announcements: CourseAnnouncement[]; exams: CourseExam[] }>("/api/course-content");
      setAnnouncements(updates.announcements);
      setExamDates(updates.exams);
      setDialog(null);
      openToast(dialog === "announcement" ? "Announcement published." : "Exam date saved.");
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "The course update could not be saved.");
    }
  }
  function openCommand(item: { label: string; page: PageKey }) {
    setCommandOpen(false);
    go(item.page);
  }

  function updateReduceAnimations(enabled: boolean) {
    setStoredReduceAnimations(enabled);
  }

  const pageVariants: Variants = !motionEnabled ? { initial: { opacity: 1 }, animate: { opacity: 1 } } : {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: .34, ease: [.2, .75, .25, 1] as const, staggerChildren: .055 } },
  };
  const itemVariants: Variants = !motionEnabled ? { initial: { opacity: 1 }, animate: { opacity: 1 } } : {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { duration: .35, ease: [.2, .75, .25, 1] as const } },
  };

  if (!preview && !authenticatedUser) {
    return (
      <main className={`login-layout ${pageVisible ? "" : "is-tab-hidden"}`} data-success={loginSuccess ? "true" : "false"} data-motion={motionEnabled ? "on" : "off"}>
        <a className="skip-link" href="#signin">Skip to sign in</a>
        <AmbientBackground lowPower={lowPowerDevice} pageVisible={pageVisible} />
        <section className="login-showcase" aria-label="Future Pharmacists introduction">
          <div className="brand-lockup">
            <Image className="brand-logo" src={logoPath} width={56} height={56} priority alt="Future Pharmacists supplied logo" />
            <span>Future Pharmacists</span>
          </div>
          <div className="login-story">
            <div className="eyebrow">Pharm D · Semester 1</div>
            <h1><span className="shimmer-title">Learn together.<br />Grow with purpose.</span></h1>
            <p>A thoughtful study space for your class: approved notes, practice, and course resources—all in one place.</p>
            <div className="tagline" aria-label="Study, share, support, succeed"><span>Study</span><span>·</span><span>Share</span><span>·</span><span>Support</span><span>·</span><span>Succeed</span></div>
            <LogoStage imageRef={loginLogoRef} reduceMotion={Boolean(reduceMotion) || reduceAnimations} pageVisible={pageVisible} />
          </div>
          <div className="login-footer">A shared learning space for the Pharm D cohort.</div>
        </section>
        <section className="login-panel" id="signin">
          <div className="login-motion-setting"><MotionToggle enabled={reduceAnimations} onToggle={updateReduceAnimations} /></div>
          <motion.form
            className="login-card"
            data-error={loginError ? "true" : "false"}
            data-shake={loginShake ? "true" : "false"}
            onSubmit={attemptLogin}
            initial={!motionEnabled ? false : { opacity: 0, y: 22 }}
            animate={introReady || !motionEnabled ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
            transition={{ duration: .65, delay: introReady ? .08 : 0, ease: [.2, .75, .25, 1] }}
          >
            <div className="eyebrow">Welcome to your study hub</div>
            <h2>Sign in</h2>
            <p>Use the account invited by your developer to access your class workspace.</p>
            <div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" placeholder="you@example.edu" required /></div>
            <div className="form-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Your password" required /></div>
            <p className="form-error" role="alert" aria-live="polite">{loginError}</p>
            <button className="button-primary button-block" type="submit" disabled={loginPending || loginSuccess}>
              {loginPending ? <><span className="button-spinner" aria-hidden="true" /> Signing in…</> : loginSuccess ? <>Signed in <span aria-hidden="true">✓</span></> : <>Sign in <span aria-hidden="true">→</span></>}
            </button>
            <div className="demo-callout"><strong>Invited accounts only.</strong> Public registration is disabled. If Supabase is not configured, sign-in will explain that setup is required.</div>
            <button className="button-secondary button-block" type="button" onClick={enterPreview}>Explore visual preview</button>
            <p className="login-footer" style={{ marginTop: "1rem", textAlign: "center" }}>Google Docs sharing access is controlled by each document owner.</p>
          </motion.form>
        </section>
        <AnimatePresence>
          {intro && <motion.div className="intro-overlay" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .3 }}>
            <AmbientBackground lowPower={lowPowerDevice} pageVisible={pageVisible} />
            <button className="button-secondary intro-skip" type="button" onClick={finishIntro}>Skip intro</button>
            <motion.div className="intro-content" initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .94 }} transition={{ duration: .65, ease: [.2, .75, .25, 1] }}>
              <LogoStage className="intro-logo-stage" reduceMotion={Boolean(reduceMotion) || reduceAnimations} pageVisible={pageVisible} />
              <div className="eyebrow">Study · Share · Support · Succeed</div>
            </motion.div>
          </motion.div>}
        </AnimatePresence>
        <AnimatePresence>
          {loginFlight && <motion.div
            className="login-logo-flight"
            style={{ top: loginFlight.top, left: loginFlight.left, width: loginFlight.width, height: loginFlight.height }}
            initial={{ opacity: 0, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 1, x: loginFlight.x, y: loginFlight.y, scale: loginFlight.scale }}
            transition={{ duration: .65, ease: [.2, .75, .25, 1] }}
            aria-hidden="true"
          ><Image src={logoPath} width={330} height={330} alt="" /></motion.div>}
        </AnimatePresence>
      </main>
    );
  }

  return (
    <div className={`app-frame ${pageVisible ? "" : "is-tab-hidden"}`} data-motion={motionEnabled ? "on" : "off"}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AmbientBackground lowPower={lowPowerDevice} pageVisible={pageVisible} />
      <div className="application">
        <aside className="sidebar">
          <div className="brand-lockup">
            <Image className="brand-logo" src={logoPath} width={45} height={45} alt="" />
            <span>Future Pharmacists<span className="brand-subtitle">PHARM D · SEMESTER 1</span></span>
          </div>
          <div className="nav-caption">Study space</div>
          <nav className="side-nav" aria-label="Main navigation">
            {navItems.map((item) => <NavButton key={item.key} item={item} active={page === item.key} onClick={() => go(item.key)} />)}
            {(preview || authenticatedUser?.role === "developer") && <button className={`nav-link ${page === "developer" ? "is-active" : ""}`} type="button" aria-current={page === "developer" ? "page" : undefined} onClick={() => go("developer")}><span className="nav-symbol" aria-hidden="true">⚙</span>Developer desk</button>}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip"><strong>Small steps. Strong foundations.</strong><p>Revise one useful idea at a time. Progress begins with curiosity.</p></div>
            <div className="user-strip"><div className="avatar">{initials(preview ? "Developer preview" : authenticatedUser?.name ?? "Student")}</div><div><strong>{preview ? "Developer preview" : authenticatedUser?.name}</strong><small>{preview ? "Local visual demo" : `${authenticatedUser?.role} · ${authenticatedUser?.email}`}</small></div><button className="button-quiet" type="button" aria-label={preview ? "Exit visual preview" : "Sign out"} onClick={() => void signOut()}>↪</button></div>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="mobile-brand"><Image src={logoPath} width={32} height={32} alt="" />Future Pharmacists</div>
            <div className="breadcrumbs">Study space <span aria-hidden="true">/</span> <strong>{pageTitle[page]}</strong></div>
            <div className="top-actions">
              <span className="top-pill">Semester 1</span>
              <button className="button-quiet" type="button" aria-label={`${noticeCount} sample notifications`} title="Sample notifications" onClick={() => { setNoticeCount(0); openToast("No new sample notifications."); }}>♧{noticeCount > 0 ? ` ${noticeCount}` : ""}</button>
              <button className="button-quiet" type="button" aria-label="Open search" onClick={() => setCommandOpen(true)}>⌕ <kbd>Ctrl K</kbd></button>
              <MotionToggle enabled={reduceAnimations} onToggle={updateReduceAnimations} />
              <button className="button-quiet" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={() => setStoredTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "☾"}</button>
            </div>
          </header>
          <main id="main-content" className="content">
            <AnimatePresence mode="wait">
              <motion.section key={page} className="page" variants={pageVariants} initial="initial" animate="animate" exit={motionEnabled ? { opacity: 0, y: -5, transition: { duration: .15 } } : undefined}>
                {page === "dashboard" && <Dashboard preview={preview} gamification={preview ? previewGamification : gamification} notes={approvedNotes} pendingCount={pendingNotes.length} books={books} announcements={announcements} examDates={examDates} showDeveloperTools={preview || authenticatedUser?.role === "developer"} onNavigate={go} itemVariants={itemVariants} loading={dataLoading} motionEnabled={motionEnabled} pageVisible={pageVisible} />}
                {page === "notes" && <NotesPage
                  notes={filteredNotes()}
                  query={query}
                  subjectFilter={subjectFilter}
                  bookFilter={bookFilter}
                  chapterFilter={chapterFilter}
                  savedNotes={savedNotes}
                  helpfulNotes={helpfulNotes}
                  reportedNotes={reportedNotes}
                  books={books}
                  onQuery={setQuery}
                  onSubject={setSubjectFilter}
                  onBook={setBookFilter}
                  onChapter={setChapterFilter}
                  onSave={toggleSaved}
                  onHelpful={markHelpful}
                  onReport={reportLink}
                  canSubmit={preview || Boolean(authenticatedUser?.canSubmitNotes)}
                  onOpenSubmit={() => { setNoteFormError(""); setDialog("note"); }}
                  onPreview={() => openToast("Preview note: add and approve a real Google Docs link after Supabase is configured.")}
                  itemVariants={itemVariants}
                  motionEnabled={motionEnabled}
                  preview={preview}
                />}
                {page === "quiz" && <QuizPage
                  question={currentQuestion}
                  flashcard={preview ? previewFlashcard : flashcards[0] ?? null}
                  sample={sampleQuestionActive}
                  completed={quizCompleted}
                  index={questionIndex}
                  score={quizScore}
                  total={quizQuestions.length}
                  answered={quizAnswered}
                  selectedAnswer={quizSelectedAnswer}
                  lastAnswerCorrect={quizLastAnswerCorrect}
                  mode={quizMode}
                  onAnswer={answerQuiz}
                  onNext={nextQuestion}
                  flashcardSide={flashcardSide}
                  onFlip={() => setFlashcardSide((flipped) => !flipped)}
                  flashcardRating={flashcardRating}
                  onRate={(rating) => void rateFlashcard(rating)}
                  itemVariants={itemVariants}
                  motionEnabled={motionEnabled}
                  onMode={changeQuizMode}
                  timeRemaining={quizTimeRemaining}
                  preview={preview}
                  onRestart={() => void changeQuizMode(quizMode)}
                />}
                {page === "books" && <BooksPage books={books} canManage={preview || authenticatedUser?.role === "developer"} onEdit={(id) => { setActiveBookId(id); setModalError(""); setDialog("book"); }} itemVariants={itemVariants} motionEnabled={motionEnabled} />}
                {page === "developer" && (preview || authenticatedUser?.role === "developer") && <DeveloperDesk
                  preview={preview}
                  pendingNotes={pendingNotes}
                  members={members}
                  books={books}
                  auditEntries={auditEntries}
                  onReview={updateNoteStatus}
                  onPermission={changePermission}
                  onInvite={() => { setModalError(""); setDialog("invite"); }}
                  onEditBook={(id) => { setActiveBookId(id); setModalError(""); setDialog("book"); }}
                  onAnnouncement={() => { setModalError(""); setDialog("announcement"); }}
                  onExam={() => { setModalError(""); setDialog("exam"); }}
                  onSettings={() => { updateReduceAnimations(!reduceAnimations); openToast(reduceAnimations ? "Animations enabled." : "Reduced motion enabled."); }}
                  reduceAnimations={reduceAnimations}
                  onReduceAnimations={updateReduceAnimations}
                  leaderboardOptIn={leaderboardOptIn}
                  onLeaderboard={setLeaderboardOptIn}
                  itemVariants={itemVariants}
                />}
              </motion.section>
            </AnimatePresence>
          </main>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item) => <button key={item.key} type="button" aria-current={page === item.key ? "page" : undefined} onClick={() => go(item.key)}><span aria-hidden="true">{item.icon}</span>{item.label.replace(" & resources", "").replace(" & study", "")}</button>)}
          {(preview || authenticatedUser?.role === "developer") && <button type="button" aria-current={page === "developer" ? "page" : undefined} onClick={() => go("developer")}><span aria-hidden="true">⚙</span>Manage</button>}
        </nav>
      </div>
      <AnimatePresence>{commandOpen && <CommandPalette query={commandQuery} setQuery={setCommandQuery} onClose={() => setCommandOpen(false)} onSelect={openCommand} />}</AnimatePresence>
      <AnimatePresence>
        {dialog && <Dialog title={dialogTitle(dialog, activeBook)} onClose={() => { setDialog(null); setModalError(""); }}>
          {dialog === "note" && <form onSubmit={submitNote}>
            <p className="notice"><strong>{preview ? "Visual preview only." : "Approval required."}</strong> {preview ? "This entry is temporary and stored in memory." : "Your submission is saved as pending and remains private until the developer approves it."}</p>
            <div className="form-field"><label htmlFor="note-subject">Subject</label>{authenticatedUser
              ? <select id="note-subject" name="subject" required value={noteSubjectId} onChange={(event) => setNoteSubjectId(event.target.value)}>{catalogSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
              : <select id="note-subject" name="subject" required>{subjects.map((subject) => <option key={subject.name}>{subject.name}</option>)}</select>}</div>
            <div className="form-field"><label htmlFor="note-book">Book</label>{authenticatedUser
              ? <select id="note-book" name="book" required>{books.filter((book) => book.subjectId === noteSubjectId).map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select>
              : <input id="note-book" name="book" required maxLength={160} placeholder="Confirm the textbook name" />}</div>
            <div className="form-field"><label htmlFor="note-chapter">Chapter</label><input id="note-chapter" name="chapter" required maxLength={120} placeholder="Chapter number and title" /></div>
            <div className="form-field"><label htmlFor="note-topic">Custom topic name</label><input id="note-topic" name="topic" required maxLength={120} placeholder="Topic title" /></div>
            <div className="form-field"><label htmlFor="note-docs">Google Docs URL (optional)</label><input id="note-docs" name="docsUrl" type="url" placeholder="https://docs.google.com/document/d/…" /><small>Document sharing access is set by the document owner.</small></div>
            <p className="form-error" role="alert">{noteFormError}</p><button className="button-primary" type="submit">Submit for approval</button>
          </form>}
          {dialog === "invite" && <form onSubmit={addInvitation}>
            <p className="notice"><strong>Preview only:</strong> this adds a local invitation row and does not send email. Real invitations require Supabase Auth from trusted server code.</p>
            <div className="form-field"><label htmlFor="invite-name">Full name</label><input id="invite-name" name="name" required maxLength={100} /></div>
            <div className="form-field"><label htmlFor="invite-email">Email</label><input id="invite-email" name="email" type="email" required /></div>
            <div className="form-field"><label htmlFor="invite-role">Role</label><select id="invite-role" name="role"><option value="student">Student</option><option value="teacher">Teacher</option></select></div>
            <div className="settings-row"><label htmlFor="invite-can-submit">Allow note submissions</label><input id="invite-can-submit" name="canSubmit" type="checkbox" /></div>
            <p className="form-error" role="alert">{modalError}</p><button className="button-primary" type="submit">Create preview invitation</button>
          </form>}
          {dialog === "book" && activeBook && <form onSubmit={saveBook}>
            <p className="notice"><strong>Catalog preview:</strong> book images are selected as files. Secure image storage becomes available after Supabase Storage is configured.</p>
            <div className="form-field"><label htmlFor="book-title">Resource title</label><input id="book-title" name="title" required defaultValue={activeBook.title} /></div>
            <div className="form-field"><label htmlFor="book-author">Author</label><input id="book-author" name="author" defaultValue={activeBook.author} /></div>
            <div className="form-field"><label htmlFor="book-edition">Edition</label><input id="book-edition" name="edition" defaultValue={activeBook.edition} /></div>
            <div className="form-field"><label htmlFor="book-description">Description</label><textarea id="book-description" name="description" rows={3} defaultValue={activeBook.description} /></div>
            <div className="form-field"><label htmlFor="book-price">Price</label><input id="book-price" name="price" placeholder="Not provided" defaultValue={activeBook.price} /></div>
            <div className="form-field"><label htmlFor="book-currency">Currency</label><input id="book-currency" name="currency" placeholder="Not provided" defaultValue={activeBook.currency} /></div>
            <div className="form-field"><label htmlFor="book-verified">Last price verification</label><input id="book-verified" name="verifiedAt" type="date" defaultValue={activeBook.verifiedAt} /></div>
            <div className="form-field"><label htmlFor="book-buy">Buying URL (HTTPS)</label><input id="book-buy" name="buyUrl" type="url" defaultValue={activeBook.buyUrl} /></div>
            <div className="form-field"><label htmlFor="book-cover">Cover image file</label><input id="book-cover" name="cover" type="file" accept="image/png,image/jpeg,image/webp" /><small>{activeBook.imageName ? `Current preview file: ${activeBook.imageName}` : "No cover supplied yet."}</small></div>
            <div className="settings-row"><label htmlFor="book-course-confirmed">Confirmed against the current course outline</label><input id="book-course-confirmed" name="courseConfirmed" type="checkbox" defaultChecked={activeBook.courseConfirmed} /></div>
            <p className="form-error" role="alert">{modalError}</p><button className="button-primary" type="submit">Save listing</button>
          </form>}
          {(dialog === "announcement" || dialog === "exam") && <form onSubmit={saveCourseContent}>
            <p className="notice"><strong>{preview ? "Preview only." : "Developer-managed content."}</strong> {preview ? "This change remains in local preview state." : "This update will be stored in the course database."}</p>
            <div className="form-field"><label htmlFor="event-title">{dialog === "exam" ? "Exam or assignment" : "Announcement title"}</label><input id="event-title" name="title" required maxLength={160} /></div>
            {dialog === "exam" && <><div className="form-field"><label htmlFor="event-date">Date and time</label><input id="event-date" name="date" type="datetime-local" required /></div><div className="form-field"><label htmlFor="event-subject">Subject (optional)</label><select id="event-subject" name="subjectId"><option value="">No subject selected</option>{catalogSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div></>}
            <div className="form-field"><label htmlFor="event-details">{dialog === "exam" ? "Details" : "Announcement text"}</label><textarea id="event-details" name="details" rows={3} maxLength={dialog === "exam" ? 1000 : 4000} required /></div>
            <p className="form-error" role="alert">{modalError}</p><button className="button-primary" type="submit">{dialog === "exam" ? "Save exam date" : "Publish announcement"}</button>
          </form>}
        </Dialog>}
      </AnimatePresence>
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: { key: PageKey; label: string; icon: string }; active: boolean; onClick: () => void }) {
  return <button className="nav-link" type="button" aria-current={active ? "page" : undefined} onClick={onClick}><span className="nav-symbol" aria-hidden="true">{item.icon}</span>{item.label}</button>;
}

function MotionToggle({ enabled, onToggle }: { enabled: boolean; onToggle: (value: boolean) => void }) {
  return <button className="button-quiet motion-toggle" type="button" aria-label="Reduce animations" aria-pressed={enabled} title={`Reduce animations ${enabled ? "enabled" : "disabled"}`} onClick={() => onToggle(!enabled)}>
    <span aria-hidden="true">◌</span><span className="motion-toggle-label">Motion</span>
  </button>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function Dashboard({ preview, gamification, notes, pendingCount, books, announcements, examDates, showDeveloperTools, onNavigate, itemVariants, loading, motionEnabled, pageVisible }: {
  preview: boolean;
  gamification: GamificationSummary | null;
  notes: Note[]; pendingCount: number; books: Book[]; announcements: CourseAnnouncement[]; examDates: CourseExam[];
  showDeveloperTools: boolean; onNavigate: (page: PageKey) => void; itemVariants: Variants;
  loading: boolean; motionEnabled: boolean; pageVisible: boolean;
}) {
  const recent = notes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const nextExam = examDates[0];
  if (loading) return <DashboardSkeleton />;
  return <motion.div variants={itemVariants}>
    <section className="hero-panel">
      <div className="hero-copy"><div className="eyebrow">Pharm D · Semester 1</div><h1>Your next great idea starts here.</h1><p>Build strong foundations with approved notes, focused practice, and resources your class can trust.</p><button className="button-primary" type="button" onClick={() => onNavigate("notes")}>Explore the notes library <span aria-hidden="true">→</span></button></div>
      <Image className="hero-logo" src={logoPath} width={155} height={155} alt="Future Pharmacists supplied logo" />
    </section>
    <div className="stats-grid">
      <StatCard icon="▤" value={String(notes.length)} label={`Approved notes${preview ? " · sample" : ""}`} motionEnabled={motionEnabled} pageVisible={pageVisible} />
      <StatCard icon="✳" value={String(subjects.length)} label={`Subject areas${preview ? " · sample" : ""}`} motionEnabled={motionEnabled} pageVisible={pageVisible} />
      <StatCard icon="▣" value={String(books.length)} label={`Book resources${preview ? " · sample" : ""}`} motionEnabled={motionEnabled} pageVisible={pageVisible} />
      <StatCard icon="✦" value={gamification ? String(gamification.xp) : "—"} label={gamification ? `XP · Level ${gamification.level}${preview ? " · sample" : ""}` : "XP · not available"} motionEnabled={motionEnabled} pageVisible={pageVisible} />
    </div>
    <SectionHeading title="Your five subjects" detail="Subject accents are inspired by the books in your logo." action={<button className="button-quiet" type="button" onClick={() => onNavigate("notes")}>Browse all →</button>} />
    <div className="subject-grid">
      {subjects.map((subject, index) => {
        const count = notes.filter((note) => note.status === "approved" && note.subject === subject.name).length;
        const progress = [36, 22, 48, 61, 18][index];
        return <motion.button key={subject.name} className="subject-card" variants={itemVariants} whileHover={motionEnabled ? { y: -5, rotateX: 1.5, rotateY: -1.5 } : undefined} type="button" style={{ "--accent": subject.color } as CSSProperties} onClick={() => onNavigate("notes")}>
          <span className="subject-icon" aria-hidden="true">{subject.mark}</span><strong>{subject.name}</strong><small>{count} approved notes{preview ? ` · sample · preview progress ${progress}%` : ""}</small>
        </motion.button>;
      })}
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-header"><div><h2>Recently approved notes</h2><p>Published content available to the cohort.</p></div><button className="button-quiet" type="button" onClick={() => onNavigate("notes")}>Library →</button></div>
        {recent.length ? recent.map((note) => <div className="list-row" key={note.id}><span className="list-icon">{note.subject.slice(0, 3).toUpperCase()}</span><div><strong>{note.topic}</strong><small>{note.subject} · {note.chapter}</small></div></div>) : <EmptyState>No approved notes yet.</EmptyState>}
      </section>
      <section className="panel"><div className="panel-header"><div><h2>Study rhythm</h2><p>Build a steady routine and grow your level.</p></div><span className="chip">{preview ? "Preview sample" : gamification ? `${gamification.currentStreak}-day streak` : "Progress unavailable"}</span></div>
        <div className="subject-progress-row"><motion.span className="ring-progress" initial={motionEnabled ? { scale: .2, opacity: .45 } : { scale: 1, opacity: 1 }} whileInView={motionEnabled ? { scale: 1, opacity: 1 } : undefined} viewport={{ once: true, amount: .8 }} transition={{ duration: .75, ease: "easeOut" }} style={{ "--progress": preview ? 43 : gamification ? Math.min(100, gamification.currentStreak / 7 * 100) : 0 } as CSSProperties}><span>{preview ? "3/7" : gamification ? `${gamification.currentStreak}/7` : "—"}</span></motion.span><div><strong>Study streak</strong><small>{preview ? "Sample streak · preview only" : gamification ? `Longest streak: ${gamification.longestStreak} days` : "Real progress could not be loaded."}</small></div></div>
        <div className="progress-track"><motion.span initial={motionEnabled ? { scaleX: 0 } : { scaleX: (gamification?.xpIntoLevel ?? 0) / 100 }} whileInView={motionEnabled ? { scaleX: preview ? .4 : (gamification?.xpIntoLevel ?? 0) / 100 } : undefined} viewport={{ once: true, amount: .8 }} transition={{ duration: .9, ease: "easeOut" }} style={{ transformOrigin: "left" }} /></div>
        <small>{preview ? "40 / 100 XP · sample preview" : gamification ? `${gamification.xpIntoLevel} / ${gamification.xpForNextLevel} XP toward level ${gamification.level + 1}` : "XP progress unavailable."}</small>
        <div className="section-heading"><h2>Badges</h2></div>
        {gamification?.badges.length ? <div className="badge-list">{gamification.badges.map((badge) => <span className="chip" key={badge.slug} title={badge.description}>{badge.name}{preview ? " · sample" : ""}</span>)}</div> : <p className="empty-inline">{preview ? "Sample badges appear here in preview." : "Complete a quiz or build a study streak to earn badges."}</p>}
        <div className="list-row"><span className="list-icon">◷</span><div><strong>Pomodoro focus timer</strong><small>Start a 25-minute study session.</small></div><Pomodoro /></div>
        <div className="list-row"><span className="list-icon">⚑</span><div><strong>{nextExam?.title ?? "Next class deadline"}</strong><small>{nextExam ? new Date(nextExam.starts_at).toLocaleString() : "No deadline provided yet."}</small></div></div>
      </section>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-header"><div><h2>Study books</h2><p>Titles, editions, and prices need faculty/local confirmation.</p></div><button className="button-quiet" type="button" onClick={() => onNavigate("books")}>Open shelf →</button></div>
        {books.slice(0, 3).map((book) => <div className="list-row" key={book.id}><span className="list-icon" style={{ color: subjectColor(book.subject) }}>▣</span><div><strong>{book.subject}</strong><small>{book.price && book.currency ? `${book.currency} ${book.price}` : "Price not provided · confirm locally"}</small></div></div>)}
      </section>
      <section className="panel"><div className="panel-header"><div><h2>Announcements</h2><p>Developer-published course updates.</p></div></div>
        {announcements.slice(0, 3).length ? announcements.slice(0, 3).map((announcement) => <div className="list-row" key={announcement.id}><span className="list-icon">i</span><div><strong>{announcement.title}</strong><small>{announcement.body}</small></div></div>) : <EmptyState>No announcements yet.</EmptyState>}
      </section>
      {showDeveloperTools && <section className="panel"><div className="panel-header"><div><h2>Developer review queue</h2><p>Pending notes stay hidden from ordinary users.</p></div><span className="chip">{pendingCount} pending{preview ? " · sample" : ""}</span></div>
        <div className="list-row"><span className="list-icon">✓</span><div><strong>Approval before publication</strong><small>Contribution permission never grants publish permission.</small></div></div>
      </section>}
    </div>
    <p className="login-footer" style={{ marginTop: "1.4rem", textAlign: "center" }}>Visual demo content is illustrative; verify your actual course list and textbook requirements with faculty.</p>
  </motion.div>;
}

function AmbientBackground({ lowPower, pageVisible }: { lowPower: boolean; pageVisible: boolean }) {
  return <div className={`ambient ${pageVisible ? "" : "is-tab-hidden"}`} data-low-power={lowPower ? "true" : "false"} aria-hidden="true">
    {ambientParticleCount.map((particle) => <span className="ambient-particle" key={particle} data-shape={particle % 3 === 0 ? "capsule" : particle % 3 === 1 ? "leaf" : "molecule"} style={{ "--particle-index": particle } as CSSProperties} />)}
  </div>;
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" role="status" aria-label="Loading dashboard">
    <div className="skeleton-block skeleton-hero" />
    <div className="stats-grid">{ambientParticleCount.slice(0, 4).map((item) => <div className="skeleton-block skeleton-stat" key={item} />)}</div>
    <div className="skeleton-block skeleton-section" />
    <div className="subject-grid">{ambientParticleCount.slice(0, 5).map((item) => <div className="skeleton-block skeleton-subject" key={item} />)}</div>
    <div className="dashboard-grid">{ambientParticleCount.slice(0, 2).map((item) => <div className="skeleton-block skeleton-panel" key={item} />)}</div>
    <span className="visually-hidden">Loading your approved study materials…</span>
  </div>;
}

function StatCard({ icon, value, label, motionEnabled, pageVisible }: { icon: string; value: string; label: string; motionEnabled: boolean; pageVisible: boolean }) {
  return <motion.div className="stat-card" whileHover={motionEnabled ? { y: -3, rotateX: 1, rotateY: -1 } : undefined} transition={{ duration: .2 }}><span className="stat-icon" aria-hidden="true">{icon}</span><div><strong><AnimatedCounter value={value} motionEnabled={motionEnabled} pageVisible={pageVisible} /></strong><small>{label}</small></div></motion.div>;
}

function AnimatedCounter({ value, motionEnabled, pageVisible }: { value: string; motionEnabled: boolean; pageVisible: boolean }) {
  const match = value.match(/^([^\d]*)(\d+)(.*)$/);
  const numericValue = match ? Number(match[2]) : null;
  const counter = useMotionValue(0);
  const display = useTransform(counter, (current) => `${match?.[1] ?? ""}${Math.round(current).toLocaleString()}${match?.[3] ?? ""}`);

  useEffect(() => {
    if (numericValue === null) return;
    if (!motionEnabled) {
      counter.set(numericValue);
      return;
    }
    if (!pageVisible) return;
    const controls = animate(counter, numericValue, { duration: .85, ease: "easeOut" });
    return () => controls.stop();
  }, [counter, motionEnabled, numericValue, pageVisible]);

  return numericValue === null ? <>{value}</> : <motion.span aria-label={value}>{display}</motion.span>;
}

function NotesPage({ notes, query, subjectFilter, bookFilter, chapterFilter, savedNotes, helpfulNotes, reportedNotes, books, canSubmit, onQuery, onSubject, onBook, onChapter, onSave, onHelpful, onReport, onOpenSubmit, onPreview, itemVariants, motionEnabled, preview }: {
  notes: Note[]; query: string; subjectFilter: string; bookFilter: string; chapterFilter: string; savedNotes: string[]; helpfulNotes: string[]; reportedNotes: string[]; books: Book[];
  canSubmit: boolean; onQuery: (value: string) => void; onSubject: (value: string) => void; onBook: (value: string) => void; onChapter: (value: string) => void; onSave: (id: string) => void; onHelpful: (id: string) => void; onReport: (id: string) => void; onOpenSubmit: () => void; onPreview: () => void; itemVariants: Variants; motionEnabled: boolean; preview: boolean;
}) {
  const bookOptions = [...new Set(books.map((book) => book.title))];
  const chapters = [...new Set(notes.map((note) => note.chapter))];
  return <motion.div variants={itemVariants}>
    <PageHeading eyebrow="Shared learning" title="Notes library" description="Subject → book → chapter → custom topic → Google Docs." action={canSubmit ? <button className="button-primary" type="button" onClick={onOpenSubmit}>＋ Submit a note</button> : undefined} />
    <div className="notice"><strong>Link permissions:</strong> the document owner needs to grant access to intended readers. A URL alone does not guarantee that a Google Doc can be opened.</div>
    <div className="toolbar">
      <label className="search-control"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search notes" placeholder="Search topic, book, chapter…" value={query} onChange={(event) => onQuery(event.target.value)} /></label>
      <select aria-label="Filter by subject" value={subjectFilter} onChange={(event) => onSubject(event.target.value)}><option>All subjects</option>{subjects.map((subject) => <option key={subject.name}>{subject.name}</option>)}</select>
      <select aria-label="Filter by book" value={bookFilter} onChange={(event) => onBook(event.target.value)}><option>All books</option>{bookOptions.map((book) => <option key={book}>{book}</option>)}</select>
      <select aria-label="Filter by chapter" value={chapterFilter} onChange={(event) => onChapter(event.target.value)}><option>All chapters</option>{chapters.map((chapter) => <option key={chapter}>{chapter}</option>)}</select>
    </div>
    <div className="section-heading"><h2>{notes.length} approved {notes.length === 1 ? "note" : "notes"}{preview ? " · sample" : ""}</h2><span className="chip">New this week · preview</span></div>
    <div className="card-grid">{notes.length ? notes.map((note) => <motion.article className="note-card" key={note.id} variants={itemVariants} whileHover={motionEnabled ? { y: -4, rotateX: 1.5, rotateY: -1.5 } : undefined} style={{ "--card-accent": subjectColor(note.subject) } as CSSProperties}>
      <div className="card-meta"><span className="chip" style={{ color: subjectColor(note.subject) }}>{note.subject}</span><span className="chip">Approved</span></div>
      <h3>{note.topic}</h3><p>{note.book}<br />{note.chapter}</p>
      <div className="card-footer"><small>By {note.submittedBy}</small><div className="note-actions">
        {note.docsUrl ? isGoogleDocsUrl(note.docsUrl) ? <a className="button-quiet" href={note.docsUrl} target="_blank" rel="noopener noreferrer">Open Doc ↗</a> : <button type="button" onClick={onPreview}>Link unavailable</button> : <button type="button" onClick={onPreview}>Preview note</button>}
        <button type="button" aria-pressed={savedNotes.includes(note.id)} aria-label={savedNotes.includes(note.id) ? "Remove bookmark" : "Bookmark note"} onClick={() => onSave(note.id)}>{savedNotes.includes(note.id) ? "★" : "☆"}</button>
      </div></div>
      <div className="note-actions" style={{ marginTop: ".55rem" }}><button type="button" aria-pressed={helpfulNotes.includes(note.id)} onClick={() => onHelpful(note.id)}>Helpful · {note.helpful}{preview ? " · sample" : ""}</button><button type="button" aria-pressed={reportedNotes.includes(note.id)} onClick={() => onReport(note.id)}>Report link</button></div>
    </motion.article>) : <EmptyState>No approved notes match these filters.</EmptyState>}</div>
  </motion.div>;
}

function QuizPage({ question, flashcard, sample, completed, index, score, total, answered, selectedAnswer, lastAnswerCorrect, mode, onMode, onAnswer, onNext, flashcardSide, onFlip, flashcardRating, onRate, itemVariants, motionEnabled, timeRemaining, preview, onRestart }: {
  question: StudyQuestion | null; flashcard: StudyFlashcard | null; sample: boolean; completed: boolean; index: number; score: number; total: number; answered: boolean; selectedAnswer: string; lastAnswerCorrect: boolean; mode: string; onMode: (value: string) => void; onAnswer: (answer: string) => void; onNext: () => void; flashcardSide: boolean; onFlip: () => void; flashcardRating: string; onRate: (rating: string) => void; itemVariants: Variants; motionEnabled: boolean; timeRemaining: number | null; preview: boolean; onRestart: () => void;
}) {
  const questionNumber = total ? (index % total) + 1 : 0;
  return <motion.div variants={itemVariants}>
    <PageHeading eyebrow="Active recall" title="Quizzes & study" description="Practice questions organized by subject and chapter, with server-checked answers." />
    <div className="notice"><strong>{sample ? "Sample — not yet faculty reviewed." : "Published practice content."}</strong> {sample ? "Replace these example questions with instructor-checked material before academic use." : "The correct answer is checked securely after submission."}</div>
    <div className="toolbar"><label className="search-control"><span aria-hidden="true">✳</span><select aria-label="Quiz mode" value={mode} onChange={(event) => onMode(event.target.value)}><option value="standard">Standard</option><option value="timed">Timed practice</option><option value="daily-challenge">Daily challenge</option><option value="review-mistakes">Review my mistakes</option></select></label><select aria-label="Quiz subject" defaultValue="All subjects"><option>All subjects</option>{subjects.map((subject) => <option key={subject.name}>{subject.name}</option>)}</select></div>
    {completed ? <section className="panel quiz-completion" aria-live="polite"><span className="chip">Practice complete</span><h2>Session complete</h2><p>You answered {score} of {total} questions correctly.</p><button className="button-primary" type="button" onClick={onRestart}>Practice again</button></section>
      : !question ? <EmptyState>{preview ? "No preview questions are available." : "No published questions are available for this mode yet."}</EmptyState> : <>
    <div className="quiz-layout">
      <section className="quiz-card"><div className="quiz-top"><span>{question.subject} · {question.chapter}</span><span>{timeRemaining === null ? "" : `Time left ${Math.floor(timeRemaining / 60).toString().padStart(2, "0")}:${(timeRemaining % 60).toString().padStart(2, "0")} · `}Question {questionNumber} of {total}</span></div>
        <div className="progress-track"><motion.span initial={motionEnabled ? { scaleX: 0 } : { scaleX: questionNumber / total }} animate={motionEnabled ? { scaleX: questionNumber / total } : undefined} transition={{ duration: .45 }} style={{ transformOrigin: "left" }} /></div>
        <h2>{question.prompt}</h2>
        <div className="quiz-options">{question.options.map((option) => {
          const state = answered && option === selectedAnswer ? lastAnswerCorrect ? "correct" : "incorrect" : "";
          return <button className="quiz-option" key={option} type="button" disabled={answered || timeRemaining === 0} data-state={state} onClick={() => onAnswer(option)}>{option}</button>;
        })}</div>
        <div role="status" aria-live="polite" style={{ minHeight: "1.4rem", marginTop: ".7rem", color: answered ? "var(--color-lime)" : "var(--color-muted)", fontSize: ".68rem" }}>{answered ? lastAnswerCorrect ? "Correct answer." : "That answer is not correct. Review the material and try the next question." : ""}</div>
        {answered && <button className="button-primary" type="button" onClick={onNext}>Next question →</button>}
      </section>
      <aside className="panel"><div className="panel-header"><div><h2>Your practice session</h2><p>{preview ? "Progress is not saved in the preview." : "Attempts are saved to your account."}</p></div><span className="chip">{mode.replaceAll("-", " ")}</span></div>
        <div className="score-grid"><div className="score-tile"><strong>{score}</strong><small>{preview ? "Correct in preview" : "Correct answers"}</small></div><div className="score-tile"><strong>{total}</strong><small>{preview ? "Sample questions" : "Questions in this mode"}</small></div></div>
        <div className="section-heading"><h2>Study flashcard</h2></div>
        {flashcard ? <>
          <p className="flashcard-context">{flashcard.subject} · {flashcard.chapter}{flashcard.sample ? " · Sample — not yet faculty reviewed" : ""}</p>
          <button className="flashcard" type="button" data-flipped={flashcardSide} onClick={onFlip} aria-label={flashcardSide ? "Show flashcard prompt" : "Reveal flashcard answer"}>
            <span className="flashcard-inner"><span className="flashcard-face"><span className="chip">{flashcard.sample ? "Sample prompt" : "Prompt"}</span><strong>{flashcardSide ? "Tap to show prompt" : flashcard.prompt}</strong><small>Tap to flip</small></span><span className="flashcard-face back"><span className="chip">{flashcard.sample ? "Sample answer" : "Answer"}</span><strong>{flashcardSide ? flashcard.answer : "Answer hidden"}</strong><small>Practice only</small></span></span>
          </button>
          <div className="study-actions">{["Again", "Good", "Easy"].map((rating) => <button className="button-secondary" type="button" key={rating} onClick={() => onRate(rating)}>{rating}</button>)}</div>
          <p>{flashcardRating || (preview ? "Ratings are not saved in preview." : flashcard.dueAt ? `Next review: ${new Date(flashcard.dueAt).toLocaleString()}` : "New card — rate it after review to schedule the next repetition.")}</p>
        </> : <EmptyState>No published flashcards are available yet.</EmptyState>}
      </aside>
    </div>
    </>}
  </motion.div>;
}

function BooksPage({ books, canManage, onEdit, itemVariants, motionEnabled }: { books: Book[]; canManage: boolean; onEdit: (id: string) => void; itemVariants: Variants; motionEnabled: boolean }) {
  return <motion.div variants={itemVariants}>
    <PageHeading eyebrow="Course essentials" title="Books & resources" description="See what is known, what needs confirmation, and where to compare local buying options." />
    <div className="notice"><strong>Course list not verified.</strong> Titles, editions, prices, and requirements are unconfirmed until your faculty/course outline and local booksellers are checked. Nothing below is represented as required.</div>
    <div className="card-grid">{books.map((book) => <motion.article className="book-card" key={book.id} variants={itemVariants} whileHover={motionEnabled ? { y: -4, rotateX: 1.5, rotateY: -1.5 } : undefined} style={{ "--card-accent": subjectColor(book.subject) } as CSSProperties}>
      <div className="book-art" style={{ "--book-accent": book.accent } as CSSProperties}>
        {book.imageName && bookCoverUrl(book.imageName)
          ? <Image className="book-cover-image" src={bookCoverUrl(book.imageName) ?? ""} alt={`${book.title} cover`} fill sizes="(max-width: 760px) 90vw, (max-width: 1200px) 42vw, 28vw" unoptimized />
          : <div className="book-placeholder">{book.subject}<small>Cover not provided — developer to confirm</small></div>}
      </div>
      <span className="chip" style={{ marginTop: ".7rem", color: subjectColor(book.subject) }}>{book.subject}</span>
      <h3>{book.title}</h3><p>{book.description}</p>
      <div className="card-footer"><small>Author: {book.author || "Not provided — developer to confirm"}<br />Edition: {book.edition || "Not provided — developer to confirm"}</small><span className="chip">{book.courseConfirmed ? "Course list confirmed" : "Not confirmed"}</span></div>
      <div className="price-row"><strong>{book.price && book.currency ? `${book.currency} ${book.price}` : "Price not provided — developer to confirm"}</strong>{book.buyUrl && isHttpsUrl(book.buyUrl) ? <a href={book.buyUrl} target="_blank" rel="noopener noreferrer">Buying options ↗</a> : <a href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(book.subject + " Pharm D textbook")}`} target="_blank" rel="noopener noreferrer">Compare local options ↗</a>}</div>
      {book.verifiedAt && <p>Price checked: {book.verifiedAt}</p>}
      {canManage && <button className="button-quiet" type="button" onClick={() => onEdit(book.id)}>Developer: edit listing</button>}
    </motion.article>)}</div>
  </motion.div>;
}

function LogoStage({ className = "", imageRef, reduceMotion, pageVisible }: { className?: string; imageRef?: Ref<HTMLImageElement>; reduceMotion: boolean; pageVisible: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [orientationEnabled, setOrientationEnabled] = useState(false);
  const lowPower = useSyncExternalStore(subscribeToNoChanges, getLowPowerDeviceSnapshot, getServerLowPowerSnapshot);
  const motionOff = reduceMotion || !pageVisible;

  useEffect(() => {
    if (!orientationEnabled || motionOff) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const stage = stageRef.current;
      if (!stage || event.beta === null || event.gamma === null) return;
      const tiltX = Math.max(-8, Math.min(8, event.beta / 6));
      const tiltY = Math.max(-8, Math.min(8, event.gamma / 4));
      stage.style.setProperty("--tilt-x", `${tiltX}deg`);
      stage.style.setProperty("--tilt-y", `${tiltY}deg`);
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [orientationEnabled, motionOff]);

  async function enableOrientationTilt() {
    if (!("DeviceOrientationEvent" in window)) return;
    const eventConstructor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (eventConstructor.requestPermission) {
      try {
        const permission = await eventConstructor.requestPermission();
        setOrientationEnabled(permission === "granted");
      } catch (error) {
        console.error("Device orientation permission was not granted.", error);
      }
    } else {
      setOrientationEnabled(true);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (motionOff || !window.matchMedia("(pointer: fine)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    event.currentTarget.style.setProperty("--tilt-x", `${(0.5 - y) * 16}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${(x - 0.5) * 16}deg`);
  }

  function resetTilt(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div
      ref={stageRef}
      className={`logo-stage ${className} ${pageVisible ? "" : "is-tab-hidden"}`}
      data-layered-logo-mode={LAYERED_LOGO_MODE ? "on" : "off"}
      data-low-power={lowPower ? "true" : "false"}
      aria-label="Future Pharmacists supplied logo"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
    >
      <Image ref={imageRef} className="logo-stage-image" src={logoPath} width={330} height={330} priority alt="" />
      <div className="logo-book-shine" aria-hidden="true">
        <Image src={logoPath} width={330} height={330} alt="" />
        <span />
      </div>
      <svg className="logo-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" pathLength="1" /></svg>
      <div className="logo-decorations" aria-hidden="true">
        {logoDecorations.map((decoration) => <span key={decoration} data-shape={decoration % 3 === 0 ? "capsule" : decoration % 3 === 1 ? "leaf" : "sparkle"} />)}
      </div>
      <button className="orientation-tilt-button" type="button" onClick={() => void enableOrientationTilt()}>
        {orientationEnabled ? "Motion tilt enabled" : "Enable motion tilt"}
      </button>
    </div>
  );
}

function DeveloperDesk({ preview, pendingNotes, members, books, auditEntries, onReview, onPermission, onInvite, onEditBook, onAnnouncement, onExam, onSettings, reduceAnimations, onReduceAnimations, leaderboardOptIn, onLeaderboard, itemVariants }: {
  preview: boolean; pendingNotes: Note[]; members: Member[]; books: Book[]; auditEntries: string[]; onReview: (id: string, status: NoteStatus) => void; onPermission: (id: string, role?: Exclude<Role, "developer">) => void; onInvite: () => void; onEditBook: (id: string) => void; onAnnouncement: () => void; onExam: () => void; onSettings: () => void; reduceAnimations: boolean; onReduceAnimations: (value: boolean) => void; leaderboardOptIn: boolean; onLeaderboard: (value: boolean) => void; itemVariants: Variants;
}) {
  return <motion.div variants={itemVariants}>
    <PageHeading eyebrow="Owner controls" title="Developer desk" description="Manage invitations, submission permissions, review queue, books, and course announcements." action={<button className="button-primary" type="button" onClick={onInvite}>＋ Invite a member</button>} />
    <div className="notice"><strong>{preview ? "Visual preview only." : "Protected management area."}</strong> {preview ? "These controls change temporary sample data only; no invitations or database updates are made." : "Management actions use authenticated server routes and Supabase policies. Production security still depends on configuring Supabase and passing the RLS test suite."}</div>
    <SectionHeading title="Pending note review" detail="Pending notes stay hidden from the shared library." />
    <div className="management-list">{pendingNotes.length ? pendingNotes.map((note) => <motion.article className="management-card" key={note.id} variants={itemVariants}>
      <div><strong>{note.topic}</strong><small>{note.subject} · {note.book} · {note.chapter}<br />Submitted by {note.submittedBy} · {note.createdAt}</small></div>
      <div className="management-actions"><button className="button-primary" type="button" onClick={() => onReview(note.id, "approved")}>Approve</button><button className="button-danger" type="button" onClick={() => onReview(note.id, "rejected")}>Reject</button></div>
    </motion.article>) : <EmptyState>No notes are waiting for review.</EmptyState>}</div>
    <SectionHeading title="Members & contribution access" detail="Only the developer grants submission permission. Submission never grants publish access." action={<button className="button-secondary" type="button" onClick={onInvite}>Invite a member</button>} />
    <div className="management-list">{members.map((member) => <div className="management-card" key={member.id}>
      <div className="person-row"><span className="avatar">{initials(member.name)}</span><div><strong>{member.name}</strong><small>{member.email} · {member.role} · {member.status}</small></div></div>
      <div className="management-actions">
        <label className="visually-hidden" htmlFor={`member-role-${member.id}`}>Role for {member.name}</label>
        <select id={`member-role-${member.id}`} value={member.role} onChange={(event) => onPermission(member.id, event.target.value === "teacher" ? "teacher" : "student")}>
          <option value="student">Student</option><option value="teacher">Teacher</option>
        </select>
        <button className="button-secondary" type="button" aria-pressed={member.canSubmit} onClick={() => onPermission(member.id)}>{member.canSubmit ? "Can submit notes" : "View only"}</button>
      </div>
    </div>)}</div>
    <SectionHeading title="Course setup" detail="Use faculty-confirmed information; do not assume books, dates, or requirements." />
    <div className="management-actions"><button className="button-secondary" type="button" onClick={onAnnouncement}>＋ Announcement</button><button className="button-secondary" type="button" onClick={onExam}>＋ Exam / deadline</button></div>
    <SectionHeading title="Book catalog" detail="Add verified local prices, dates, purchase links, and covers." />
    <div className="management-list">{books.map((book) => <div className="management-card" key={book.id}><div><strong>{book.subject}: {book.title}</strong><small>{book.price && book.currency ? `${book.currency} ${book.price}` : "Price not provided"} · Edition: {book.edition}</small></div><button className="button-secondary" type="button" onClick={() => onEditBook(book.id)}>Edit</button></div>)}</div>
    <SectionHeading title="Study settings" detail={preview ? "Preferences remain local to this temporary preview." : "These preferences are stored in this browser, not synced across devices."} />
    <div className="panel">
      <div className="settings-row"><label htmlFor="reduce-motion">Reduce animations</label><input id="reduce-motion" type="checkbox" checked={reduceAnimations} onChange={(event) => onReduceAnimations(event.target.checked)} /></div>
      <div className="settings-row"><label htmlFor="leaderboard">Opt in to a display-name-only leaderboard</label><input id="leaderboard" type="checkbox" checked={leaderboardOptIn} onChange={(event) => onLeaderboard(event.target.checked)} /></div>
      <div className="settings-row"><span>Animation setting shortcut</span><button className="button-quiet" type="button" onClick={onSettings}>Toggle reduced motion</button></div>
    </div>
    <SectionHeading title="Audit activity" detail={preview ? "This demo log is volatile and is not an authoritative audit record." : "Sensitive changes are recorded by Supabase; this list reflects the latest loaded records."} />
    <div className="management-list">{auditEntries.slice(0, 8).map((entry, index) => <div className="management-card" key={`${entry}-${index}`}><strong>{entry}</strong><small>{preview ? "Preview memory · not an authoritative audit record" : "Database audit record"}</small></div>)}</div>
    <p className="login-footer" style={{ marginTop: "1.3rem" }}>Leaderboard, notifications, and cross-device study settings still need database-backed integration before they are live features.</p>
  </motion.div>;
}

function Pomodoro() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      if (seconds <= 1) {
        setSeconds(0);
        setRunning(false);
        return;
      }
      setSeconds(seconds - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [running, seconds]);
  const display = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <button className="button-quiet" type="button" aria-label={running ? "Pause Pomodoro" : "Start Pomodoro"} onClick={() => { if (seconds === 0) setSeconds(25 * 60); setRunning((value) => !value); }}>{display} {running ? "Ⅱ" : "▶"}</button>;
}

function CommandPalette({ query, setQuery, onClose, onSelect }: { query: string; setQuery: (value: string) => void; onClose: () => void; onSelect: (item: { label: string; page: PageKey }) => void }) {
  const items = [
    ...navItems.map(({ key, label }) => ({ label, page: key })),
    ...subjects.map((subject) => ({ label: subject.name, page: "notes" as PageKey })),
    ...initialBooks.map((book) => ({ label: book.title, page: "books" as PageKey })),
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return <motion.div className="command-overlay" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div className="command-dialog" role="dialog" aria-modal="true" aria-label="Search platform" initial={{ y: -10, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -8 }} onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => { if (event.key === "Escape") onClose(); }}>
      <input autoFocus type="search" placeholder="Search subjects, notes, books…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="command-results">{items.length ? items.map((item, index) => <button key={`${item.page}-${item.label}-${index}`} type="button" onClick={() => onSelect(item)}>{item.label}<small style={{ float: "right", color: "var(--color-muted)" }}>{pageTitle[item.page]}</small></button>) : <EmptyState>No matching destination.</EmptyState>}</div>
      <small style={{ display: "block", padding: ".55rem", color: "var(--color-muted)" }}>Press Ctrl/Cmd+K to search · Esc to close</small>
    </motion.div>
  </motion.div>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <motion.div className="modal-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section className="dialog" role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: .22 }}>
      <header className="dialog-header"><h2>{title}</h2><button className="button-quiet" type="button" aria-label="Close dialog" onClick={onClose}>×</button></header>
      {children}
    </motion.section>
  </motion.div>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

function dialogTitle(dialog: "note" | "invite" | "book" | "announcement" | "exam", book?: Book) {
  if (dialog === "note") return "Submit a note for approval";
  if (dialog === "invite") return "Invite a class member";
  if (dialog === "book") return `Edit ${book?.subject ?? "book"} resource`;
  if (dialog === "exam") return "Add an exam or deadline";
  return "Create an announcement";
}
