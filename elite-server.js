const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const database = require("./db");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "elite-arrows.json");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const DIVISIONS = [
  { id: "elite", name: "Elite" },
  { id: "premier", name: "Premier" },
  { id: "champion", name: "Champion" },
  { id: "diamond", name: "Diamond" },
  { id: "gold", name: "Gold" }
];

http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
}).listen(PORT, () => {
  console.log(`Elite Arrows running at http://localhost:${PORT}`);
});

async function handleApi(request, response, url) {
  const state = await ensureState();
  const payload = request.method === "GET" ? {} : await readJsonBody(request);
  const sessionUserId = payload.sessionUserId ?? url.searchParams.get("sessionUserId") ?? null;

  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    return sendJson(response, 200, sanitizeState(state));
  }

  if (request.method === "POST" && url.pathname === "/api/payment/submit") {
    const currentUser = requireSession(state, sessionUserId);
    if (!currentUser) return sendJson(response, 401, { error: "You need to sign in first." });

    const paymentMethod = payload.paymentMethod?.trim();
    const paymentReference = payload.paymentReference?.trim();
    if (!paymentMethod || !paymentReference) {
      return sendJson(response, 400, { error: "Choose a payment method and add a payment reference." });
    }

    currentUser.paymentStatus = "pending";
    currentUser.paymentMethod = paymentMethod;
    currentUser.paymentReference = paymentReference;
    currentUser.paymentSubmittedAt = new Date().toISOString();
    currentUser.paymentApprovedAt = "";
    currentUser.paymentProofData = typeof payload.paymentProofData === "string" ? payload.paymentProofData : "";
    currentUser.paymentProofName = typeof payload.paymentProofName === "string" ? payload.paymentProofName : "";

    await writeState(state);
    return sendJson(response, 200, withSession(state, currentUser.id));
  }

  if (request.method === "POST" && url.pathname === "/api/chat/message") {
    const currentUser = requireSession(state, sessionUserId);
    if (!currentUser) return sendJson(response, 401, { error: "You need to sign in first." });

    const roomId = payload.roomId?.trim();
    const message = payload.message?.trim();
    const attachments = normalizeMessageAttachments(payload.attachments);
    if (!roomId || (!message && !attachments.length)) {
      return sendJson(response, 400, { error: "Add a message or an attachment." });
    }

    if (!canAccessRoom(state, currentUser, roomId)) {
      return sendJson(response, 403, { error: "You cannot post in that chat." });
    }
    if (roomId === "announcements" && !currentUser.isAdmin) {
      return sendJson(response, 403, { error: "Only admins can post announcements." });
    }

    const room = getOrCreateRoom(state, roomId);
    room.messages.push({
      id: randomUUID(),
      authorId: currentUser.id,
      body: message || "",
      createdAt: new Date().toISOString(),
      editedAt: "",
      replyToId: payload.replyToId?.trim() || "",
      attachments
    });

    await writeState(state);
    return sendJson(response, 200, withSession(state, currentUser.id));
  }

  if (request.method === "POST" && url.pathname === "/api/chat/message/edit") {
    const currentUser = requireSession(state, sessionUserId);
    if (!currentUser) return sendJson(response, 401, { error: "You need to sign in first." });

    const room = state.chats.find((entry) => entry.id === payload.roomId);
    const message = room?.messages.find((entry) => entry.id === payload.messageId);
    if (!room || !message) return sendJson(response, 404, { error: "Message not found." });
    if (message.authorId !== currentUser.id && !currentUser.isAdmin) {
      return sendJson(response, 403, { error: "You can only edit your own messages." });
    }

    const body = payload.message?.trim();
    if (!body && !(message.attachments?.length)) {
      return sendJson(response, 400, { error: "Message text cannot be empty." });
    }

    message.body = body || "";
    message.editedAt = new Date().toISOString();
    await writeState(state);
    return sendJson(response, 200, withSession(state, currentUser.id));
  }

  if (request.method === "POST" && url.pathname === "/api/chat/message/delete") {
    const currentUser = requireSession(state, sessionUserId);
    if (!currentUser) return sendJson(response, 401, { error: "You need to sign in first." });

    const room = state.chats.find((entry) => entry.id === payload.roomId);
    const message = room?.messages.find((entry) => entry.id === payload.messageId);
    if (!room || !message) return sendJson(response, 404, { error: "Message not found." });
    if (message.authorId !== currentUser.id && !currentUser.isAdmin) {
      return sendJson(response, 403, { error: "You can only delete your own messages." });
    }

    room.messages = room.messages.filter((entry) => entry.id !== payload.messageId);
    await writeState(state);
    return sendJson(response, 200, withSession(state, currentUser.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/announcement") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });

    const title = payload.title?.trim();
    const body = payload.body?.trim();
    if (!title || !body) {
      return sendJson(response, 400, { error: "Announcement title and body are required." });
    }

    if (payload.id) {
      const announcement = state.announcements.find((entry) => entry.id === payload.id);
      if (!announcement) return sendJson(response, 404, { error: "Announcement not found." });
      announcement.title = title;
      announcement.body = body;
      announcement.updatedAt = new Date().toISOString();
    } else {
      const announcement = {
        id: randomUUID(),
        title,
        body,
        createdBy: admin.id,
        createdAt: new Date().toISOString(),
        updatedAt: ""
      };
      state.announcements.unshift(announcement);
      getOrCreateRoom(state, "announcements").messages.push({
        id: randomUUID(),
        authorId: admin.id,
        body: `${title}\n\n${body}`,
        createdAt: announcement.createdAt
      });
    }

    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/announcement/delete") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });
    state.announcements = state.announcements.filter((entry) => entry.id !== payload.id);
    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/payment/approve") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });
    const player = state.players.find((entry) => entry.id === payload.id);
    if (!player) return sendJson(response, 404, { error: "Player not found." });
    player.paymentStatus = "paid";
    player.paymentApprovedAt = new Date().toISOString();
    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/payment/reject") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });
    const player = state.players.find((entry) => entry.id === payload.id);
    if (!player) return sendJson(response, 404, { error: "Player not found." });
    player.paymentStatus = "unpaid";
    player.paymentApprovedAt = "";
    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "GET" && url.pathname === "/api/admin/export") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });
    return sendJson(response, 200, state);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/signup") {
    return handleSignup(response, state, payload);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    return handleLogin(response, state, payload);
  }

  if (request.method === "POST" && url.pathname === "/api/profile") {
    const currentUser = requireSession(state, sessionUserId);
    if (!currentUser) return sendJson(response, 401, { error: "You need to sign in first." });

    const username = payload.username?.trim();
    if (username && state.players.some((player) => player.id !== currentUser.id && player.username.toLowerCase() === username.toLowerCase())) {
      return sendJson(response, 400, { error: "That username is already in use." });
    }

    currentUser.username = username || currentUser.username;
    currentUser.bio = payload.bio?.trim() ?? currentUser.bio;
    currentUser.dartCounterLink = payload.dartCounterLink?.trim() ?? currentUser.dartCounterLink;
    currentUser.threeDartAverage = parseOptionalNumber(payload.threeDartAverage);
    if (currentUser.threeDartAverage !== null) currentUser.divisionId = divisionForAverage(currentUser.threeDartAverage);

    await writeState(state);
    return sendJson(response, 200, withSession(state, currentUser.id));
  }

  if (request.method === "POST" && url.pathname === "/api/matches") {
    const currentUser = requireSession(state, sessionUserId);
    if (!currentUser) return sendJson(response, 401, { error: "You need to sign in first." });
    if (!currentUser.isAdmin && currentUser.paymentStatus !== "paid") {
      return sendJson(response, 403, { error: "Pay your league access fee to unlock match submission." });
    }

    const opponentId = payload.opponentId;
    const opponent = state.players.find((player) => player.id === opponentId);
    if (!opponent || opponentId === currentUser.id) {
      return sendJson(response, 400, { error: "Choose a valid opponent." });
    }

    const resultImageData = payload.resultImageData?.trim();
    if (!resultImageData || !resultImageData.startsWith("data:image/")) {
      return sendJson(response, 400, { error: "A result screenshot is required." });
    }

    state.matches.push({
      id: randomUUID(),
      seasonId: state.currentSeasonId,
      fixtureId: payload.fixtureId?.trim() || "",
      submittedBy: currentUser.id,
      playerOneId: currentUser.id,
      playerTwoId: opponentId,
      matchDate: payload.matchDate,
      playerOneScore: Number(payload.playerOneScore),
      playerTwoScore: Number(payload.playerTwoScore),
      playerOneAverage: parseOptionalNumber(payload.playerOneAverage),
      playerTwoAverage: parseOptionalNumber(payload.playerTwoAverage),
      playerOne180s: parseOptionalInteger(payload.playerOne180s),
      playerTwo180s: parseOptionalInteger(payload.playerTwo180s),
      resultImageData,
      resultImageName: payload.resultImageName?.trim() ?? "",
      status: "pending",
      approvedBy: "",
      approvedAt: ""
    });

    await writeState(state);
    return sendJson(response, 200, withSession(state, currentUser.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/team") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });

    const name = payload.name?.trim();
    if (!name) return sendJson(response, 400, { error: "Team name is required." });

    if (payload.id) {
      const team = state.teams.find((entry) => entry.id === payload.id);
      if (!team) return sendJson(response, 404, { error: "Team not found." });
      team.name = name;
    } else {
      state.teams.push({ id: randomUUID(), name });
    }

    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/team/delete") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });

    state.teams = state.teams.filter((team) => team.id !== payload.id);
    state.players = state.players.map((player) => player.teamId === payload.id ? { ...player, teamId: "" } : player);
    state.fixtures = state.fixtures.filter((fixture) => fixture.homeTeamId !== payload.id && fixture.awayTeamId !== payload.id);
    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/player") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });

    const username = payload.username?.trim();
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password?.trim();
    const threeDartAverage = parseOptionalNumber(payload.threeDartAverage);

    if (!username || !email || (!payload.id && !password) || threeDartAverage === null) {
      return sendJson(response, 400, { error: "Username, email, password, and 3-dart average are required." });
    }

    const duplicate = state.players.find((player) => player.id !== payload.id && (player.email === email || player.username.toLowerCase() === username.toLowerCase()));
    if (duplicate) return sendJson(response, 400, { error: "That email or username is already in use." });

    if (payload.id) {
      const player = state.players.find((entry) => entry.id === payload.id);
      if (!player) return sendJson(response, 404, { error: "Player not found." });
      player.username = username;
      player.email = email;
      player.password = password || player.password;
      player.bio = payload.bio?.trim() ?? player.bio;
      player.dartCounterLink = payload.dartCounterLink?.trim() ?? player.dartCounterLink;
      player.threeDartAverage = threeDartAverage;
      player.divisionId = divisionForAverage(threeDartAverage);
      player.teamId = payload.teamId?.trim() ?? "";
      player.isAdmin = Boolean(payload.isAdmin);
    } else {
      state.players.push(createPlayer({
        username,
        email,
        password,
        divisionId: divisionForAverage(threeDartAverage),
        bio: payload.bio ?? "",
        dartCounterLink: payload.dartCounterLink ?? "",
        threeDartAverage,
        isAdmin: Boolean(payload.isAdmin),
        teamId: payload.teamId?.trim() ?? ""
      }));
    }

    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/player/delete") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });

    state.players = state.players.filter((player) => player.id !== payload.id);
    state.matches = state.matches.filter((match) => match.playerOneId !== payload.id && match.playerTwoId !== payload.id);
    state.fixtures = state.fixtures.filter((fixture) => fixture.playerOneId !== payload.id && fixture.playerTwoId !== payload.id);
    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/fixture") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });

    const playerOneId = payload.playerOneId?.trim();
    const playerTwoId = payload.playerTwoId?.trim();
    const scheduledDate = payload.scheduledDate?.trim();
    if (!playerOneId || !playerTwoId || playerOneId === playerTwoId || !scheduledDate) {
      return sendJson(response, 400, { error: "Fixture players and date are required." });
    }

    if (payload.id) {
      const fixture = state.fixtures.find((entry) => entry.id === payload.id);
      if (!fixture) return sendJson(response, 404, { error: "Fixture not found." });
      fixture.playerOneId = playerOneId;
      fixture.playerTwoId = playerTwoId;
      fixture.scheduledDate = scheduledDate;
      fixture.homeTeamId = payload.homeTeamId?.trim() ?? "";
      fixture.awayTeamId = payload.awayTeamId?.trim() ?? "";
      fixture.notes = payload.notes?.trim() ?? "";
    } else {
      state.fixtures.push({
        id: randomUUID(),
        seasonId: state.currentSeasonId,
        playerOneId,
        playerTwoId,
        homeTeamId: payload.homeTeamId?.trim() ?? "",
        awayTeamId: payload.awayTeamId?.trim() ?? "",
        scheduledDate,
        notes: payload.notes?.trim() ?? ""
      });
    }

    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/fixture/delete") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });
    state.fixtures = state.fixtures.filter((fixture) => fixture.id !== payload.id);
    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/results/approve") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });
    const match = state.matches.find((entry) => entry.id === payload.id);
    if (!match) return sendJson(response, 404, { error: "Result submission not found." });
    match.status = "approved";
    match.approvedBy = admin.id;
    match.approvedAt = new Date().toISOString();
    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/results/reject") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });
    state.matches = state.matches.filter((entry) => entry.id !== payload.id);
    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/season") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });

    const name = payload.name?.trim();
    const startDate = payload.startDate?.trim();
    const endDate = payload.endDate?.trim();
    if (!name || !startDate || !endDate) {
      return sendJson(response, 400, { error: "Season name, start date, and end date are required." });
    }

    let activeSeasonId = state.currentSeasonId;
    if (payload.id) {
      const season = state.seasons.find((entry) => entry.id === payload.id);
      if (!season) return sendJson(response, 404, { error: "Season not found." });
      season.name = name;
      season.startDate = startDate;
      season.endDate = endDate;
      season.status = payload.status?.trim() || season.status;
      if (season.status === "active") activeSeasonId = season.id;
      if (season.status === "archived") season.archivedAt = new Date().toISOString();
    } else {
      const season = {
        id: randomUUID(),
        name,
        startDate,
        endDate,
        status: payload.status?.trim() || "active",
        archivedAt: ""
      };
      state.seasons.push(season);
      if (season.status === "active") activeSeasonId = season.id;
    }

    state.seasons.forEach((season) => {
      if (season.id !== activeSeasonId && season.status === "active") season.status = "archived";
    });
    state.currentSeasonId = activeSeasonId;

    await writeState(state);
    return sendJson(response, 200, withSession(state, admin.id));
  }

  if (request.method === "POST" && url.pathname === "/api/admin/import") {
    const admin = requireAdmin(state, sessionUserId);
    if (!admin) return sendJson(response, 403, { error: "Admin access required." });
    const imported = normalizeState(payload.importData);
    await writeState(imported);
    return sendJson(response, 200, withSession(imported, admin.id));
  }

  return sendJson(response, 404, { error: "Not found" });
}

async function handleSignup(response, state, payload) {
  const username = payload.username?.trim();
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim();
  const threeDartAverage = parseOptionalNumber(payload.threeDartAverage);

  if (!username || !email || !password || threeDartAverage === null) {
    return sendJson(response, 400, { error: "Username, email, password, and 3-dart average are required." });
  }

  if (state.players.some((player) => player.email === email || player.username.toLowerCase() === username.toLowerCase())) {
    return sendJson(response, 400, { error: "That email or username is already in use." });
  }

  const player = createPlayer({
    username,
    email,
    password,
    divisionId: divisionForAverage(threeDartAverage),
    bio: payload.bio ?? "",
    dartCounterLink: payload.dartCounterLink ?? "",
    threeDartAverage,
    isAdmin: Boolean(payload.isAdmin),
    teamId: ""
  });

  state.players.push(player);
  await writeState(state);
  return sendJson(response, 200, withSession(state, player.id));
}

function handleLogin(response, state, payload) {
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim();
  const player = state.players.find((entry) => entry.email === email && entry.password === password);
  if (!player) return sendJson(response, 401, { error: "Invalid email or password." });
  return sendJson(response, 200, withSession(state, player.id));
}

function requireSession(state, sessionUserId) {
  return state.players.find((player) => player.id === sessionUserId) ?? null;
}

function requireAdmin(state, sessionUserId) {
  const user = requireSession(state, sessionUserId);
  return user?.isAdmin ? user : null;
}

function normalizeChats(rawChats) {
  const chats = Array.isArray(rawChats) ? rawChats.map((room) => ({
    id: room.id || randomUUID(),
    name: room.name || "Chat",
    type: room.type || "group",
    divisionId: room.divisionId || "",
    participantIds: Array.isArray(room.participantIds) ? room.participantIds : [],
    messages: Array.isArray(room.messages) ? room.messages.map((message) => ({
      id: message.id || randomUUID(),
      authorId: message.authorId || "",
      body: message.body || "",
      createdAt: message.createdAt || new Date().toISOString(),
      editedAt: message.editedAt || "",
      replyToId: message.replyToId || "",
      attachments: normalizeMessageAttachments(message.attachments)
    })) : []
  })) : [];

  const roomIds = new Set(chats.map((room) => room.id));
  if (!roomIds.has("announcements")) chats.unshift({ id: "announcements", name: "Announcements", type: "announcement", divisionId: "", participantIds: [], messages: [] });
  if (!roomIds.has("main")) chats.unshift({ id: "main", name: "Main Group Chat", type: "group", divisionId: "", participantIds: [], messages: [] });
  DIVISIONS.forEach((division) => {
    const roomId = `division-${division.id}`;
    if (!roomIds.has(roomId)) {
      chats.push({ id: roomId, name: `${division.name} Division`, type: "division", divisionId: division.id, participantIds: [], messages: [] });
    }
  });
  return chats;
}

function normalizeMessageAttachments(rawAttachments) {
  if (!Array.isArray(rawAttachments)) return [];
  return rawAttachments
    .map((attachment) => ({
      id: attachment.id || randomUUID(),
      type: attachment.type || "file",
      name: attachment.name || "Attachment",
      dataUrl: typeof attachment.dataUrl === "string" ? attachment.dataUrl : ""
    }))
    .filter((attachment) => attachment.dataUrl.startsWith("data:"));
}

function normalizePaymentStatus(value) {
  return ["unpaid", "pending", "paid"].includes(value) ? value : "unpaid";
}

function normalizePaymentOptions(rawOptions) {
  return {
    bankTransfer: {
      accountName: rawOptions?.bankTransfer?.accountName || "Elite Arrows League",
      sortCode: rawOptions?.bankTransfer?.sortCode || "12-34-56",
      accountNumber: rawOptions?.bankTransfer?.accountNumber || "12345678",
      referenceHint: rawOptions?.bankTransfer?.referenceHint || "Use your username as the reference"
    },
    paypal: {
      email: rawOptions?.paypal?.email || "@Rhyshowe834",
      link: rawOptions?.paypal?.link || ""
    },
    feeLabel: rawOptions?.feeLabel || "League Access Fee",
    feeAmount: rawOptions?.feeAmount || "5.00"
  };
}

function getOrCreateRoom(state, roomId) {
  let room = state.chats.find((entry) => entry.id === roomId);
  if (!room) {
    room = { id: roomId, name: "Direct Chat", type: "direct", divisionId: "", participantIds: [], messages: [] };
    state.chats.push(room);
  }
  return room;
}

function canAccessRoom(state, user, roomId) {
  if (roomId === "main" || roomId === "announcements") return true;
  if (roomId === `division-${user.divisionId}`) return true;
  if (roomId.startsWith("direct:")) {
    const ids = roomId.replace("direct:", "").split("--").filter(Boolean);
    return ids.includes(user.id);
  }
  const room = state.chats.find((entry) => entry.id === roomId);
  if (!room) return false;
  if (room.type === "division") return room.divisionId === user.divisionId;
  return room.type !== "announcement";
}

function createPlayer({ username, email, password, divisionId, bio, dartCounterLink, threeDartAverage, isAdmin, teamId }) {
  return {
    id: randomUUID(),
    username,
    email,
    password,
    divisionId,
    bio,
    dartCounterLink,
    threeDartAverage,
    isAdmin: Boolean(isAdmin),
    teamId: teamId ?? "",
    paymentStatus: Boolean(isAdmin) ? "paid" : "unpaid",
    paymentMethod: "",
    paymentReference: "",
    paymentSubmittedAt: "",
    paymentApprovedAt: "",
    paymentProofData: "",
    paymentProofName: ""
  };
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
    response.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath)] || "text/plain; charset=utf-8" });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

async function ensureState() {
  const defaultState = createInitialState();

  try {
    if (database.hasDatabaseUrl) {
      await database.initializeDatabase(serializeState(defaultState));
      const raw = await database.readState();
      if (raw) {
        return normalizeState(raw);
      }
      return defaultState;
    }

    const raw = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    return normalizeState(raw);
  } catch {
    await writeState(defaultState);
    return defaultState;
  }
}

function normalizeState(raw) {
  const seasons = Array.isArray(raw?.seasons) && raw.seasons.length
    ? raw.seasons.map((season) => ({
        id: season.id || randomUUID(),
        name: season.name || "Season",
        startDate: season.startDate || "2026-05-15",
        endDate: season.endDate || "2026-06-16",
        status: season.status || "active",
        archivedAt: season.archivedAt || ""
      }))
    : [{
        id: randomUUID(),
        name: "2026 Season",
        startDate: "2026-05-15",
        endDate: "2026-06-16",
        status: "active",
        archivedAt: ""
      }];

  let currentSeasonId = raw?.currentSeasonId;
  if (!seasons.some((season) => season.id === currentSeasonId)) {
    currentSeasonId = seasons.find((season) => season.status === "active")?.id || seasons[0].id;
  }

  return {
    divisions: DIVISIONS,
    currentSeasonId,
    seasons,
    teams: Array.isArray(raw?.teams) ? raw.teams.map((team) => ({
      id: team.id || randomUUID(),
      name: team.name || "Team"
    })) : [],
    fixtures: Array.isArray(raw?.fixtures) ? raw.fixtures.map((fixture) => ({
      id: fixture.id || randomUUID(),
      seasonId: fixture.seasonId || currentSeasonId,
      playerOneId: fixture.playerOneId || "",
      playerTwoId: fixture.playerTwoId || "",
      homeTeamId: fixture.homeTeamId || "",
      awayTeamId: fixture.awayTeamId || "",
      scheduledDate: fixture.scheduledDate || "",
      notes: fixture.notes || ""
    })) : [],
    players: Array.isArray(raw?.players) ? raw.players.map((player) => ({
      ...player,
      divisionId: DIVISIONS.some((division) => division.id === player.divisionId) ? player.divisionId : "gold",
      bio: player.bio ?? "",
      dartCounterLink: player.dartCounterLink ?? "",
      threeDartAverage: parseOptionalNumber(player.threeDartAverage),
      isAdmin: Boolean(player.isAdmin),
      teamId: player.teamId ?? "",
      paymentStatus: Boolean(player.isAdmin) ? "paid" : normalizePaymentStatus(player.paymentStatus),
      paymentMethod: player.paymentMethod ?? "",
      paymentReference: player.paymentReference ?? "",
      paymentSubmittedAt: player.paymentSubmittedAt ?? "",
      paymentApprovedAt: player.paymentApprovedAt ?? "",
      paymentProofData: player.paymentProofData ?? "",
      paymentProofName: player.paymentProofName ?? ""
    })) : [],
    announcements: Array.isArray(raw?.announcements) ? raw.announcements.map((announcement) => ({
      id: announcement.id || randomUUID(),
      title: announcement.title || "League Update",
      body: announcement.body || "",
      createdBy: announcement.createdBy || "",
      createdAt: announcement.createdAt || new Date().toISOString(),
      updatedAt: announcement.updatedAt || ""
    })) : [],
    chats: normalizeChats(raw?.chats),
    paymentOptions: normalizePaymentOptions(raw?.paymentOptions),
    matches: Array.isArray(raw?.matches) ? raw.matches.map((match) => ({
      ...match,
      seasonId: match.seasonId || currentSeasonId,
      fixtureId: match.fixtureId || "",
      playerOneAverage: parseOptionalNumber(match.playerOneAverage),
      playerTwoAverage: parseOptionalNumber(match.playerTwoAverage),
      playerOne180s: parseOptionalInteger(match.playerOne180s),
      playerTwo180s: parseOptionalInteger(match.playerTwo180s),
      resultImageData: typeof match.resultImageData === "string" ? match.resultImageData : "",
      resultImageName: typeof match.resultImageName === "string" ? match.resultImageName : "",
      status: match.status === "approved" ? "approved" : "pending",
      approvedBy: match.approvedBy || "",
      approvedAt: match.approvedAt || ""
    })) : []
  };
}

function createInitialState() {
  return normalizeState({
    seasons: [{
      name: "2026 Season",
      startDate: "2026-05-15",
      endDate: "2026-06-16",
      status: "active"
    }],
    teams: [],
    fixtures: [],
    paymentOptions: normalizePaymentOptions(undefined),
    announcements: [],
    chats: [],
    players: [],
    matches: []
  });
}

async function writeState(state) {
  const payload = serializeState(state);

  if (database.hasDatabaseUrl) {
    await database.writeState(payload);
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2));
}

function sanitizeState(state) {
  return {
    ...state,
    players: state.players.map((player) => ({
      id: player.id,
      username: player.username,
      email: player.email,
      divisionId: player.divisionId,
      bio: player.bio,
      dartCounterLink: player.dartCounterLink,
      threeDartAverage: player.threeDartAverage,
      isAdmin: Boolean(player.isAdmin),
      teamId: player.teamId ?? "",
      paymentStatus: player.paymentStatus,
      paymentMethod: player.paymentMethod,
      paymentReference: player.paymentReference,
      paymentSubmittedAt: player.paymentSubmittedAt,
      paymentApprovedAt: player.paymentApprovedAt,
      paymentProofData: player.paymentProofData,
      paymentProofName: player.paymentProofName
    })),
    paymentOptions: state.paymentOptions,
    announcements: state.announcements,
    chats: state.chats
  };
}

function withSession(state, sessionUserId) {
  return { ...sanitizeState(state), sessionUserId };
}

function serializeState(state) {
  return {
    divisions: DIVISIONS,
    currentSeasonId: state.currentSeasonId,
    seasons: state.seasons,
    teams: state.teams,
    fixtures: state.fixtures,
    paymentOptions: state.paymentOptions,
    announcements: state.announcements,
    chats: state.chats,
    players: state.players,
    matches: state.matches
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalInteger(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function divisionForAverage(average) {
  if (average >= 75) return "elite";
  if (average >= 65) return "premier";
  if (average >= 55) return "champion";
  if (average >= 45) return "diamond";
  return "gold";
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}
