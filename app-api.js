let state = {
  divisions: [],
  players: [],
  fixtures: []
};

const divisionForm = document.querySelector("#divisionForm");
const playerForm = document.querySelector("#playerForm");
const fixtureForm = document.querySelector("#fixtureForm");
const resultForm = document.querySelector("#resultForm");
const divisionList = document.querySelector("#divisionList");
const playerList = document.querySelector("#playerList");
const playerDivisionSelect = document.querySelector("#playerDivision");
const fixtureDivisionSelect = document.querySelector("#fixtureDivision");
const homePlayerSelect = document.querySelector("#homePlayer");
const awayPlayerSelect = document.querySelector("#awayPlayer");
const fixtureSelect = document.querySelector("#fixtureSelect");
const divisionTables = document.querySelector("#divisionTables");
const fixtureCards = document.querySelector("#fixtureCards");
const recentResults = document.querySelector("#recentResults");
const heroMetrics = document.querySelector("#heroMetrics");
const resetButton = document.querySelector("#resetButton");
const generateFixturesButton = document.querySelector("#generateFixturesButton");
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

fixtureDivisionSelect.addEventListener("change", () => {
  renderPlayerMatchOptions(fixtureDivisionSelect.value);
});

generateFixturesButton.addEventListener("click", async () => {
  const divisionId = fixtureDivisionSelect.value;
  if (!divisionId) {
    return;
  }

  await updateState(`/api/divisions/${divisionId}/generate-fixtures`, { method: "POST" });
});

fixtureForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(fixtureForm);
  const divisionId = formData.get("fixtureDivision").toString();
  const homePlayerId = formData.get("homePlayer").toString();
  const awayPlayerId = formData.get("awayPlayer").toString();
  const matchDate = formData.get("matchDate").toString();

  if (!divisionId || !homePlayerId || !awayPlayerId || !matchDate || homePlayerId === awayPlayerId) {
    return;
  }

  const homePlayer = state.players.find((player) => player.id === homePlayerId);
  const awayPlayer = state.players.find((player) => player.id === awayPlayerId);
  if (!homePlayer || !awayPlayer || homePlayer.divisionId !== divisionId || awayPlayer.divisionId !== divisionId) {
    return;
  }

  await updateState("/api/fixtures", {
    method: "POST",
    body: JSON.stringify({ divisionId, homePlayerId, awayPlayerId, matchDate })
  });
  fixtureForm.reset();
});

resultForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(resultForm);
  const fixtureId = formData.get("fixtureSelect").toString();
  const homeScore = Number(formData.get("homeScore"));
  const awayScore = Number(formData.get("awayScore"));

  if (!fixtureId || Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
    return;
  }

  await updateState(`/api/fixtures/${fixtureId}/result`, {
    method: "PATCH",
    body: JSON.stringify({ homeScore, awayScore })
  });
  resultForm.reset();
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
  renderSelectOptions();
  renderDivisionTables();
  renderFixtures();
  renderRecentResults();
  renderMetrics();
}

function renderDivisionList() {
  divisionList.innerHTML = "";

  if (state.divisions.length === 0) {
    divisionList.append(createEmptyState("No divisions yet", "Add a division before entering players and fixtures."));
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

function renderSelectOptions() {
  const divisionPlaceholder = '<option value="">Select a division</option>';
  const divisionOptions = state.divisions
    .map((division) => `<option value="${division.id}">${division.name}</option>`)
    .join("");

  playerDivisionSelect.innerHTML = divisionPlaceholder + divisionOptions;
  fixtureDivisionSelect.innerHTML = divisionPlaceholder + divisionOptions;

  const activeDivision = fixtureDivisionSelect.value || state.divisions[0]?.id || "";
  if (activeDivision) {
    fixtureDivisionSelect.value = activeDivision;
  }
  renderPlayerMatchOptions(activeDivision);

  const pendingFixtures = getPendingFixtures();
  fixtureSelect.innerHTML = pendingFixtures.length
    ? '<option value="">Select a fixture</option>' + pendingFixtures.map((fixture) => {
      const division = getDivisionName(fixture.divisionId);
      const homePlayer = getPlayerName(fixture.homePlayerId);
      const awayPlayer = getPlayerName(fixture.awayPlayerId);
      return `<option value="${fixture.id}">${division} | ${formatDate(fixture.matchDate)} | ${homePlayer} vs ${awayPlayer}</option>`;
    }).join("")
    : '<option value="">No pending fixtures</option>';
}

function renderPlayerMatchOptions(divisionId) {
  const players = divisionId ? getPlayersByDivision(divisionId) : [];
  const placeholder = '<option value="">Select a player</option>';
  const options = players.map((player) => `<option value="${player.id}">${player.name}</option>`).join("");
  homePlayerSelect.innerHTML = placeholder + options;
  awayPlayerSelect.innerHTML = placeholder + options;
}

function renderDivisionTables() {
  divisionTables.innerHTML = "";

  if (state.divisions.length === 0) {
    divisionTables.append(createEmptyState("No tables yet", "Division tables appear once your league setup is in place."));
    return;
  }

  state.divisions.forEach((division) => {
    const players = getPlayersByDivision(division.id);
    const standings = calculateStandings(division.id);
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
      : '<tr><td colspan="9">No results entered yet for this division.</td></tr>';

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

function renderFixtures() {
  fixtureCards.innerHTML = "";
  const sortedFixtures = [...state.fixtures].sort((first, second) => first.matchDate.localeCompare(second.matchDate));

  if (sortedFixtures.length === 0) {
    fixtureCards.append(createEmptyState("No fixtures yet", "Schedule player-v-player matches inside each division."));
    return;
  }

  sortedFixtures.forEach((fixture) => {
    const card = document.createElement("article");
    const isPlayed = fixture.homeScore !== null && fixture.awayScore !== null;
    card.className = "fixture-card";
    card.innerHTML = `
      <div class="fixture-meta">
        <strong>${getPlayerName(fixture.homePlayerId)} vs ${getPlayerName(fixture.awayPlayerId)}</strong>
        <span class="status-pill ${isPlayed ? "" : "pending"}">${isPlayed ? "Played" : "Upcoming"}</span>
      </div>
      <p>${getDivisionName(fixture.divisionId)} | ${formatDate(fixture.matchDate)}</p>
      <p>${isPlayed ? `Score: ${fixture.homeScore} - ${fixture.awayScore}` : "Result pending"}</p>
    `;
    fixtureCards.append(card);
  });
}

function renderRecentResults() {
  recentResults.innerHTML = "";
  const playedFixtures = state.fixtures
    .filter((fixture) => fixture.homeScore !== null && fixture.awayScore !== null)
    .sort((first, second) => second.matchDate.localeCompare(first.matchDate))
    .slice(0, 6);

  if (playedFixtures.length === 0) {
    recentResults.append(createEmptyState("No results entered", "Record a result to start tracking division form."));
    return;
  }

  playedFixtures.forEach((fixture) => {
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-meta">
        <strong>${getPlayerName(fixture.homePlayerId)} ${fixture.homeScore} - ${fixture.awayScore} ${getPlayerName(fixture.awayPlayerId)}</strong>
        <span>${formatDate(fixture.matchDate)}</span>
      </div>
      <p>${getDivisionName(fixture.divisionId)} | ${summarizeResult(fixture)}</p>
    `;
    recentResults.append(card);
  });
}

function renderMetrics() {
  const playedCount = state.fixtures.filter((fixture) => fixture.homeScore !== null && fixture.awayScore !== null).length;
  const leaders = state.divisions
    .map((division) => calculateStandings(division.id)[0])
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
      <span>Completed matches</span>
      <strong>${playedCount}</strong>
    </div>
    <div class="metric">
      <span>Division leaders</span>
      <strong>${leaders || "TBD"}</strong>
    </div>
  `;
}

function calculateStandings(divisionId) {
  const table = getPlayersByDivision(divisionId).map((player) => ({
    id: player.id,
    name: player.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    legsFor: 0,
    legsAgainst: 0,
    points: 0
  }));

  state.fixtures
    .filter((fixture) => fixture.divisionId === divisionId && fixture.homeScore !== null && fixture.awayScore !== null)
    .forEach((fixture) => {
      const home = table.find((player) => player.id === fixture.homePlayerId);
      const away = table.find((player) => player.id === fixture.awayPlayerId);
      if (!home || !away) {
        return;
      }

      home.played += 1;
      away.played += 1;
      home.legsFor += fixture.homeScore;
      home.legsAgainst += fixture.awayScore;
      away.legsFor += fixture.awayScore;
      away.legsAgainst += fixture.homeScore;

      if (fixture.homeScore > fixture.awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 2;
      } else if (fixture.homeScore < fixture.awayScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 2;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
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

function getPlayersByDivision(divisionId) {
  return state.players
    .filter((player) => player.divisionId === divisionId)
    .sort((first, second) => first.name.localeCompare(second.name));
}

function getPendingFixtures() {
  return state.fixtures.filter((fixture) => fixture.homeScore === null || fixture.awayScore === null);
}

function getDivisionName(divisionId) {
  return state.divisions.find((division) => division.id === divisionId)?.name ?? "Unknown Division";
}

function getPlayerName(playerId) {
  return state.players.find((player) => player.id === playerId)?.name ?? "Unknown Player";
}

function summarizeResult(fixture) {
  if (fixture.homeScore === fixture.awayScore) {
    return "Drawn match, so both players collect a point.";
  }

  const winnerId = fixture.homeScore > fixture.awayScore ? fixture.homePlayerId : fixture.awayPlayerId;
  return `${getPlayerName(winnerId)} took the win and added two points.`;
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
