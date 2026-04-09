const sessionKey = "elite-arrows-session";

let state = {
  divisions: [],
  players: [],
  matches: [],
  sessionUserId: localStorage.getItem(sessionKey)
};

let activeSection = "overview";

const welcomeView = document.querySelector("#welcomeView");
const dashboardView = document.querySelector("#dashboardView");
const authMessage = document.querySelector("#authMessage");
const signupForm = document.querySelector("#signupForm");
const loginForm = document.querySelector("#loginForm");
const profileForm = document.querySelector("#profileForm");
const matchForm = document.querySelector("#matchForm");
const resetButton = document.querySelector("#resetButton");
const logoutButton = document.querySelector("#logoutButton");
const openProfileButton = document.querySelector("#openProfileButton");
const closeProfileButton = document.querySelector("#closeProfileButton");
const profileDrawer = document.querySelector("#profileDrawer");
const profileCard = document.querySelector("#profileCard");
const heroMetrics = document.querySelector("#heroMetrics");
const dashboardMetrics = document.querySelector("#dashboardMetrics");
const overallStandingsBody = document.querySelector("#overallStandingsBody");
const divisionTables = document.querySelector("#divisionTables");
const statLeaders = document.querySelector("#statLeaders");
const recentResults = document.querySelector("#recentResults");
const matchCards = document.querySelector("#matchCards");
const divisionList = document.querySelector("#divisionList");
const playerList = document.querySelector("#playerList");
const opponentSelect = document.querySelector("#opponentId");
const navButtons = [...document.querySelectorAll(".nav-button")];
const sectionViews = [...document.querySelectorAll(".section-view")];
const divisionChipTemplate = document.querySelector("#divisionChipTemplate");
const playerChipTemplate = document.querySelector("#playerChipTemplate");

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  await send("/api/auth/signup", {
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    threeDartAverage: Number(formData.get("threeDartAverage")),
    dartCounterLink: formData.get("dartCounterLink"),
    bio: formData.get("bio")
  });
  signupForm.reset();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  await send("/api/auth/login", {
    email: formData.get("loginEmail"),
    password: formData.get("loginPassword")
  });
  loginForm.reset();
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  await send("/api/profile", {
    username: formData.get("profileUsername"),
    threeDartAverage: parseOptionalNumber(formData.get("profileThreeDartAverage")),
    dartCounterLink: formData.get("profileDartCounterLink"),
    bio: formData.get("profileBio")
  });
});

matchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(matchForm);
  await send("/api/matches", {
    opponentId: formData.get("opponentId"),
    matchDate: formData.get("matchDate"),
    playerOneScore: Number(formData.get("playerOneScore")),
    playerTwoScore: Number(formData.get("playerTwoScore")),
    playerOneAverage: parseOptionalNumber(formData.get("playerOneAverage")),
    playerTwoAverage: parseOptionalNumber(formData.get("playerTwoAverage")),
    playerOne180s: parseOptionalInteger(formData.get("playerOne180s")),
    playerTwo180s: parseOptionalInteger(formData.get("playerTwo180s"))
  });
  matchForm.reset();
});

resetButton.addEventListener("click", async () => {
  await send("/api/reset", {}, true);
});

logoutButton.addEventListener("click", () => {
  state.sessionUserId = null;
  localStorage.removeItem(sessionKey);
  profileDrawer.hidden = true;
  render();
});

openProfileButton.addEventListener("click", () => {
  profileDrawer.hidden = false;
});

closeProfileButton.addEventListener("click", () => {
  profileDrawer.hidden = true;
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeSection = button.dataset.view;
    renderNavigation();
  });
});

async function bootstrap() {
  const response = await fetch("/api/bootstrap");
  const payload = await response.json();
  state = { ...payload, sessionUserId: state.sessionUserId };
  render();
}

async function send(url, payload, clearSession = false) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      sessionUserId: clearSession ? null : state.sessionUserId
    })
  });

  const data = await response.json();
  if (!response.ok) {
    authMessage.textContent = data.error || "Something went wrong.";
    return;
  }

  state = data;
  if (state.sessionUserId) {
    localStorage.setItem(sessionKey, state.sessionUserId);
    authMessage.textContent = "";
    activeSection = "overview";
  } else {
    localStorage.removeItem(sessionKey);
    authMessage.textContent = "League reset. Sign up to create the first profile.";
  }

  render();
}

function render() {
  const user = currentUser();
  welcomeView.hidden = Boolean(user);
  dashboardView.hidden = !user;
  renderWelcomeMetrics();
  if (!user) {
    return;
  }
  renderNavigation();
  renderDashboardMetrics();
  renderProfile();
  renderOpponentOptions();
  renderDivisionCards();
  renderPlayers();
  renderOverallTable();
  renderDivisionTables();
  renderRecentResults();
  renderMatches();
  renderStatLeaders();
}

function renderNavigation() {
  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === activeSection);
  });
  sectionViews.forEach((section) => {
    section.classList.toggle("is-active", section.dataset.section === activeSection);
  });
}

function renderWelcomeMetrics() {
  heroMetrics.innerHTML = `
    <div class="metric"><span>Divisions</span><strong>${state.divisions.length}</strong></div>
    <div class="metric"><span>Players</span><strong>${state.players.length}</strong></div>
    <div class="metric"><span>Submitted matches</span><strong>${state.matches.length}</strong></div>
    <div class="metric"><span>Status</span><strong>${currentUser() ? "Signed in" : "Join now"}</strong></div>
  `;
}

function renderDashboardMetrics() {
  const user = currentUser();
  dashboardMetrics.innerHTML = `
    <div class="metric"><span>Your division</span><strong>${getDivisionName(user.divisionId)}</strong></div>
    <div class="metric"><span>Your average</span><strong>${formatAverage(user.threeDartAverage)}</strong></div>
    <div class="metric"><span>League players</span><strong>${state.players.length}</strong></div>
    <div class="metric"><span>Matches logged</span><strong>${state.matches.length}</strong></div>
  `;
}

function renderProfile() {
  const user = currentUser();
  if (!user) {
    return;
  }

  profileCard.innerHTML = `
    <h3>${user.username}</h3>
    <p>${getDivisionName(user.divisionId)}</p>
    <p>${user.bio || "No bio written yet."}</p>
    <p>3-dart average: ${formatAverage(user.threeDartAverage)}</p>
    <p>DartCounter: ${user.dartCounterLink ? `<a href="${user.dartCounterLink}" target="_blank" rel="noreferrer">${user.dartCounterLink}</a>` : "Not linked"}</p>
  `;

  profileForm.elements.profileUsername.value = user.username;
  profileForm.elements.profileThreeDartAverage.value = user.threeDartAverage ?? "";
  profileForm.elements.profileDartCounterLink.value = user.dartCounterLink ?? "";
  profileForm.elements.profileBio.value = user.bio ?? "";
}

function renderOpponentOptions() {
  const user = currentUser();
  opponentSelect.innerHTML = '<option value="">Select opponent</option>';
  opponentSelect.innerHTML += state.players
    .filter((player) => player.id !== user.id)
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((player) => `<option value="${player.id}">${player.username} · ${getDivisionName(player.divisionId)}</option>`)
    .join("");
}

function renderDivisionCards() {
  divisionList.innerHTML = "";
  state.divisions.forEach((division) => {
    const fragment = divisionChipTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = division.name;
    fragment.querySelector("p").textContent = `${getPlayersByDivision(division.id).length} players`;
    divisionList.append(fragment.querySelector(".team-chip"));
  });
}

function renderPlayers() {
  playerList.innerHTML = "";
  if (state.players.length === 0) {
    playerList.append(createEmptyState("No profiles yet", "Profiles appear after players sign up."));
    return;
  }

  [...state.players].sort((a, b) => a.username.localeCompare(b.username)).forEach((player) => {
    const fragment = playerChipTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = player.username;
    fragment.querySelector("p").textContent = `${getDivisionName(player.divisionId)} | 3-dart avg ${formatAverage(player.threeDartAverage)}`;
    playerList.append(fragment.querySelector(".team-chip"));
  });
}

function renderOverallTable() {
  overallStandingsBody.innerHTML = "";
  const standings = calculateStandings(state.players.map((player) => player.id));
  if (standings.length === 0) {
    overallStandingsBody.innerHTML = '<tr><td colspan="10">No submitted results yet.</td></tr>';
    return;
  }

  standings.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${entry.username}</td>
      <td>${getDivisionName(entry.divisionId)}</td>
      <td>${entry.played}</td>
      <td>${entry.won}</td>
      <td>${entry.drawn}</td>
      <td>${entry.lost}</td>
      <td>${entry.legsFor}-${entry.legsAgainst}</td>
      <td>${entry.legsFor - entry.legsAgainst}</td>
      <td><strong>${entry.points}</strong></td>
    `;
    overallStandingsBody.append(row);
  });
}

function renderDivisionTables() {
  divisionTables.innerHTML = "";
  state.divisions.forEach((division) => {
    const standings = calculateStandings(getPlayersByDivision(division.id).map((player) => player.id));
    const card = document.createElement("article");
    card.className = "division-table-card";
    card.innerHTML = `
      <div class="panel-heading">
        <div>
          <h3>${division.name}</h3>
          <p>${getPlayersByDivision(division.id).length} players</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Legs</th><th>Diff</th><th>Pts</th></tr>
          </thead>
          <tbody>${renderStandingRows(standings)}</tbody>
        </table>
      </div>
    `;
    divisionTables.append(card);
  });
}

function renderRecentResults() {
  recentResults.innerHTML = "";
  const matches = [...state.matches].sort((a, b) => b.matchDate.localeCompare(a.matchDate)).slice(0, 6);
  if (matches.length === 0) {
    recentResults.append(createEmptyState("No results yet", "Submitted results show up here."));
    return;
  }

  matches.forEach((match) => {
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-meta">
        <strong>${getUsername(match.playerOneId)} ${match.playerOneScore} - ${match.playerTwoScore} ${getUsername(match.playerTwoId)}</strong>
        <span>${formatDate(match.matchDate)}</span>
      </div>
      <p>${summarizeResult(match)} ${formatMatchStats(match)}</p>
    `;
    recentResults.append(card);
  });
}

function renderMatches() {
  matchCards.innerHTML = "";
  const matches = [...state.matches].sort((a, b) => b.matchDate.localeCompare(a.matchDate));
  if (matches.length === 0) {
    matchCards.append(createEmptyState("No match log yet", "Match submissions are listed here."));
    return;
  }

  matches.forEach((match) => {
    const card = document.createElement("article");
    card.className = "fixture-card";
    card.innerHTML = `
      <div class="fixture-meta">
        <strong>${getUsername(match.playerOneId)} ${match.playerOneScore} - ${match.playerTwoScore} ${getUsername(match.playerTwoId)}</strong>
        <span class="status-pill">Submitted</span>
      </div>
      <p>${formatDate(match.matchDate)} | Submitted by ${getUsername(match.submittedBy)}</p>
      <p>${formatMatchStats(match)}</p>
    `;
    matchCards.append(card);
  });
}

function renderStatLeaders() {
  statLeaders.innerHTML = "";
  const stats = calculatePlayerStats();
  [
    createLeaderCard("Best Profile Average", stats.filter((player) => player.profileAverage !== null), (player) => formatAverage(player.profileAverage)),
    createLeaderCard("Best Match Average", stats.filter((player) => player.matchAverage !== null), (player) => formatAverage(player.matchAverage)),
    createLeaderCard("Most 180s", stats.filter((player) => player.total180s > 0), (player) => `${player.total180s} 180s`),
    createLeaderCard("Most Wins", stats.filter((player) => player.wins > 0), (player) => `${player.wins} wins`)
  ].forEach((card) => statLeaders.append(card));
}

function calculateStandings(playerIds) {
  const table = state.players
    .filter((player) => playerIds.includes(player.id))
    .map((player) => ({
      id: player.id,
      username: player.username,
      divisionId: player.divisionId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      legsFor: 0,
      legsAgainst: 0,
      points: 0
    }));

  state.matches.forEach((match) => {
    const one = table.find((player) => player.id === match.playerOneId);
    const two = table.find((player) => player.id === match.playerTwoId);
    if (one) {
      applyMatch(one, match.playerOneScore, match.playerTwoScore);
    }
    if (two) {
      applyMatch(two, match.playerTwoScore, match.playerOneScore);
    }
  });

  return table.sort((a, b) => {
    const pointDiff = b.points - a.points;
    if (pointDiff !== 0) {
      return pointDiff;
    }
    const legDiff = (b.legsFor - b.legsAgainst) - (a.legsFor - a.legsAgainst);
    if (legDiff !== 0) {
      return legDiff;
    }
    return b.legsFor - a.legsFor;
  });
}

function calculatePlayerStats() {
  const stats = state.players.map((player) => ({
    id: player.id,
    username: player.username,
    divisionId: player.divisionId,
    profileAverage: player.threeDartAverage,
    wins: 0,
    total180s: 0,
    averageTotal: 0,
    averageMatches: 0
  }));

  state.matches.forEach((match) => {
    updateStats(stats, match.playerOneId, match.playerOneScore, match.playerTwoScore, match.playerOneAverage, match.playerOne180s);
    updateStats(stats, match.playerTwoId, match.playerTwoScore, match.playerOneScore, match.playerTwoAverage, match.playerTwo180s);
  });

  return stats.map((player) => ({
    ...player,
    matchAverage: player.averageMatches ? player.averageTotal / player.averageMatches : null
  }));
}

function updateStats(stats, playerId, scored, conceded, average, oneEighties) {
  const player = stats.find((entry) => entry.id === playerId);
  if (!player) {
    return;
  }
  if (scored > conceded) {
    player.wins += 1;
  }
  player.total180s += oneEighties ?? 0;
  if (typeof average === "number") {
    player.averageTotal += average;
    player.averageMatches += 1;
  }
}

function applyMatch(player, scored, conceded) {
  player.played += 1;
  player.legsFor += scored;
  player.legsAgainst += conceded;
  if (scored > conceded) {
    player.won += 1;
    player.points += 2;
    return;
  }
  if (scored < conceded) {
    player.lost += 1;
    return;
  }
  player.drawn += 1;
  player.points += 1;
}

function createLeaderCard(title, entries, formatter) {
  const card = document.createElement("article");
  card.className = "division-table-card";
  const rows = [...entries]
    .sort((a, b) => leaderValue(formatter(b)) - leaderValue(formatter(a)))
    .slice(0, 5)
    .map((entry, index) => `<tr><td>${index + 1}</td><td>${entry.username}</td><td>${getDivisionName(entry.divisionId)}</td><td>${formatter(entry)}</td></tr>`)
    .join("") || '<tr><td colspan="4">No data yet.</td></tr>';

  card.innerHTML = `
    <div class="panel-heading"><div><h3>${title}</h3></div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Player</th><th>Division</th><th>Stat</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  return card;
}

function renderStandingRows(standings) {
  if (standings.length === 0) {
    return '<tr><td colspan="9">No submitted results yet.</td></tr>';
  }

  return standings.map((entry, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${entry.username}</td>
      <td>${entry.played}</td>
      <td>${entry.won}</td>
      <td>${entry.drawn}</td>
      <td>${entry.lost}</td>
      <td>${entry.legsFor}-${entry.legsAgainst}</td>
      <td>${entry.legsFor - entry.legsAgainst}</td>
      <td><strong>${entry.points}</strong></td>
    </tr>
  `).join("");
}

function currentUser() {
  return state.players.find((player) => player.id === state.sessionUserId) ?? null;
}

function getPlayersByDivision(divisionId) {
  return state.players.filter((player) => player.divisionId === divisionId);
}

function getDivisionName(divisionId) {
  return state.divisions.find((division) => division.id === divisionId)?.name ?? "Unknown";
}

function getUsername(playerId) {
  return state.players.find((player) => player.id === playerId)?.username ?? "Unknown";
}

function summarizeResult(match) {
  if (match.playerOneScore === match.playerTwoScore) {
    return "The match finished level.";
  }
  return `${getUsername(match.playerOneScore > match.playerTwoScore ? match.playerOneId : match.playerTwoId)} won the match.`;
}

function formatMatchStats(match) {
  const parts = [];
  if (match.playerOneAverage !== null || match.playerTwoAverage !== null) {
    parts.push(`Averages ${getUsername(match.playerOneId)} ${formatAverage(match.playerOneAverage)} / ${getUsername(match.playerTwoId)} ${formatAverage(match.playerTwoAverage)}`);
  }
  if ((match.playerOne180s ?? 0) > 0 || (match.playerTwo180s ?? 0) > 0) {
    parts.push(`180s ${getUsername(match.playerOneId)} ${match.playerOne180s ?? 0} / ${getUsername(match.playerTwoId)} ${match.playerTwo180s ?? 0}`);
  }
  return parts.join(" | ") || "No extra stats added.";
}

function formatAverage(value) {
  return value === null || value === undefined ? "-" : Number(value).toFixed(2);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateString}T12:00:00`));
}

function leaderValue(label) {
  const match = /^([0-9]+(?:\.[0-9]+)?)/.exec(label);
  return match ? Number(match[1]) : 0;
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

function createEmptyState(title, description) {
  const card = document.createElement("article");
  card.className = "empty-state";
  card.innerHTML = `<strong>${title}</strong><p>${description}</p>`;
  return card;
}

bootstrap();
