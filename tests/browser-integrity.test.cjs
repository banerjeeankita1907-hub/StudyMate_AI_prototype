const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "StudyMate_AI_prototype.html"), "utf8");

test("inline browser JavaScript parses", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
});

test("browser calls same-origin proxy and contains no provider key or endpoint", () => {
  assert.match(html, /fetch\(["']\/api\/ai["']/);
  assert.doesNotMatch(html, /api\.anthropic\.com|x-api-key|ANTHROPIC_API_KEY/);
});

test("dynamic AI output uses escaped markdown and textContent for quizzes", () => {
  assert.match(html, /function escapeHtml/);
  assert.match(html, /let html = escapeHtml\(md\)/);
  assert.match(html, /question\.textContent/);
  assert.match(html, /escapeHtml\(card\.term\)/);
  assert.match(html, /escapeHtml\(card\.definition\)/);
});

test("HTML IDs are unique", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});
