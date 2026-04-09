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
    state.matches = state.matches.filter((match) => !playerIds.includes(match.playerOneId) && !playerIds.includes(match.playerTwoId));

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
    state.matches = state.matches.filter((match) => match.playerOneId !== playerId && match.playerTwoId !== playerId);

    await writeState(state);
    return sendJson(response, 200, state);
  }

  if (method === "POST" && pathName === "/api/matches") {
    const payload = await readJsonBody(request);
    if (!payload?.playerOneId || !payload?.playerTwoId || !payload?.matchDate) {
      return sendJson(response, 400, { error: "Players and match date are required." });
    }

    const playerOne = state.players.find((player) => player.id === payload.playerOneId);
    const playerTwo = state.players.find((player) => player.id === payload.playerTwoId);
    if (!playerOne || !playerTwo || playerOne.id === playerTwo.id) {
      return sendJson(response, 400, { error: "Two different valid players are required." });
    }

    state.matches.push({
      id: randomUUID(),
      playerOneId: payload.playerOneId,
      playerTwoId: payload.playerTwoId,
      matchDate: payload.matchDate,
      playerOneScore: Number(payload.playerOneScore),
      playerTwoScore: Number(payload.playerTwoScore),
      playerOneAverage: parseOptionalNumber(payload.playerOneAverage),
      playerTwoAverage: parseOptionalNumber(payload.playerTwoAverage),
      playerOne180s: parseOptionalInteger(payload.playerOne180s),
      playerTwo180s: parseOptionalInteger(payload.playerTwo180s)
    });

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
    const normalized = normalizeState(parsed);
    await writeState(normalized);
    return normalized;
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
  if (Array.isArray(raw?.divisions) && Array.isArray(raw?.players) && Array.isArray(raw?.matches)) {
    return {
      divisions: raw.divisions,
      players: raw.players,
      matches: raw.matches.map((match) => ({
        ...match,
        playerOneAverage: parseOptionalNumber(match.playerOneAverage),
        playerTwoAverage: parseOptionalNumber(match.playerTwoAverage),
        playerOne180s: parseOptionalInteger(match.playerOne180s),
        playerTwo180s: parseOptionalInteger(match.playerTwo180s)
      }))
    };
  }

  if (Array.isArray(raw?.divisions) && Array.isArray(raw?.players) && Array.isArray(raw?.fixtures)) {
    return {
      divisions: raw.divisions,
      players: raw.players,
      matches: raw.fixtures
        .filter((fixture) => fixture.homeScore !== null && fixture.awayScore !== null)
        .map((fixture) => ({
          id: fixture.id || randomUUID(),
          playerOneId: fixture.homePlayerId,
          playerTwoId: fixture.awayPlayerId,
          matchDate: fixture.matchDate,
          playerOneScore: fixture.homeScore,
          playerTwoScore: fixture.awayScore,
          playerOneAverage: null,
          playerTwoAverage: null,
          playerOne180s: 0,
          playerTwo180s: 0
        }))
    };
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

  const matches = [
    { id: randomUUID(), playerOneId: players[0].id, playerTwoId: players[1].id, matchDate: "2026-04-01", playerOneScore: 6, playerTwoScore: 3, playerOneAverage: 71.24, playerTwoAverage: 59.18, playerOne180s: 2, playerTwo180s: 0 },
    { id: randomUUID(), playerOneId: players[2].id, playerTwoId: players[0].id, matchDate: "2026-04-06", playerOneScore: 5, playerTwoScore: 5, playerOneAverage: 68.42, playerTwoAverage: 72.1, playerOne180s: 1, playerTwo180s: 2 },
    { id: randomUUID(), playerOneId: players[3].id, playerTwoId: players[4].id, matchDate: "2026-04-04", playerOneScore: 4, playerTwoScore: 5, playerOneAverage: 61.88, playerTwoAverage: 64.37, playerOne180s: 0, playerTwo180s: 1 },
    { id: randomUUID(), playerOneId: players[4].id, playerTwoId: players[0].id, matchDate: "2026-04-08", playerOneScore: 3, playerTwoScore: 6, playerOneAverage: 57.4, playerTwoAverage: 75.83, playerOne180s: 0, playerTwo180s: 3 }
  ];

  return { divisions, players, matches };
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalInteger(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
