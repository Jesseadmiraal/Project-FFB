const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const port = Number(process.env.PORT || 3000);
const password = process.env.SITE_PASSWORD;

if (!password || password.length < 8) {
  throw new Error("Set SITE_PASSWORD to a password that is at least 8 characters long.");
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const passwordDigest = createHash("sha256").update(password, "utf8").digest();
const sessionLifetime = 8 * 60 * 60 * 1000;
const sessionCookie = "mybrowser_session";
const sessions = new Map();
const loginAttempts = new Map();
const loginWindow = 15 * 60 * 1000;
const maxLoginAttempts = 10;
const publicFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);
const publicDirectory = path.join(__dirname, "public");

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(value));
}

function getSessionId(request) {
  const cookies = request.headers.cookie || "";
  const entry = cookies.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookie}=`));
  return entry ? entry.slice(sessionCookie.length + 1) : "";
}

function isAuthenticated(request) {
  const id = getSessionId(request);
  const session = sessions.get(id);
  if (!session) return false;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return false;
  }
  return true;
}

function isRateLimited(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  if (!attempts || now - attempts.startedAt >= loginWindow) {
    loginAttempts.set(ip, { count: 0, startedAt: now });
    return false;
  }
  return attempts.count >= maxLoginAttempts;
}

function recordFailedLogin(ip) {
  const attempts = loginAttempts.get(ip);
  if (attempts) attempts.count += 1;
  else loginAttempts.set(ip, { count: 1, startedAt: Date.now() });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2048) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function baseHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https: http:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  };
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const ip = request.socket.remoteAddress || "unknown";
  const headers = baseHeaders();

  if (request.method === "GET" && publicFiles.has(url.pathname)) {
    const [filename, contentType] = publicFiles.get(url.pathname);
    const contents = await readFile(path.join(publicDirectory, filename));
    response.writeHead(200, {
      ...headers,
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    response.end(contents);
    return;
  }

  if (url.pathname === "/api/session" && request.method === "GET") {
    sendJson(response, 200, { authenticated: isAuthenticated(request) }, headers);
    return;
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    if (isRateLimited(ip)) {
      sendJson(response, 429, { error: "Too many attempts. Please wait 15 minutes and try again." }, headers);
      return;
    }

    let body;
    try {
      body = await readJson(request);
    } catch {
      sendJson(response, 400, { error: "Enter a valid password." }, headers);
      return;
    }

    const submittedPassword = body && typeof body.password === "string" ? body.password : "";
    const submittedDigest = createHash("sha256").update(submittedPassword, "utf8").digest();
    if (!timingSafeEqual(submittedDigest, passwordDigest)) {
      recordFailedLogin(ip);
      sendJson(response, 401, { error: "That password doesn't match. Try again." }, headers);
      return;
    }

    loginAttempts.delete(ip);
    const id = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + sessionLifetime;
    sessions.set(id, { expiresAt });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    sendJson(response, 200, { authenticated: true }, {
      ...headers,
      "Set-Cookie": `${sessionCookie}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetime / 1000}${secure}`,
    });
    return;
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    sessions.delete(getSessionId(request));
    sendJson(response, 200, { authenticated: false }, {
      ...headers,
      "Set-Cookie": `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Not found." }, headers);
    return;
  }

  response.writeHead(404, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: "Something went wrong. Please try again." }, baseHeaders());
    } else {
      response.destroy();
    }
  });
});

server.listen(port, () => {
  console.log(`mybrowser is listening on http://localhost:${port}`);
});
