import assert from "node:assert/strict";
import test from "node:test";
import { buildCommandSearchItems, filterCommandSearchItems } from "../lib/command-search.ts";

const items = buildCommandSearchItems({
  navigation: [{ key: "notes", label: "Notes library" }, { key: "quiz", label: "Quizzes & study" }],
  subjects: [{ name: "Biochemistry" }],
  notes: [{ id: "note-1", subject: "Biochemistry", book: "Course text", chapter: "Chapter 2", topic: "Buffers" }],
  questions: [{ subject: "Physiology", chapter: "Homeostasis", prompt: "Sample prompt" }],
  books: [{ id: "book-1", subject: "English", title: "Course reader", author: "", edition: "", description: "Academic reading" }],
});

test("command search indexes note, quiz and book content", () => {
  assert.equal(filterCommandSearchItems(items, "buffers")[0]?.page, "notes");
  assert.equal(filterCommandSearchItems(items, "homeostasis")[0]?.page, "quiz");
  assert.equal(filterCommandSearchItems(items, "academic reading")[0]?.page, "books");
});

test("note results retain a notes-library search query", () => {
  const result = filterCommandSearchItems(items, "buffers")[0];
  assert.equal(result?.noteQuery, "Buffers Course text Chapter 2");
});

test("quiz results retain their index without exposing answer data", () => {
  const result = filterCommandSearchItems(items, "sample prompt")[0];
  assert.equal(result?.questionIndex, 0);
  assert.equal("answer" in (result ?? {}), false);
});

test("command search trims case-insensitive queries and caps results", () => {
  assert.equal(filterCommandSearchItems(items, "  BIOCHEMISTRY  ")[0]?.key, "subject:Biochemistry");
  assert.equal(filterCommandSearchItems(items, "", 2).length, 2);
});
