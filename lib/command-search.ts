export type CommandSearchPage = "dashboard" | "notes" | "quiz" | "books" | "developer";

export type CommandSearchItem = {
  key: string;
  label: string;
  detail: string;
  page: CommandSearchPage;
  searchText: string;
  noteQuery?: string;
  noteSubject?: string;
  questionIndex?: number;
};

type CommandSearchInput = {
  navigation: Array<{ key: CommandSearchPage; label: string }>;
  subjects: Array<{ name: string }>;
  notes: Array<{ id: string; subject: string; book: string; chapter: string; topic: string }>;
  books: Array<{ id: string; subject: string; title: string; author: string; edition: string; description: string }>;
  questions: Array<{ subject: string; chapter: string; prompt: string }>;
};

export function buildCommandSearchItems({ navigation, subjects, notes, books, questions }: CommandSearchInput): CommandSearchItem[] {
  return [
    ...navigation.map(({ key, label }) => ({
      key: `page:${key}`,
      label,
      detail: "Go to section",
      page: key,
      searchText: label,
    })),
    ...subjects.map(({ name }) => ({
      key: `subject:${name}`,
      label: name,
      detail: "Subject · Notes library",
      page: "notes" as const,
      searchText: `${name} subject notes`,
      noteSubject: name,
    })),
    ...notes.map((note) => ({
      key: `note:${note.id}`,
      label: note.topic,
      detail: `${note.subject} · ${note.book} · ${note.chapter}`,
      page: "notes" as const,
      searchText: `${note.topic} ${note.subject} ${note.book} ${note.chapter}`,
      noteQuery: `${note.topic} ${note.book} ${note.chapter}`,
    })),
    ...questions.map((question, questionIndex) => ({
      key: `quiz:${questionIndex}:${question.prompt}`,
      label: question.prompt,
      detail: `${question.subject} · ${question.chapter} · Quiz`,
      page: "quiz" as const,
      searchText: `${question.subject} ${question.chapter} ${question.prompt}`,
      questionIndex,
    })),
    ...books.map((book) => ({
      key: `book:${book.id}`,
      label: book.title,
      detail: `${book.subject} · Books & resources`,
      page: "books" as const,
      searchText: `${book.title} ${book.subject} ${book.author} ${book.edition} ${book.description}`,
    })),
  ];
}

export function filterCommandSearchItems(items: CommandSearchItem[], query: string, limit = 30): CommandSearchItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return items
    .filter((item) => !normalizedQuery || item.searchText.toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, Math.max(0, limit));
}
