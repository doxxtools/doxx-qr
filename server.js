import express from "express";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const sessions = new Map();
const SESSION_DURATION = 45 * 60 * 1000;

function isValidHttpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

app.get("/", (req, res) => {
  res.send("DoxxQR Advanced Server Running");
});

app.post("/create", (req, res) => {
  const generatorIP =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const { redirectUrl } = req.body;

  if (!redirectUrl || !isValidHttpsUrl(redirectUrl)) {
    return res.status(400).json({ error: "Invalid HTTPS redirect URL" });
  }

  // Remove old session for same IP
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

  setTimeout(() => {
    sessions.delete(sessionId);
  }, SESSION_DURATION);

  res.json({
    sessionId,
    link: `${req.protocol}://${req.get("host")}/s/${sessionId}`,
    expiresInMinutes: 45
  });
});

app.get("/s/:id", (req, res) => {
  const session = sessions.get(req.params.id);

  if (!session) {
    return res.status(404).send("Session expired or invalid.");
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(req.params.id);
    return res.status(410).send("Session expired.");
  }

  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  session.scanData = {
    ip,
    userAgent: req.headers["user-agent"],
    language: req.headers["accept-language"],
    time: new Date().toISOString()
  };

  res.redirect(session.redirectUrl);
});

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