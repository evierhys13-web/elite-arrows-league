const sessionKey = "elite-arrows-session";

let state = {
  divisions: [],
  players: [],
  matches: [],
  sessionUserId: localStorage.getItem(sessionKey)
};

const authMessage = document.querySelector("#authMessage");
const signupForm = document.querySelector("#signupForm");
const loginForm = document.querySelector("#loginForm");
const profileForm = document.querySelector("#profileForm");
const matchForm = document.querySelector("#matchForm");
const profilePanel = document.querySelector("#profilePanel");
const authPanel = document.querySelector("#authPanel");
const signedInPanel = document.querySelector("#signedInPanel");
const divisionList = document.querySelector("#divisionList");
const playerList = document.querySelector("#playerList");
const heroMetrics = document.querySelector("#heroMetrics");
const overallStandingsBody = document.querySelector("#overallStandingsBody");
const divisionTables = document.querySelector("#divisionTables");
const statLeaders = document.querySelector("#statLeaders");
const matchCards = document.querySelector("#matchCards");
const recentResults = document.querySelector("#recentResults");
const logoutButton = document.querySelector("#logoutButton");
const resetButton = document.querySelector("#resetButton");
const profileCard = document.querySelector("#profileCard");
const signupDivision = document.querySelector("#signupDivision");
const profileDivision = document.querySelector("#profileDivision");
const opponentSelect = document.querySelector("#opponentId");
const divisionChipTemplate = document.querySelector("#divisionChipTemplate");
const playerChipTemplate = document.querySelector("#playerChipTemplate");

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  await send("/api/auth/signup", {
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    divisionId: formData.get("divisionId"),
    venue: formData.get("venue"),
    bio: formData.get("bio"),
    dartCounterLink: formData.get("dartCounterLink"),
    threeDartAverage: parseOptionalNumber(formData.get("threeDartAverage"))
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
    divisionId: formData.get("profileDivision"),
    venue: formData.get("profileVenue"),
    bio: formData.get("profileBio"),
    dartCounterLink: formData.get("profileDartCounterLink"),
    threeDartAverage: parseOptionalNumber(formData.get("profileThreeDartAverage"))
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

logoutButton.addEventListener("click", () => {
  state.sessionUserId = null;
  localStorage.removeItem(sessionKey);
  authMessage.textContent = "Signed out.";
  render();
});

resetButton.addEventListener("click", async () => {
  await send("/api/reset", {}, true);
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
    body: JSON.stringify({ ...payload, sessionUserId: clearSession ? null : state.sessionUserId })
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
  } else {
    localStorage.removeItem(sessionKey);
    authMessage.textContent = "League reset. Create an account to get started.";
  }
  render();
}

function render() {
  renderDivisionOptions();
  renderDivisionCards();
  renderPlayers();
  renderProfile();
  renderOpponentOptions();
  renderOverallTable();
  renderDivisionTables();
  renderMatches();
  renderRecentResults();
  renderStatLeaders();
  renderMetrics();
  authPanel.hidden = Boolean(currentUser());
  signedInPanel.hidden = !currentUser();
}

function renderDivisionOptions() {
  const options = state.divisions.map((division) => `<option value="${division.id}">${division.name}</option>`).join("");
  signupDivision.innerHTML = options;
  profileDivision.innerHTML = options;
}

function renderDivisionCards() {
  divisionList.innerHTML = "";
  state.divisions.forEach((division) => {
    const fragment = divisionChipTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = division.name;
    fragment.querySelector("p").textContent = `${getPlayersByDivision(division.id).length} registered players`;
    divisionList.append(fragment.querySelector(".team-chip"));
  });
}

function renderPlayers() {
  playerList.innerHTML = "";
  if (state.players.length === 0) {
    playerList.append(createEmptyState("No registered players", "Use sign up to create the first Elite Arrows profile."));
    return;
  }

  [...state.players].sort((a, b) => a.username.localeCompare(b.username)).forEach((player) => {
    const fragment = playerChipTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = player.username;
    fragment.querySelector("p").textContent = `${getDivisionName(player.divisionId)} | ${player.venue || "Venue not set"}`;
    const button = fragment.querySelector(".chip-action");
    button.textContent = "View";
    button.disabled = true;
    playerList.append(fragment.querySelector(".team-chip"));
  });
}

function renderProfile() {
  const user = currentUser();
  if (!user) {
    profilePanel.hidden = true;
    return;
  }

  profilePanel.hidden = false;
  profileCard.innerHTML = `
    <h3>${user.username}</h3>
    <p>${getDivisionName(user.divisionId)} | ${user.venue || "Venue not set"}</p>
    <p>${user.bio || "No bio added yet."}</p>
    <p>3-dart average: ${formatAverage(user.threeDartAverage)}</p>
    <p>DartCounter: ${user.dartCounterLink ? `<a href="${user.dartCounterLink}" target="_blank" rel="noreferrer">${user.dartCounterLink}</a>` : "Not linked"}</p>
  `;

  profileForm.elements.profileUsername.value = user.username;
  profileForm.elements.profileDivision.value = user.divisionId;
  profileForm.elements.profileVenue.value = user.venue || "";
  profileForm.elements.profileBio.value = user.bio || "";
  profileForm.elements.profileDartCounterLink.value = user.dartCounterLink || "";
  profileForm.elements.profileThreeDartAverage.value = user.threeDartAverage ?? "";
}

function renderOpponentOptions() {
  const user = currentUser();
  opponentSelect.innerHTML = '<option value="">Select opponent</option>';
  if (!user) {
    return;
  }

  opponentSelect.innerHTML += state.players
    .filter((player) => player.id !== user.id)
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((player) => `<option value="${player.id}">${player.username} (${getDivisionName(player.divisionId)})</option>`)
    .join("");
}

function renderOverallTable() {
  overallStandingsBody.innerHTML = "";
  const standings = calculateStandings(state.players.map((player) => player.id));

  if (standings.length === 0) {
    overallStandingsBody.innerHTML = '<tr><td colspan="10">No results submitted yet.</td></tr>';
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
          <p>${getPlayersByDivision(division.id).length} registered players</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>Legs</th>
              <th>Diff</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>${renderStandingRows(standings, 9, "No results submitted yet in this division.")}</tbody>
        </table>
      </div>
    `;
    divisionTables.append(card);
  });
}

function renderMatches() {
  matchCards.innerHTML = "";
  const matches = [...state.matches].sort((a, b) => b.matchDate.localeCompare(a.matchDate));
  if (matches.length === 0) {
    matchCards.append(createEmptyState("No logged matches", "Matches appear here after a signed-in player submits a result."));
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

function renderRecentResults() {
  recentResults.innerHTML = "";
  const matches = [...state.matches].sort((a, b) => b.matchDate.localeCompare(a.matchDate)).slice(0, 6);
  if (matches.length === 0) {
    recentResults.append(createEmptyState("No results entered", "Signed-in players can submit a result at any time."));
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

function renderStatLeaders() {
  statLeaders.innerHTML = "";
  const stats = calculatePlayerStats();
  [
    createLeaderCard("Highest Profile Average", stats.filter((player) => player.profileAverage !== null), (player) => formatAverage(player.profileAverage)),
    createLeaderCard("Highest Match Average", stats.filter((player) => player.matchAverage !== null), (player) => formatAverage(player.matchAverage)),
    createLeaderCard("Most 180s", stats.filter((player) => player.total180s > 0), (player) => `${player.total180s} 180s`),
    createLeaderCard("Most Wins", stats.filter((player) => player.wins > 0), (player) => `${player.wins} wins`)
  ].forEach((card) => statLeaders.append(card));
}

function renderMetrics() {
  heroMetrics.innerHTML = `
    <div class="metric">
      <span>Registered players</span>
      <strong>${state.players.length}</strong>
    </div>
    <div class="metric">
      <span>Divisions</span>
      <strong>${state.divisions.length}</strong>
    </div>
    <div class="metric">
      <span>Submitted matches</span>
      <strong>${state.matches.length}</strong>
    </div>
    <div class="metric">
      <span>Signed in now</span>
      <strong>${currentUser() ? currentUser().username : "No one"}</strong>
    </div>
  `;
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
    wins: 0,
    total180s: 0,
    averageSum: 0,
    averageMatches: 0,
    profileAverage: player.threeDartAverage
  }));

  state.matches.forEach((match) => {
    updateStats(stats, match.playerOneId, match.playerOneScore, match.playerTwoScore, match.playerOneAverage, match.playerOne180s);
    updateStats(stats, match.playerTwoId, match.playerTwoScore, match.playerOneScore, match.playerTwoAverage, match.playerTwo180s);
  });

  return stats.map((player) => ({
    ...player,
    matchAverage: player.averageMatches ? player.averageSum / player.averageMatches : null
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
    player.averageSum += average;
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
    <div class="panel-heading">
      <div><h3>${title}</h3></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Player</th><th>Division</th><th>Stat</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  return card;
}

function renderStandingRows(standings, colspan, emptyMessage) {
  if (standings.length === 0) {
    return `<tr><td colspan="${colspan}">${emptyMessage}</td></tr>`;
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
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${dateString}T12:00:00`));
}

function leaderValue(label) {
  const match = /^([0-9]+(?:\.[0-9]+)?)/.exec(label);
  return match ? Number(match[1]) : 0;
}

function parseOptionalNumber(value) {
  const raw = value?.toString().trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalInteger(value) {
  const raw = value?.toString().trim();
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function createEmptyState(title, description) {
  const card = document.createElement("article");
  card.className = "empty-state";
  card.innerHTML = `<strong>${title}</strong><p>${description}</p>`;
  return card;
}

bootstrap();
