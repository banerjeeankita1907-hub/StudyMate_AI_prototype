const test = require("node:test");
const assert = require("node:assert/strict");
const { createAppServer } = require("../server.cjs");

async function withServer(t, generateStudyText) {
  const server = createAppServer({ generateStudyText });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  return "http://127.0.0.1:" + address.port;
}

test("serves the study app with security headers", async t => {
  const base = await withServer(t, async () => "unused");
  const response = await fetch(base + "/");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(html, /StudyMate AI/);
});

test("same-origin AI endpoint accepts valid JSON and returns generated text", async t => {
  let received;
  const base = await withServer(t, async input => {
    received = input;
    return "A test explanation";
  });
  const response = await fetch(base + "/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Explain an integral", maxTokens: 600 }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: "A test explanation" });
  assert.deepEqual(received, { prompt: "Explain an integral", maxTokens: 600 });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("AI endpoint rejects wrong content type and malformed JSON", async t => {
  const base = await withServer(t, async () => "unused");
  const wrongType = await fetch(base + "/api/ai", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "hello",
  });
  assert.equal(wrongType.status, 415);

  const malformed = await fetch(base + "/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
});

test("AI endpoint maps provider configuration errors to 503", async t => {
  const base = await withServer(t, async () => {
    const error = new Error("missing key");
    error.statusCode = 503;
    throw error;
  });
  const response = await fetch(base + "/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Explain algebra" }),
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /ANTHROPIC_API_KEY/);
});

test("unknown routes return 404", async t => {
  const base = await withServer(t, async () => "unused");
  const response = await fetch(base + "/does-not-exist");
  assert.equal(response.status, 404);
});
