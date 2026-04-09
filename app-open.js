let state = {
  divisions: [],
  players: [],
  matches: []
};

const divisionForm = document.querySelector("#divisionForm");
const playerForm = document.querySelector("#playerForm");
const matchForm = document.querySelector("#matchForm");
const divisionList = document.querySelector("#divisionList");
const playerList = document.querySelector("#playerList");
const playerDivisionSelect = document.querySelector("#playerDivision");
const playerOneSelect = document.querySelector("#playerOne");
const playerTwoSelect = document.querySelector("#playerTwo");
const divisionTables = document.querySelector("#divisionTables");
const overallStandingsBody = document.querySelector("#overallStandingsBody");
const matchCards = document.querySelector("#matchCards");
const recentResults = document.querySelector("#recentResults");
const statLeaders = document.querySelector("#statLeaders");
const heroMetrics = document.querySelector("#heroMetrics");
const resetButton = document.querySelector("#resetButton");
const divisionChipTemplate = document.querySelector("#divisionChipTemplate");
const playerChipTemplate = document.querySelector("#playerChipTemplate");

divisionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(divisionForm);
  const name = formData.get("divisionName").toString().trim();
  const format = formData.get("divisionFormat").toString().trim();

  if (!name || !format) {
    return;
  }

  await updateState("/api/divisions", {
    method: "POST",
    body: JSON.stringify({ name, format })
  });
  divisionForm.reset();
});

playerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(playerForm);
  const name = formData.get("playerName").toString().trim();
  const divisionId = formData.get("playerDivision").toString();
  const venue = formData.get("playerVenue").toString().trim();

  if (!name || !divisionId || !venue) {
    return;
  }

  await updateState("/api/players", {
    method: "POST",
    body: JSON.stringify({ name, divisionId, venue })
  });
  playerForm.reset();
});

matchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(matchForm);
  const playerOneId = formData.get("playerOne").toString();
  const playerTwoId = formData.get("playerTwo").toString();
  const matchDate = formData.get("matchDate").toString();
  const playerOneScore = Number(formData.get("playerOneScore"));
  const playerTwoScore = Number(formData.get("playerTwoScore"));
  const playerOneAverage = parseOptionalNumber(formData.get("playerOneAverage"));
  const playerTwoAverage = parseOptionalNumber(formData.get("playerTwoAverage"));
  const playerOne180s = parseOptionalInteger(formData.get("playerOne180s"));
  const playerTwo180s = parseOptionalInteger(formData.get("playerTwo180s"));

  if (!playerOneId || !playerTwoId || playerOneId === playerTwoId || !matchDate) {
    return;
  }

  if (Number.isNaN(playerOneScore) || Number.isNaN(playerTwoScore)) {
    return;
  }

  await updateState("/api/matches", {
    method: "POST",
    body: JSON.stringify({
      playerOneId,
      playerTwoId,
      matchDate,
      playerOneScore,
      playerTwoScore,
      playerOneAverage,
      playerTwoAverage,
      playerOne180s,
      playerTwo180s
    })
  });
  matchForm.reset();
});

resetButton.addEventListener("click", async () => {
  await updateState("/api/reset", { method: "POST" });
});

async function updateState(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    return;
  }

  state = await response.json();
  render();
}

async function loadState() {
  const response = await fetch("/api/league");
  if (!response.ok) {
    return;
  }

  state = await response.json();
  render();
}

function render() {
  renderDivisionList();
  renderPlayerList();
  renderPlayerOptions();
  renderOverallTable();
  renderDivisionTables();
  renderMatches();
  renderRecentResults();
  renderStatLeaders();
  renderMetrics();
}

function renderDivisionList() {
  divisionList.innerHTML = "";

  if (state.divisions.length === 0) {
    divisionList.append(createEmptyState("No divisions yet", "Add a division before entering players and matches."));
    return;
  }

  state.divisions.forEach((division) => {
    const fragment = divisionChipTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".team-chip");
    fragment.querySelector("h3").textContent = division.name;
    fragment.querySelector("p").textContent = `${division.format} | ${getPlayersByDivision(division.id).length} players`;
    fragment.querySelector(".chip-action").addEventListener("click", async () => {
      await updateState(`/api/divisions/${division.id}`, { method: "DELETE" });
    });
    divisionList.append(card);
  });
}

function renderPlayerList() {
  playerList.innerHTML = "";

  if (state.players.length === 0) {
    playerList.append(createEmptyState("No players yet", "Add players and place them into divisions."));
    return;
  }

  [...state.players]
    .sort((first, second) => first.name.localeCompare(second.name))
    .forEach((player) => {
      const fragment = playerChipTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".team-chip");
      fragment.querySelector("h3").textContent = player.name;
      fragment.querySelector("p").textContent = `${getDivisionName(player.divisionId)} | ${player.venue}`;
      fragment.querySelector(".chip-action").addEventListener("click", async () => {
        await updateState(`/api/players/${player.id}`, { method: "DELETE" });
      });
      playerList.append(card);
    });
}

function renderPlayerOptions() {
  const divisionPlaceholder = '<option value="">Select a division</option>';
  playerDivisionSelect.innerHTML = divisionPlaceholder + state.divisions
    .map((division) => `<option value="${division.id}">${division.name}</option>`)
    .join("");

  const playerPlaceholder = '<option value="">Select a player</option>';
  const playerOptions = [...state.players]
    .sort((first, second) => first.name.localeCompare(second.name))
    .map((player) => `<option value="${player.id}">${player.name} (${getDivisionName(player.divisionId)})</option>`)
    .join("");

  playerOneSelect.innerHTML = playerPlaceholder + playerOptions;
  playerTwoSelect.innerHTML = playerPlaceholder + playerOptions;
}

function renderDivisionTables() {
  divisionTables.innerHTML = "";

  if (state.divisions.length === 0) {
    divisionTables.append(createEmptyState("No tables yet", "Division tables appear once your league setup is in place."));
    return;
  }

  state.divisions.forEach((division) => {
    const players = getPlayersByDivision(division.id);
    const standings = calculateStandings(getPlayersByDivision(division.id).map((player) => player.id));
    const wrapper = document.createElement("section");
    wrapper.className = "division-table-card";

    const rows = standings.length
      ? standings.map((entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${entry.name}</td>
          <td>${entry.played}</td>
          <td>${entry.won}</td>
          <td>${entry.drawn}</td>
          <td>${entry.lost}</td>
          <td>${entry.legsFor}-${entry.legsAgainst}</td>
          <td>${entry.legsFor - entry.legsAgainst}</td>
          <td><strong>${entry.points}</strong></td>
        </tr>
      `).join("")
      : '<tr><td colspan="9">No matches logged yet for this division.</td></tr>';

    wrapper.innerHTML = `
      <div class="panel-heading">
        <div>
          <h3>${division.name}</h3>
          <p>${division.format} | ${players.length} players</p>
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
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    divisionTables.append(wrapper);
  });
}

function renderMatches() {
  matchCards.innerHTML = "";
  const sortedMatches = [...state.matches].sort((first, second) => second.matchDate.localeCompare(first.matchDate));

  if (sortedMatches.length === 0) {
    matchCards.append(createEmptyState("No matches yet", "Log results whenever players meet."));
    return;
  }

  sortedMatches.forEach((match) => {
    const card = document.createElement("article");
    card.className = "fixture-card";
    card.innerHTML = `
      <div class="fixture-meta">
        <strong>${getPlayerName(match.playerOneId)} ${match.playerOneScore} - ${match.playerTwoScore} ${getPlayerName(match.playerTwoId)}</strong>
        <span class="status-pill">Logged</span>
      </div>
      <p>${formatDate(match.matchDate)} | ${getDivisionName(getPlayerDivisionId(match.playerOneId))} vs ${getDivisionName(getPlayerDivisionId(match.playerTwoId))}</p>
      <p>${formatMatchStats(match)}</p>
    `;
    matchCards.append(card);
  });
}

function renderRecentResults() {
  recentResults.innerHTML = "";
  const recentMatches = [...state.matches]
    .sort((first, second) => second.matchDate.localeCompare(first.matchDate))
    .slice(0, 6);

  if (recentMatches.length === 0) {
    recentResults.append(createEmptyState("No results entered", "Log a result to start tracking recent form."));
    return;
  }

  recentMatches.forEach((match) => {
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-meta">
        <strong>${getPlayerName(match.playerOneId)} ${match.playerOneScore} - ${match.playerTwoScore} ${getPlayerName(match.playerTwoId)}</strong>
        <span>${formatDate(match.matchDate)}</span>
      </div>
      <p>${summarizeResult(match)} ${formatMatchStats(match)}</p>
    `;
    recentResults.append(card);
  });
}

function renderMetrics() {
  const leaders = state.divisions
    .map((division) => calculateStandings(getPlayersByDivision(division.id).map((player) => player.id))[0])
    .filter(Boolean)
    .map((entry) => entry.name)
    .join(", ");

  heroMetrics.innerHTML = `
    <div class="metric">
      <span>Divisions</span>
      <strong>${state.divisions.length}</strong>
    </div>
    <div class="metric">
      <span>Players</span>
      <strong>${state.players.length}</strong>
    </div>
    <div class="metric">
      <span>Logged matches</span>
      <strong>${state.matches.length}</strong>
    </div>
    <div class="metric">
      <span>Division leaders</span>
      <strong>${leaders || "TBD"}</strong>
    </div>
  `;
}

function renderOverallTable() {
  overallStandingsBody.innerHTML = "";
  const standings = calculateStandings(state.players.map((player) => player.id));

  if (standings.length === 0) {
    overallStandingsBody.innerHTML = '<tr><td colspan="10">No overall standings yet. Log some matches to populate the league table.</td></tr>';
    return;
  }

  standings.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${entry.name}</td>
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

function renderStatLeaders() {
  statLeaders.innerHTML = "";
  const stats = calculatePlayerStats();

  const cards = [
    createLeaderCard("Highest Average", stats.filter((item) => item.matchesWithAverage > 0), (item) => `${item.average.toFixed(2)} avg`),
    createLeaderCard("Most 180s", stats.filter((item) => item.total180s > 0), (item) => `${item.total180s} total 180s`),
    createLeaderCard("Best Single Match Average", stats.filter((item) => item.bestAverage > 0), (item) => `${item.bestAverage.toFixed(2)} best`),
    createLeaderCard("Most Wins", stats.filter((item) => item.wins > 0), (item) => `${item.wins} wins`)
  ];

  cards.forEach((card) => statLeaders.append(card));
}

function calculateStandings(playerIds) {
  const table = state.players
    .filter((player) => playerIds.includes(player.id))
    .map((player) => ({
    id: player.id,
    name: player.name,
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
    const playerOne = table.find((player) => player.id === match.playerOneId);
    const playerTwo = table.find((player) => player.id === match.playerTwoId);
    if (!playerOne && !playerTwo) {
      return;
    }

    if (playerOne) {
      applyMatchToEntry(playerOne, match.playerOneScore, match.playerTwoScore);
    }

    if (playerTwo) {
      applyMatchToEntry(playerTwo, match.playerTwoScore, match.playerOneScore);
    }
  });

  return table.sort((first, second) => {
    const pointDiff = second.points - first.points;
    if (pointDiff !== 0) {
      return pointDiff;
    }

    const legDiff = (second.legsFor - second.legsAgainst) - (first.legsFor - first.legsAgainst);
    if (legDiff !== 0) {
      return legDiff;
    }

    return second.legsFor - first.legsFor;
  });
}

function calculatePlayerStats() {
  const stats = state.players.map((player) => ({
    id: player.id,
    name: player.name,
    divisionId: player.divisionId,
    wins: 0,
    total180s: 0,
    averageTotal: 0,
    matchesWithAverage: 0,
    bestAverage: 0
  }));

  state.matches.forEach((match) => {
    updatePlayerStats(stats, match.playerOneId, match.playerOneScore, match.playerTwoScore, match.playerOneAverage, match.playerOne180s);
    updatePlayerStats(stats, match.playerTwoId, match.playerTwoScore, match.playerOneScore, match.playerTwoAverage, match.playerTwo180s);
  });

  return stats.map((entry) => ({
    ...entry,
    average: entry.matchesWithAverage ? entry.averageTotal / entry.matchesWithAverage : 0
  }));
}

function applyMatchToEntry(entry, scored, conceded) {
  entry.played += 1;
  entry.legsFor += scored;
  entry.legsAgainst += conceded;

  if (scored > conceded) {
    entry.won += 1;
    entry.points += 2;
    return;
  }

  if (scored < conceded) {
    entry.lost += 1;
    return;
  }

  entry.drawn += 1;
  entry.points += 1;
}

function updatePlayerStats(stats, playerId, scored, conceded, average, oneEighties) {
  const entry = stats.find((player) => player.id === playerId);
  if (!entry) {
    return;
  }

  if (scored > conceded) {
    entry.wins += 1;
  }

  entry.total180s += oneEighties ?? 0;

  if (typeof average === "number" && !Number.isNaN(average)) {
    entry.averageTotal += average;
    entry.matchesWithAverage += 1;
    entry.bestAverage = Math.max(entry.bestAverage, average);
  }
}

function createLeaderCard(title, entries, formatter) {
  const card = document.createElement("article");
  card.className = "division-table-card";

  const ranked = [...entries]
    .sort((first, second) => {
      const firstValue = extractLeadingValue(formatter(first));
      const secondValue = extractLeadingValue(formatter(second));
      return secondValue - firstValue;
    })
    .slice(0, 5);

  const list = ranked.length
    ? ranked.map((entry, index) => `<tr><td>${index + 1}</td><td>${entry.name}</td><td>${getDivisionName(entry.divisionId)}</td><td>${formatter(entry)}</td></tr>`).join("")
    : '<tr><td colspan="4">No data logged yet.</td></tr>';

  card.innerHTML = `
    <div class="panel-heading">
      <div>
        <h3>${title}</h3>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Division</th>
            <th>Stat</th>
          </tr>
        </thead>
        <tbody>${list}</tbody>
      </table>
    </div>
  `;

  return card;
}

function extractLeadingValue(valueLabel) {
  const match = /^([0-9]+(?:\.[0-9]+)?)/.exec(valueLabel);
  return match ? Number(match[1]) : 0;
}

function getPlayersByDivision(divisionId) {
  return state.players
    .filter((player) => player.divisionId === divisionId)
    .sort((first, second) => first.name.localeCompare(second.name));
}

function getDivisionName(divisionId) {
  return state.divisions.find((division) => division.id === divisionId)?.name ?? "Unknown Division";
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

function getPlayerName(playerId) {
  return state.players.find((player) => player.id === playerId)?.name ?? "Unknown Player";
}

function getPlayerDivisionId(playerId) {
  return state.players.find((player) => player.id === playerId)?.divisionId ?? "";
}

function summarizeResult(match) {
  if (match.playerOneScore === match.playerTwoScore) {
    return "Drawn match, so both players collect a point.";
  }

  const winnerId = match.playerOneScore > match.playerTwoScore ? match.playerOneId : match.playerTwoId;
  return `${getPlayerName(winnerId)} took the win and added two points.`;
}

function formatMatchStats(match) {
  const parts = [];

  if (match.playerOneAverage !== null || match.playerTwoAverage !== null) {
    parts.push(
      `Averages: ${getPlayerName(match.playerOneId)} ${formatAverage(match.playerOneAverage)} | ${getPlayerName(match.playerTwoId)} ${formatAverage(match.playerTwoAverage)}`
    );
  }

  if ((match.playerOne180s ?? 0) > 0 || (match.playerTwo180s ?? 0) > 0) {
    parts.push(
      `180s: ${getPlayerName(match.playerOneId)} ${match.playerOne180s ?? 0} | ${getPlayerName(match.playerTwoId)} ${match.playerTwo180s ?? 0}`
    );
  }

  return parts.join(" | ") || "No extra player stats logged.";
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

function createEmptyState(title, description) {
  const card = document.createElement("article");
  card.className = "empty-state";
  card.innerHTML = `<strong>${title}</strong><p>${description}</p>`;
  return card;
}

loadState();
