const express = require("express");
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { chromium, devices } = require("playwright");

const PORT = Number(process.env.PORT || 3000);
const SESSION_TIMEOUT = 5 * 60 * 1000;

const app = express();
app.use(express.json());
app.use(express.static("src/public"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

let browser;
const sessions = new Map();

function modeProfile(mode, orientation = "portrait") {
  if (mode === "mobile") {
    return {
      label:
        orientation === "landscape"
          ? "Galaxy S24 Landscape"
          : "Galaxy S24",
      options:
        orientation === "landscape"
          ? devices["Galaxy S24 landscape"]
          : devices["Galaxy S24"]
    };
  }

  if (mode === "tablet") {
    return {
      label:
        orientation === "landscape"
          ? "iPad Pro 11 Landscape"
          : "iPad Pro 11",
      options:
        orientation === "landscape"
          ? devices["iPad Pro 11 landscape"]
          : devices["iPad Pro 11"]
    };
  }

  return {
    label: "Desktop 1440 × 900",
    options: {
      viewport: {
        width: 1440,
        height: 900
      },
      screen: {
        width: 1440,
        height: 900
      },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    }
  };
}

function normalizeUrl(value) {
  let text = String(value || "").trim();

  if (!text) {
    throw new Error("URL required");
  }

  if (!/^https?:\/\//i.test(text)) {
    text = `https://${text}`;
  }

  const parsed = new URL(text);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  return parsed.toString();
}

function send(ws, data) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function sessionState(session) {
  const profile = modeProfile(
    session.mode,
    session.orientation
  );

  return {
    type: "state",
    sessionId: session.id,
    mode: session.mode,
    orientation: session.orientation,
    url: session.url,
    label: profile.label,
    viewport: profile.options.viewport
  };
}

function touchSession(session) {
  session.lastActivity = Date.now();

  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = null;
  }
}

async function destroySession(id) {
  const session = sessions.get(id);

  if (!session) return;

  sessions.delete(id);

  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
  }

  try {
    if (session.cdp) {
      await session.cdp.send("Page.stopScreencast");
    }
  } catch (_) {}

  try {
    if (session.context) {
      await session.context.close();
    }
  } catch (_) {}

  console.log(`Session destroyed: ${id}`);
}

function scheduleCleanup(session) {
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
  }

  session.cleanupTimer = setTimeout(async () => {
    if (!session.ws || session.ws.readyState !== 1) {
      await destroySession(session.id);
    }
  }, SESSION_TIMEOUT);
}

async function startScreencast(session) {
  session.cdp = await session.context.newCDPSession(
    session.page
  );

  session.cdp.on(
    "Page.screencastFrame",
    async event => {
      if (session.ws) {
        send(session.ws, {
          type: "frame",
          data: event.data,
          metadata: event.metadata
        });
      }

      try {
        await session.cdp.send(
          "Page.screencastFrameAck",
          {
            sessionId: event.sessionId
          }
        );
      } catch (_) {}
    }
  );

  await session.cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 80,
    everyNthFrame: 1
  });
}

async function createPage(session) {
  if (session.cdp) {
    try {
      await session.cdp.send("Page.stopScreencast");
    } catch (_) {}

    session.cdp = null;
  }

  if (session.context) {
    try {
      await session.context.close();
    } catch (_) {}
  }

  const profile = modeProfile(
    session.mode,
    session.orientation
  );

  session.context = await browser.newContext({
    ...profile.options,
    ignoreHTTPSErrors: true
  });

  session.page = await session.context.newPage();

  session.page.on("framenavigated", frame => {
    if (frame === session.page.mainFrame()) {
      session.url = session.page.url();

      send(session.ws, {
        type: "url",
        url: session.url
      });
    }
  });

  session.page.on("load", () => {
    send(session.ws, sessionState(session));
  });

  await session.page.goto(session.url, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  }).catch(err => {
    console.error(
      `Navigation ${session.id}:`,
      err.message
    );
  });

  await startScreencast(session);

  send(session.ws, sessionState(session));
}

async function newSession(id) {
  const session = {
    id,
    mode: "desktop",
    orientation: "landscape",
    url: "https://example.com",
    context: null,
    page: null,
    cdp: null,
    ws: null,
    lastActivity: Date.now(),
    cleanupTimer: null
  };

  sessions.set(id, session);

  await createPage(session);

  console.log(`Session created: ${id}`);

  return session;
}

async function getSession(id) {
  let session = sessions.get(id);

  if (!session) {
    session = await newSession(id);
  }

  touchSession(session);

  return session;
}

function getSessionId(req) {
  const id = String(
    req.headers["x-viewport-session"] || ""
  ).trim();

  if (!id || id.length > 128) {
    throw new Error("Invalid Viewport session");
  }

  return id;
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    application: "Viewport",
    sessions: sessions.size
  });
});

app.get("/api/state", async (req, res) => {
  try {
    const session = await getSession(
      getSessionId(req)
    );

    res.json(sessionState(session));
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message
    });
  }
});

app.post("/api/load", async (req, res) => {
  try {
    const session = await getSession(
      getSessionId(req)
    );

    session.url = normalizeUrl(req.body.url);

    await session.page.goto(session.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    res.json({
      ok: true,
      url: session.url
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message
    });
  }
});

app.post("/api/mode", async (req, res) => {
  try {
    const session = await getSession(
      getSessionId(req)
    );

    const mode = req.body.mode;

    if (
      !["desktop", "tablet", "mobile"].includes(mode)
    ) {
      throw new Error("Invalid mode");
    }

    session.mode = mode;

    if (mode === "desktop") {
      session.orientation = "landscape";
    } else {
      session.orientation = "portrait";
    }

    await createPage(session);

    res.json({
      ok: true,
      ...sessionState(session)
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message
    });
  }
});

app.post("/api/rotate", async (req, res) => {
  try {
    const session = await getSession(
      getSessionId(req)
    );

    if (session.mode !== "desktop") {
      session.orientation =
        session.orientation === "portrait"
          ? "landscape"
          : "portrait";

      await createPage(session);
    }

    res.json({
      ok: true,
      ...sessionState(session)
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message
    });
  }
});

wss.on("connection", async (ws, req) => {
  try {
    const requestUrl = new URL(
      req.url,
      "http://viewport.local"
    );

    let id = requestUrl.searchParams.get("session");

    if (!id || id.length > 128) {
      id = crypto.randomUUID();
    }

    const session = await getSession(id);

    if (
      session.ws &&
      session.ws !== ws &&
      session.ws.readyState === 1
    ) {
      try {
        session.ws.close();
      } catch (_) {}
    }

    session.ws = ws;
    touchSession(session);

    send(ws, sessionState(session));

    ws.on("message", async raw => {
      try {
        touchSession(session);

        const msg = JSON.parse(raw.toString());

        if (!session.page) return;

        if (msg.type === "click") {
          await session.page.mouse.click(
            Number(msg.x),
            Number(msg.y)
          );
        }

        if (msg.type === "move") {
          await session.page.mouse.move(
            Number(msg.x),
            Number(msg.y)
          );
        }

        if (msg.type === "scroll") {
          await session.page.mouse.wheel(
            Number(msg.deltaX || 0),
            Number(msg.deltaY || 0)
          );
        }

        if (msg.type === "keydown") {
          await session.page.keyboard.press(
            String(msg.key)
          );
        }

        if (msg.type === "text") {
          await session.page.keyboard.insertText(
            String(msg.text || "")
          );
        }
      } catch (err) {
        console.error(
          `WebSocket input ${session.id}:`,
          err.message
        );
      }
    });

    ws.on("close", () => {
      if (session.ws === ws) {
        session.ws = null;
        scheduleCleanup(session);
      }
    });
  } catch (err) {
    console.error(
      "WebSocket connection:",
      err.message
    );

    try {
      ws.close();
    } catch (_) {}
  }
});

async function main() {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Viewport listening on port ${PORT}`);
    console.log("Session isolation enabled");
  });
}

async function shutdown() {
  for (const id of [...sessions.keys()]) {
    await destroySession(id);
  }

  try {
    await browser?.close();
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch(err => {
  console.error(err);
  process.exit(1);
});
