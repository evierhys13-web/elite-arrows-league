const STORAGE_KEY = "bullseye-league-state";

const today = new Date();
const inDays = (days) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

const demoState = createDemoState();
const state = loadState();

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

divisionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(divisionForm);
  const name = formData.get("divisionName").toString().trim();
  const format = formData.get("divisionFormat").toString().trim();

  if (!name || !format) {
    return;
  }

  state.divisions.push({ id: crypto.randomUUID(), name, format });
  persistState();
  divisionForm.reset();
  render();
});

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(playerForm);
  const name = formData.get("playerName").toString().trim();
  const divisionId = formData.get("playerDivision").toString();
  const venue = formData.get("playerVenue").toString().trim();

  if (!name || !divisionId || !venue) {
    return;
  }

  state.players.push({ id: crypto.randomUUID(), name, divisionId, venue });
  persistState();
  playerForm.reset();
  render();
});

fixtureDivisionSelect.addEventListener("change", () => {
  renderPlayerMatchOptions(fixtureDivisionSelect.value);
});

generateFixturesButton.addEventListener("click", () => {
  const divisionId = fixtureDivisionSelect.value;
  if (!divisionId) {
    return;
  }

  generateRoundRobinFixtures(divisionId);
  persistState();
  render();
});

fixtureForm.addEventListener("submit", (event) => {
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

  state.fixtures.push({
    id: crypto.randomUUID(),
    divisionId,
    homePlayerId,
    awayPlayerId,
    matchDate,
    homeScore: null,
    awayScore: null
  });

  persistState();
  fixtureForm.reset();
  render();
});

resultForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(resultForm);
  const fixtureId = formData.get("fixtureSelect").toString();
  const homeScore = Number(formData.get("homeScore"));
  const awayScore = Number(formData.get("awayScore"));

  if (!fixtureId || Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
    return;
  }

  const fixture = state.fixtures.find((item) => item.id === fixtureId);
  if (!fixture) {
    return;
  }

  fixture.homeScore = homeScore;
  fixture.awayScore = awayScore;
  persistState();
  resultForm.reset();
  render();
});

resetButton.addEventListener("click", () => {
  const cloned = createDemoState();
  state.divisions = cloned.divisions;
  state.players = cloned.players;
  state.fixtures = cloned.fixtures;
  persistState();
  render();
});

function createDemoState() {
  const divisions = [
    { id: crypto.randomUUID(), name: "Premier Division", format: "Best of 11 legs" },
    { id: crypto.randomUUID(), name: "Division One", format: "Best of 9 legs" }
  ];

  const players = [
    { id: crypto.randomUUID(), name: "Luke Carter", divisionId: divisions[0].id, venue: "The Red Lion" },
    { id: crypto.randomUUID(), name: "Mason Reed", divisionId: divisions[0].id, venue: "Market Tavern" },
    { id: crypto.randomUUID(), name: "Ben Walsh", divisionId: divisions[0].id, venue: "The Borough Arms" },
    { id: crypto.randomUUID(), name: "Tyler Price", divisionId: divisions[1].id, venue: "Railway Club" },
    { id: crypto.randomUUID(), name: "Owen Blake", divisionId: divisions[1].id, venue: "Crown & Anchor" },
    { id: crypto.randomUUID(), name: "Elliot Shaw", divisionId: divisions[1].id, venue: "The Fox" }
  ];

  const fixtures = [
    {
      id: crypto.randomUUID(),
      divisionId: divisions[0].id,
      homePlayerId: players[0].id,
      awayPlayerId: players[1].id,
      matchDate: inDays(-7),
      homeScore: 6,
      awayScore: 3
    },
    {
      id: crypto.randomUUID(),
      divisionId: divisions[0].id,
      homePlayerId: players[2].id,
      awayPlayerId: players[0].id,
      matchDate: inDays(-2),
      homeScore: 5,
      awayScore: 5
    },
    {
      id: crypto.randomUUID(),
      divisionId: divisions[1].id,
      homePlayerId: players[3].id,
      awayPlayerId: players[4].id,
      matchDate: inDays(-4),
      homeScore: 4,
      awayScore: 5
    },
    {
      id: crypto.randomUUID(),
      divisionId: divisions[1].id,
      homePlayerId: players[4].id,
      awayPlayerId: players[5].id,
      matchDate: inDays(3),
      homeScore: null,
      awayScore: null
    }
  ];

  return { divisions, players, fixtures };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return createDemoState();
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch (error) {
    return createDemoState();
  }
}

function normalizeState(raw) {
  if (Array.isArray(raw.divisions) && Array.isArray(raw.players) && Array.isArray(raw.fixtures)) {
    return { divisions: raw.divisions, players: raw.players, fixtures: raw.fixtures };
  }

  return createDemoState();
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    fragment.querySelector(".chip-action").addEventListener("click", () => removeDivision(division.id));
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
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((player) => {
      const fragment = playerChipTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".team-chip");
      fragment.querySelector("h3").textContent = player.name;
      fragment.querySelector("p").textContent = `${getDivisionName(player.divisionId)} | ${player.venue}`;
      fragment.querySelector(".chip-action").addEventListener("click", () => removePlayer(player.id));
      playerList.append(card);
    });
}

function renderSelectOptions() {
  const divisionPlaceholder = '<option value="">Select a division</option>';
  const divisionOptions = state.divisions.map((division) => `<option value="${division.id}">${division.name}</option>`).join("");

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
  const sortedFixtures = [...state.fixtures].sort((a, b) => a.matchDate.localeCompare(b.matchDate));

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
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate))
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

function generateRoundRobinFixtures(divisionId) {
  const players = getPlayersByDivision(divisionId);
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
        id: crypto.randomUUID(),
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

function removeDivision(divisionId) {
  const playerIds = state.players.filter((player) => player.divisionId === divisionId).map((player) => player.id);
  state.divisions = state.divisions.filter((division) => division.id !== divisionId);
  state.players = state.players.filter((player) => player.divisionId !== divisionId);
  state.fixtures = state.fixtures.filter((fixture) => {
    return fixture.divisionId !== divisionId && !playerIds.includes(fixture.homePlayerId) && !playerIds.includes(fixture.awayPlayerId);
  });
  persistState();
  render();
}

function removePlayer(playerId) {
  state.players = state.players.filter((player) => player.id !== playerId);
  state.fixtures = state.fixtures.filter((fixture) => fixture.homePlayerId !== playerId && fixture.awayPlayerId !== playerId);
  persistState();
  render();
}

function getPlayersByDivision(divisionId) {
  return state.players.filter((player) => player.divisionId === divisionId).sort((a, b) => a.name.localeCompare(b.name));
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

render();
