import assert from "node:assert/strict";
import test from "node:test";
import { buildClientQuoteText, buildClientQuoteMarkdown } from "./core.ts";

// Client Service Reality Patch (25 Aug 2026) -- Pricing Lab "showroom"
// (brief §4/§5). These functions format fields Emmanuel already has;
// they compute nothing. The Dave example from brief §7 is used verbatim
// as the golden case.

const DAVE_INPUT = {
  contentTypeLabel: "Short-form video for landing page",
  turnaroundLabel: "24h",
  complexityLabel: "Simple",
  revisionsIncluded: 3,
  scopeLines: ["Color correction", "Audio adjustment", "Captions easy to read on this page"],
  investmentCents: 10_000,
};

test("buildClientQuoteText matches the brief's example format verbatim", () => {
  const text = buildClientQuoteText(DAVE_INPUT);
  assert.equal(
    text,
    [
      "Content type: Short-form video for landing page",
      "ETA: 24h",
      "Complexity: Simple",
      "Revisions included: 3",
      "What I will do:",
      "• Color correction",
      "• Audio adjustment",
      "• Captions easy to read on this page",
      "Investment: $100.00",
      "Sounds good to you?",
    ].join("\n"),
  );
});

test("buildClientQuoteText never mentions internal cost, hourly rate, or hours", () => {
  const text = buildClientQuoteText(DAVE_INPUT);
  assert.doesNotMatch(text, /\/h\b/);
  assert.doesNotMatch(text, /hour/i);
  assert.doesNotMatch(text, /labor/i);
  assert.doesNotMatch(text, /rate/i);
});

test("buildClientQuoteText handles zero scope lines without a dangling bullet", () => {
  const text = buildClientQuoteText({ ...DAVE_INPUT, scopeLines: [] });
  assert.match(text, /What I will do:\nInvestment:/);
});

test("buildClientQuoteMarkdown carries the same content, Markdown-formatted", () => {
  const markdown = buildClientQuoteMarkdown(DAVE_INPUT);
  assert.match(markdown, /\*\*Content type:\*\* Short-form video for landing page/);
  assert.match(markdown, /\*\*ETA:\*\* 24h/);
  assert.match(markdown, /- Color correction/);
  assert.match(markdown, /- Audio adjustment/);
  assert.match(markdown, /\*\*Investment:\*\* \$100\.00/);
});
