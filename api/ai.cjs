"use strict";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function validateAiRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Request body must be a JSON object" };
  }
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt || prompt.length > 10000) {
    return { error: "Prompt must contain between 1 and 10000 characters" };
  }
  const maxTokens = input.maxTokens === undefined ? 1000 : input.maxTokens;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 2000) {
    return { error: "maxTokens must be an integer from 1 to 2000" };
  }
  return { value: { prompt, maxTokens } };
}

async function generateStudyText(input, options = {}) {
  const checked = validateAiRequest(input);
  if (checked.error) {
    const error = new Error(checked.error);
    error.statusCode = 400;
    throw error;
  }

  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim().length < 10) {
    const error = new Error("AI service is not configured on the server");
    error.statusCode = 503;
    throw error;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    const error = new Error("Server runtime does not provide fetch");
    error.statusCode = 500;
    throw error;
  }

  const model = options.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const response = await fetchImpl(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: checked.value.maxTokens,
      messages: [{ role: "user", content: checked.value.prompt }],
    }),
  });

  if (!response || !response.ok) {
    const error = new Error("AI provider request failed");
    error.statusCode = response && response.status === 429 ? 429 : 502;
    throw error;
  }

  const result = await response.json();
  const text = Array.isArray(result?.content)
    ? result.content
        .filter(block => block && block.type === "text" && typeof block.text === "string")
        .map(block => block.text)
        .join("\n")
    : "";

  if (!text.trim()) {
    const error = new Error("AI provider returned no text content");
    error.statusCode = 502;
    throw error;
  }

  return text;
}

module.exports = {
  ANTHROPIC_URL,
  validateAiRequest,
  generateStudyText,
};
