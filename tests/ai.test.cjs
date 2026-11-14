const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAiRequest, generateStudyText, ANTHROPIC_URL } = require("../api/ai.cjs");

test("validates non-empty bounded prompts and token limits", () => {
  assert.deepEqual(validateAiRequest({ prompt: "Explain derivatives", maxTokens: 700 }).value, {
    prompt: "Explain derivatives",
    maxTokens: 700,
  });
  assert.ok(validateAiRequest({ prompt: " " }).error);
  assert.ok(validateAiRequest({ prompt: "x".repeat(10001) }).error);
  assert.ok(validateAiRequest({ prompt: "valid", maxTokens: 2001 }).error);
  assert.ok(validateAiRequest({ prompt: "valid", maxTokens: 0 }).error);
});

test("rejects malformed request bodies", () => {
  assert.ok(validateAiRequest(null).error);
  assert.ok(validateAiRequest([]).error);
  assert.ok(validateAiRequest({ prompt: 42 }).error);
});

test("keeps provider key on the server and extracts text blocks", async () => {
  let requestedUrl = "";
  let requestOptions;
  const text = await generateStudyText(
    { prompt: "Explain a Fourier transform", maxTokens: 500 },
    {
      apiKey: "test-server-secret-key",
      model: "test-model",
      fetchImpl: async (url, options) => {
        requestedUrl = url;
        requestOptions = options;
        return {
          ok: true,
          json: async () => ({
            content: [
              { type: "text", text: "A Fourier transform " },
              { type: "tool_use", id: "ignored" },
              { type: "text", text: "maps a signal into frequency components." },
            ],
          }),
        };
      },
    },
  );

  assert.equal(requestedUrl, ANTHROPIC_URL);
  assert.equal(text, "A Fourier transform \nmaps a signal into frequency components.");
  assert.equal(requestOptions.headers["x-api-key"], "test-server-secret-key");
  assert.equal(requestOptions.headers["anthropic-version"], "2023-06-01");
  assert.equal(JSON.parse(requestOptions.body).model, "test-model");
});

test("does not call provider if key is missing", async () => {
  let called = false;
  await assert.rejects(
    () => generateStudyText({ prompt: "Explain algebra" }, {
      apiKey: "",
      fetchImpl: async () => { called = true; },
    }),
    /not configured/,
  );
  assert.equal(called, false);
});

test("maps provider throttling and errors to controlled failures", async () => {
  await assert.rejects(
    () => generateStudyText({ prompt: "Explain algebra" }, {
      apiKey: "test-server-secret-key",
      fetchImpl: async () => ({ ok: false, status: 429 }),
    }),
    error => error.statusCode === 429,
  );
  await assert.rejects(
    () => generateStudyText({ prompt: "Explain algebra" }, {
      apiKey: "test-server-secret-key",
      fetchImpl: async () => ({ ok: true, json: async () => ({ content: [] }) }),
    }),
    /no text content/,
  );
});
