const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "league.json");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const today = new Date();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, () => {
  console.log(`Bullseye League running at http://localhost:${PORT}`);
});

async function handleApi(request, response, url) {
  const state = await ensureState();
  const { method } = request;
  const pathName = url.pathname;

  if (method === "GET" && pathName === "/api/league") {
    return sendJson(response, 200, state);
  }

  if (method === "POST" && pathName === "/api/divisions") {
    const payload = await readJsonBody(request);
    if (!payload?.name || !payload?.format) {
      return sendJson(response, 400, { error: "Division name and match format are required." });
    }

    state.divisions.push({
      id: randomUUID(),
      name: payload.name.trim(),
      format: payload.format.trim()
    });

    await writeState(state);
    return sendJson(response, 200, state);
  }

  if (method === "DELETE" && pathName.startsWith("/api/divisions/")) {
    const divisionId = decodeURIComponent(pathName.replace("/api/divisions/", ""));
    const playerIds = state.players.filter((player) => player.divisionId === divisionId).map((player) => player.id);
    state.divisions = state.divisions.filter((division) => division.id !== divisionId);
    state.players = state.players.filter((player) => player.divisionId !== divisionId);
    state.fixtures = state.fixtures.filter((fixture) => {
      return fixture.divisionId !== divisionId
        && !playerIds.includes(fixture.homePlayerId)
        && !playerIds.includes(fixture.awayPlayerId);
    });

    await writeState(state);
    return sendJson(response, 200, state);
  }

  if (method === "POST" && pathName === "/api/players") {
    const payload = await readJsonBody(request);
    if (!payload?.name || !payload?.divisionId || !payload?.venue) {
      return sendJson(response, 400, { error: "Player name, division, and venue are required." });
    }

    state.players.push({
      id: randomUUID(),
      name: payload.name.trim(),
      divisionId: payload.divisionId,
      venue: payload.venue.trim()
    });

    await writeState(state);
    return sendJson(response, 200, state);
  }

  if (method === "DELETE" && pathName.startsWith("/api/players/")) {
    const playerId = decodeURIComponent(pathName.replace("/api/players/", ""));
    state.players = state.players.filter((player) => player.id !== playerId);
    state.fixtures = state.fixtures.filter((fixture) => fixture.homePlayerId !== playerId && fixture.awayPlayerId !== playerId);

    await writeState(state);
    return sendJson(response, 200, state);
  }

  if (method === "POST" && pathName === "/api/fixtures") {
    const payload = await readJsonBody(request);
    if (!payload?.divisionId || !payload?.homePlayerId || !payload?.awayPlayerId || !payload?.matchDate) {
      return sendJson(response, 400, { error: "Division, players, and match date are required." });
    }

    state.fixtures.push({
      id: randomUUID(),
      divisionId: payload.divisionId,
      homePlayerId: payload.homePlayerId,
      awayPlayerId: payload.awayPlayerId,
      matchDate: payload.matchDate,
      homeScore: null,
      awayScore: null
    });

    await writeState(state);
    return sendJson(response, 200, state);
  }

  if (method === "PATCH" && pathName.startsWith("/api/fixtures/") && pathName.endsWith("/result")) {
    const fixtureId = decodeURIComponent(pathName.replace("/api/fixtures/", "").replace("/result", ""));
    const payload = await readJsonBody(request);
    const fixture = state.fixtures.find((entry) => entry.id === fixtureId);

    if (!fixture || Number.isNaN(Number(payload?.homeScore)) || Number.isNaN(Number(payload?.awayScore))) {
      return sendJson(response, 400, { error: "Fixture and valid scores are required." });
    }

    fixture.homeScore = Number(payload.homeScore);
    fixture.awayScore = Number(payload.awayScore);

    await writeState(state);
    return sendJson(response, 200, state);
  }

  if (method === "POST" && pathName.startsWith("/api/divisions/") && pathName.endsWith("/generate-fixtures")) {
    const divisionId = decodeURIComponent(pathName.replace("/api/divisions/", "").replace("/generate-fixtures", ""));
    generateRoundRobinFixtures(state, divisionId);
    await writeState(state);
    return sendJson(response, 200, state);
  }

  if (method === "POST" && pathName === "/api/reset") {
    const nextState = createDemoState();
    await writeState(nextState);
    return sendJson(response, 200, nextState);
  }

  return sendJson(response, 404, { error: "Not found" });
}

async function serveStatic(response, pathName) {
  const relativePath = pathName === "/" ? "index.html" : pathName.slice(1);
  const filePath = path.join(ROOT_DIR, relativePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "text/plain; charset=utf-8" });
    response.end(file);
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

async function ensureState() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    const state = createDemoState();
    await writeState(state);
    return state;
  }
}

async function writeState(state) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2));
}

function normalizeState(raw) {
  if (Array.isArray(raw?.divisions) && Array.isArray(raw?.players) && Array.isArray(raw?.fixtures)) {
    return raw;
  }

  return createDemoState();
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function createDemoState() {
  const divisions = [
    { id: randomUUID(), name: "Premier Division", format: "Best of 11 legs" },
    { id: randomUUID(), name: "Division One", format: "Best of 9 legs" }
  ];

  const players = [
    { id: randomUUID(), name: "Luke Carter", divisionId: divisions[0].id, venue: "The Red Lion" },
    { id: randomUUID(), name: "Mason Reed", divisionId: divisions[0].id, venue: "Market Tavern" },
    { id: randomUUID(), name: "Ben Walsh", divisionId: divisions[0].id, venue: "The Borough Arms" },
    { id: randomUUID(), name: "Tyler Price", divisionId: divisions[1].id, venue: "Railway Club" },
    { id: randomUUID(), name: "Owen Blake", divisionId: divisions[1].id, venue: "Crown & Anchor" },
    { id: randomUUID(), name: "Elliot Shaw", divisionId: divisions[1].id, venue: "The Fox" }
  ];

  return {
    divisions,
    players,
    fixtures: [
      {
        id: randomUUID(),
        divisionId: divisions[0].id,
        homePlayerId: players[0].id,
        awayPlayerId: players[1].id,
        matchDate: inDays(-7),
        homeScore: 6,
        awayScore: 3
      },
      {
        id: randomUUID(),
        divisionId: divisions[0].id,
        homePlayerId: players[2].id,
        awayPlayerId: players[0].id,
        matchDate: inDays(-2),
        homeScore: 5,
        awayScore: 5
      },
      {
        id: randomUUID(),
        divisionId: divisions[1].id,
        homePlayerId: players[3].id,
        awayPlayerId: players[4].id,
        matchDate: inDays(-4),
        homeScore: 4,
        awayScore: 5
      },
      {
        id: randomUUID(),
        divisionId: divisions[1].id,
        homePlayerId: players[4].id,
        awayPlayerId: players[5].id,
        matchDate: inDays(3),
        homeScore: null,
        awayScore: null
      }
    ]
  };
}

function generateRoundRobinFixtures(state, divisionId) {
  const players = state.players
    .filter((player) => player.divisionId === divisionId)
    .sort((first, second) => first.name.localeCompare(second.name));

  if (players.length < 2) {
    return;
  }

  const existingPairs = new Set(
    state.fixtures
      .filter((fixture) => fixture.divisionId === divisionId)
      .map((fixture) => pairKey(fixture.homePlayerId, fixture.awayPlayerId))
  );

  let offset = 1;
  for (let index = 0; index < players.length; index += 1) {
    for (let inner = index + 1; inner < players.length; inner += 1) {
      const first = players[index];
      const second = players[inner];
      const key = pairKey(first.id, second.id);
      if (existingPairs.has(key)) {
        continue;
      }

      state.fixtures.push({
        id: randomUUID(),
        divisionId,
        homePlayerId: first.id,
        awayPlayerId: second.id,
        matchDate: inDays(offset * 7),
        homeScore: null,
        awayScore: null
      });
      existingPairs.add(key);
      offset += 1;
    }
  }
}

function pairKey(firstId, secondId) {
  return [firstId, secondId].sort().join("-");
}

function inDays(days) {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}
