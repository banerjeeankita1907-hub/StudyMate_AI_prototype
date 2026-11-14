"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { generateStudyText } = require("./api/ai.cjs");

const HTML_PATH = path.join(__dirname, "StudyMate_AI_prototype.html");
const MAX_BODY_BYTES = 16 * 1024;
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestWindows = new Map();

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

function setSecurityHeaders(response) {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error("Request body is too large");
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (size > MAX_BODY_BYTES) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        const error = new Error("Request body must be valid JSON");
        error.statusCode = 400;
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function allowRequest(ip, now = Date.now()) {
  const current = requestWindows.get(ip) || { start: now, count: 0 };
  if (now - current.start >= WINDOW_MS) {
    current.start = now;
    current.count = 0;
  }
  current.count += 1;
  requestWindows.set(ip, current);
  return current.count <= MAX_REQUESTS_PER_WINDOW;
}

function createAppServer(options = {}) {
  const generate = options.generateStudyText ?? generateStudyText;
  return http.createServer(async (request, response) => {
    setSecurityHeaders(response);

    const requestUrl = new URL(request.url || "/", "http://localhost");
    if (request.method === "GET" && (requestUrl.pathname === "/" || requestUrl.pathname === "/StudyMate_AI_prototype.html")) {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      });
      fs.createReadStream(HTML_PATH).pipe(response);
      return;
    }

    if (requestUrl.pathname === "/api/ai") {
      if (request.method !== "POST") {
        response.setHeader("allow", "POST");
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      const ip = request.socket.remoteAddress || "unknown";
      if (!allowRequest(ip)) {
        sendJson(response, 429, { error: "Too many AI requests from this connection. Please wait and try again." });
        return;
      }

      try {
        const contentType = String(request.headers["content-type"] || "");
        if (!contentType.toLowerCase().includes("application/json")) {
          sendJson(response, 415, { error: "Content-Type must be application/json" });
          return;
        }
        const body = await readJsonBody(request);
        const text = await generate(body);
        sendJson(response, 200, { text });
      } catch (error) {
        const status = Number.isInteger(error.statusCode) ? error.statusCode : 502;
        if (status >= 500) {
          console.error("StudyMate AI request failed:", error.message);
        }
        sendJson(response, status, {
          error: status === 503
            ? "AI service is not configured. Set ANTHROPIC_API_KEY on the server."
            : status === 400 || status === 413 || status === 415 || status === 429
              ? error.message
              : "AI service is temporarily unavailable. Please try again.",
        });
      }
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = createAppServer();
  server.listen(port, "0.0.0.0", () => {
    console.log("StudyMate is available at http://localhost:" + port);
  });
}

module.exports = {
  createAppServer,
  allowRequest,
  readJsonBody,
};
