const sessionKey = "elite-arrows-session";
const themeKey = "elite-arrows-theme";

let state = {
  divisions: [],
  seasons: [],
  teams: [],
  fixtures: [],
  paymentOptions: {},
  announcements: [],
  chats: [],
  players: [],
  matches: [],
  siteSettings: {},
  currentSeasonId: "",
  sessionUserId: getStoredSessionId()
};

let activeSection = "overview";
let deferredInstallPrompt = null;
let touchStartX = 0;
let touchStartY = 0;
let previousPaymentStatus = "";
let seasonTimerHandle = null;

const navButtons = [...document.querySelectorAll(".nav-button")];
const mobileNavButtons = [...document.querySelectorAll(".mobile-nav-button")];
const sectionViews = [...document.querySelectorAll(".section-view")];
const adminNavButton = document.querySelector("#adminNavButton");
const adminSection = document.querySelector('[data-section="admin"]');
const dashboardMetrics = document.querySelector("#dashboardMetrics");
const seasonTitle = document.querySelector("#seasonTitle");
const seasonMetrics = document.querySelector("#seasonMetrics");
const overviewMetrics = document.querySelector("#overviewMetrics");
const openSubscriptionButton = document.querySelector("#openSubscriptionButton");
const announcementCards = document.querySelector("#announcementCards");
const paymentStatusCard = document.querySelector("#paymentStatusCard");
const paymentOptionsCard = document.querySelector("#paymentOptionsCard");
const overallStandingsBody = document.querySelector("#overallStandingsBody");
const divisionTables = document.querySelector("#divisionTables");
const recentResults = document.querySelector("#recentResults");
const matchCards = document.querySelector("#matchCards");
const profilesByDivision = document.querySelector("#profilesByDivision");
const fixtureCards = document.querySelector("#fixtureCards");
const opponentSelect = document.querySelector("#opponentId");
const fixtureSelect = document.querySelector("#fixtureId");
const matchForm = document.querySelector("#matchForm");
const profileDrawer = document.querySelector("#profileDrawer");
const profileCard = document.querySelector("#profileCard");
const profileForm = document.querySelector("#profileForm");
const logoutButton = document.querySelector("#logoutButton");
const openProfileButton = document.querySelector("#openProfileButton");
const closeProfileButton = document.querySelector("#closeProfileButton");
const installButton = document.querySelector("#installButton");
const topbarInstallButton = document.querySelector("#topbarInstallButton");
const themeToggleButton = document.querySelector("#themeToggleButton");
const topbarThemeToggleButton = document.querySelector("#topbarThemeToggleButton");
const adminPendingResults = document.querySelector("#adminPendingResults");
const seasonForm = document.querySelector("#seasonForm");
const seasonCards = document.querySelector("#seasonCards");
const teamForm = document.querySelector("#teamForm");
const teamCards = document.querySelector("#teamCards");
const paymentForm = document.querySelector("#paymentForm");
const adminPlayerForm = document.querySelector("#adminPlayerForm");
const adminPlayerCards = document.querySelector("#adminPlayerCards");
const fixtureForm = document.querySelector("#fixtureForm");
const adminFixtureCards = document.querySelector("#adminFixtureCards");
const announcementForm = document.querySelector("#announcementForm");
const adminAnnouncementCards = document.querySelector("#adminAnnouncementCards");
const adminPaymentCards = document.querySelector("#adminPaymentCards");
const exportButton = document.querySelector("#exportButton");
const importButton = document.querySelector("#importButton");
const importData = document.querySelector("#importData");
const siteSettingsForm = document.querySelector("#siteSettingsForm");
const sectionOrder = ["overview", "payment", "results", "tables", "profiles", "submit", "admin"];

navButtons.forEach((button) => button.addEventListener("click", () => setActiveSection(button.dataset.view)));
mobileNavButtons.forEach((button) => button.addEventListener("click", () => setActiveSection(button.dataset.view)));
logoutButton.addEventListener("click", signOut);
openProfileButton.addEventListener("click", () => { profileDrawer.hidden = false; });
closeProfileButton.addEventListener("click", () => { profileDrawer.hidden = true; });
themeToggleButton.addEventListener("click", toggleTheme);
topbarThemeToggleButton.addEventListener("click", toggleTheme);
installButton.addEventListener("click", promptInstall);
topbarInstallButton.addEventListener("click", promptInstall);
matchForm.addEventListener("submit", submitMatch);
profileForm.addEventListener("submit", saveProfile);
seasonForm.addEventListener("submit", saveSeason);
teamForm.addEventListener("submit", saveTeam);
paymentForm.addEventListener("submit", savePayment);
adminPlayerForm.addEventListener("submit", saveAdminPlayer);
fixtureForm.addEventListener("submit", saveFixture);
announcementForm.addEventListener("submit", saveAnnouncement);
exportButton.addEventListener("click", exportData);
importButton.addEventListener("click", importLeagueData);
siteSettingsForm.addEventListener("submit", saveSiteSettings);
openSubscriptionButton.addEventListener("click", () => setActiveSection("payment"));

document.addEventListener("touchstart", handleTouchStart, { passive: true });
document.addEventListener("touchend", handleTouchEnd, { passive: true });
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  syncInstallButtons();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  syncInstallButtons();
});

applyTheme(localStorage.getItem(themeKey) || "dark");
registerServiceWorker();
bootstrap();
startSeasonTimer();

async function bootstrap() {
  if (!state.sessionUserId) {
    window.location.href = "/index.html";
    return;
  }

  try {
    const response = await fetch("/api/bootstrap");
    const data = await response.json();
    state = { ...data, sessionUserId: state.sessionUserId };
    if (!currentUser()) {
      signOut();
      return;
    }
    previousPaymentStatus = currentUser()?.paymentStatus || "";
    const authFlash = sessionStorage.getItem("elite-arrows-auth-flash");
    if (authFlash) {
      window.alert(authFlash);
      sessionStorage.removeItem("elite-arrows-auth-flash");
    }
    render();
  } catch {
    window.alert("Could not load the dashboard right now.");
  }
}

function render() {
  renderNavigation();
  renderDashboardMetrics();
  renderSeasonMetrics();
  renderOverviewMetrics();
  renderPaymentSection();
  renderAnnouncements();
  renderProfile();
  renderOpponentOptions();
  renderFixtureOptions();
  renderOverallTable();
  renderDivisionTables();
  renderProfiles();
  renderResults();
  renderMatchLog();
  renderFixtures();
  renderAdmin();
}

function renderNavigation() {
  const isAdmin = Boolean(currentUser()?.isAdmin);
  const hasPaid = hasUnlockedAccess();
  adminNavButton.hidden = !isAdmin;
  adminSection.hidden = !isAdmin;
  navButtons.forEach((button) => {
    if (button.dataset.view === "admin") {
      button.hidden = !isAdmin;
    }
    if (!hasPaid && !["overview", "payment", "admin"].includes(button.dataset.view)) {
      button.disabled = true;
      button.classList.add("is-locked");
    } else {
      button.disabled = false;
      button.classList.remove("is-locked");
    }
    button.classList.toggle("is-active", button.dataset.view === activeSection);
  });
  mobileNavButtons.forEach((button) => {
    if (!hasPaid && button.dataset.view !== "overview") {
      button.disabled = true;
      button.classList.add("is-locked");
    } else {
      button.disabled = false;
      button.classList.remove("is-locked");
    }
    button.classList.toggle("is-active", button.dataset.view === activeSection);
  });
  sectionViews.forEach((section) => section.classList.toggle("is-active", section.dataset.section === activeSection));
  if (!isAdmin && activeSection === "admin") {
    activeSection = "overview";
    renderNavigation();
  } else if (!hasPaid && !["overview", "payment", "admin"].includes(activeSection)) {
    activeSection = "payment";
    renderNavigation();
  }
}

function renderDashboardMetrics() {
  const user = currentUser();
  dashboardMetrics.innerHTML = `
    <div class="metric"><span>Signed In</span><strong>${user.username}</strong></div>
    <div class="metric"><span>Role</span><strong>${user.isAdmin ? "Admin" : "Player"}</strong></div>
  `;
}

function renderSeasonMetrics() {
  const season = currentSeason();
  if (!season) return;
  seasonTitle.textContent = `${season.name} Countdown`;
  const now = new Date();
  const start = new Date(`${season.startDate}T00:00:00`);
  const end = new Date(`${season.endDate}T23:59:59`);
  const target = now < start ? start : end;
  const label = now < start ? "Season Starts In" : "Season Ends In";
  const diff = Math.max(target.getTime() - now.getTime(), 0);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  seasonMetrics.innerHTML = `
    <div class="metric"><span>${label}</span><strong>${days}d ${hours}h ${minutes}m ${seconds}s</strong></div>
    <div class="metric"><span>Season Window</span><strong>${formatDate(season.startDate)} to ${formatDate(season.endDate)}</strong></div>
    <div class="metric"><span>Pending Approvals</span><strong>${pendingMatches().length}</strong></div>
  `;
}

function renderOverviewMetrics() {
  const approved = approvedMatches();
  overviewMetrics.innerHTML = `
    <div class="metric"><span>Players</span><strong>${state.players.length}</strong></div>
    <div class="metric"><span>Approved Results</span><strong>${approved.length}</strong></div>
    <div class="metric"><span>Pending Results</span><strong>${pendingMatches().length}</strong></div>
    <div class="metric"><span>Subscription</span><strong>${hasUnlockedAccess() ? "Active" : "Required"}</strong></div>
  `;
}

function renderPaymentSection() {
  const user = currentUser();
  const statusLabel = user.isAdmin ? "Admin Access Active" : user.paymentStatus === "paid" ? "Access Unlocked" : user.paymentStatus === "pending" ? "Payment Pending Approval" : "Payment Required";
  paymentStatusCard.innerHTML = `
    <article class="result-card">
      <div class="result-meta">
        <strong>${statusLabel}</strong>
        <span>${user.paymentStatus.toUpperCase()}</span>
      </div>
      <p>${user.isAdmin ? "Admin accounts can access the full site and track league payments." : user.paymentStatus === "paid" ? "Your account has full access to league features." : user.paymentStatus === "pending" ? "Your payment has been submitted and is waiting for admin approval." : "Submit your league payment to unlock tables, results, fixtures, and match submission."}</p>
    </article>
  `;
  paymentOptionsCard.innerHTML = `
    <div class="metric"><span>${state.paymentOptions.feeLabel || "League Fee"}</span><strong>GBP ${state.paymentOptions.feeAmount || "5.00"}</strong></div>
    <div class="team-chip team-chip-profile"><div><h3>Bank Transfer</h3><p>${state.paymentOptions.bankTransfer?.accountName || ""}</p><p>Sort code ${state.paymentOptions.bankTransfer?.sortCode || ""} | Account ${state.paymentOptions.bankTransfer?.accountNumber || ""}</p><p>${state.paymentOptions.bankTransfer?.referenceHint || ""}</p></div></div>
    <div class="team-chip team-chip-profile"><div><h3>PayPal</h3><p>${state.paymentOptions.paypal?.email || state.paymentOptions.paypal?.link || ""}</p></div></div>
  `;
}

function renderAnnouncements() {
  announcementCards.innerHTML = "";
  if (!state.announcements.length) {
    announcementCards.append(createEmptyState("No announcements yet", "League updates from admins will appear here."));
    return;
  }
  state.announcements.slice(0, 5).forEach((announcement) => {
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `<div class="result-meta"><strong>${announcement.title}</strong><span>${formatDateTime(announcement.createdAt)}</span></div><p>${announcement.body}</p>`;
    announcementCards.append(card);
  });
}

function renderProfile() {
  const user = currentUser();
  profileCard.innerHTML = `
    <h3>${user.username}</h3>
    <p>${getDivisionName(user.divisionId)}</p>
    <p>${user.bio || "No bio written yet."}</p>
    <p>3-dart average: ${formatAverage(user.threeDartAverage)}</p>
    ${user.dartCounterLink ? `<p>DartCounter: <a href="${user.dartCounterLink}" target="_blank" rel="noreferrer">${user.dartCounterLink}</a></p>` : ""}
  `;
  profileForm.elements.profileUsername.value = user.username;
  profileForm.elements.profileThreeDartAverage.value = user.threeDartAverage ?? "";
  profileForm.elements.profileDartCounterLink.value = user.dartCounterLink ?? "";
  profileForm.elements.profileBio.value = user.bio ?? "";
}

function renderOpponentOptions() {
  const user = currentUser();
  opponentSelect.innerHTML = '<option value="">Select opponent</option>' + state.players
    .filter((player) => player.id !== user.id)
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((player) => `<option value="${player.id}">${player.username} - ${getDivisionName(player.divisionId)}</option>`)
    .join("");
}

function renderFixtureOptions() {
  const user = currentUser();
  fixtureSelect.innerHTML = '<option value="">No linked fixture</option>' + currentFixtures()
    .filter((fixture) => fixture.playerOneId === user.id || fixture.playerTwoId === user.id)
    .map((fixture) => `<option value="${fixture.id}">${getUsername(fixture.playerOneId)} vs ${getUsername(fixture.playerTwoId)} - ${formatDate(fixture.scheduledDate)}</option>`)
    .join("");
}

function renderOverallTable() {
  overallStandingsBody.innerHTML = "";
  const standings = calculateStandings(state.players.map((player) => player.id));
  if (!standings.length) {
    overallStandingsBody.innerHTML = '<tr><td colspan="10">No approved results yet.</td></tr>';
    return;
  }
  standings.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${index + 1}</td><td>${entry.username}</td><td>${getDivisionName(entry.divisionId)}</td><td>${entry.played}</td><td>${entry.won}</td><td>${entry.drawn}</td><td>${entry.lost}</td><td>${entry.legsFor}-${entry.legsAgainst}</td><td>${entry.legsFor - entry.legsAgainst}</td><td><strong>${entry.points}</strong></td>`;
    overallStandingsBody.append(row);
  });
}

function renderDivisionTables() {
  divisionTables.innerHTML = "";
  state.divisions.forEach((division) => {
    const divisionPlayers = state.players.filter((player) => player.divisionId === division.id);
    const standings = calculateStandings(divisionPlayers.map((player) => player.id)).filter((entry) => entry.played > 0);
    const card = document.createElement("article");
    card.className = "division-table-card";
    card.innerHTML = `
      <div class="panel-heading"><div><h3>${division.name}</h3><p>${divisionPlayers.length} registered players</p></div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Legs</th><th>Diff</th><th>Pts</th></tr></thead>
          <tbody>${renderStandingRows(standings)}</tbody>
        </table>
      </div>
      <div class="inline-profile-list"><p class="inline-section-label">Registered Profiles</p>${renderInlineProfiles(divisionPlayers)}</div>
    `;
    divisionTables.append(card);
  });
}

function renderProfiles() {
  profilesByDivision.innerHTML = "";
  state.divisions.forEach((division) => {
    const divisionPlayers = state.players.filter((player) => player.divisionId === division.id).sort((a, b) => a.username.localeCompare(b.username));
    const card = document.createElement("article");
    card.className = "division-table-card";
    card.innerHTML = `<div class="panel-heading"><div><h3>${division.name}</h3><p>${divisionPlayers.length} registered profiles</p></div></div><div class="inline-profile-list">${renderInlineProfiles(divisionPlayers)}</div>`;
    profilesByDivision.append(card);
  });
}

function renderResults() {
  recentResults.innerHTML = "";
  const results = [...approvedMatches()].sort((a, b) => b.matchDate.localeCompare(a.matchDate)).slice(0, 8);
  if (!results.length) {
    recentResults.append(createEmptyState("No approved results yet", "Submitted results appear here once an admin approves them."));
    return;
  }
  results.forEach((match) => recentResults.append(createMatchCard(match, true)));
}

function renderMatchLog() {
  matchCards.innerHTML = "";
  const results = [...approvedMatches()].sort((a, b) => b.matchDate.localeCompare(a.matchDate));
  if (!results.length) {
    matchCards.append(createEmptyState("No approved match log yet", "Approved match submissions are listed here."));
    return;
  }
  results.forEach((match) => matchCards.append(createMatchCard(match, false)));
}

function renderFixtures() {
  fixtureCards.innerHTML = "";
  const fixtures = [...currentFixtures()].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  if (!fixtures.length) {
    fixtureCards.append(createEmptyState("No fixtures scheduled", "Admins can add fixtures in the control centre."));
    return;
  }
  fixtures.forEach((fixture) => {
    const card = document.createElement("article");
    card.className = "fixture-card";
    card.innerHTML = `<div class="fixture-meta"><strong>${getUsername(fixture.playerOneId)} vs ${getUsername(fixture.playerTwoId)}</strong><span class="status-pill">${formatDate(fixture.scheduledDate)}</span></div><p>${fixture.notes || "No notes added."}</p>`;
    fixtureCards.append(card);
  });
}

function renderAdmin() {
  if (!currentUser()?.isAdmin) {
    return;
  }

  seasonForm.elements.seasonName.value = currentSeason()?.name ?? "";
  seasonForm.elements.seasonStart.value = currentSeason()?.startDate ?? "";
  seasonForm.elements.seasonEnd.value = currentSeason()?.endDate ?? "";
  seasonForm.elements.seasonStatus.value = currentSeason()?.status ?? "active";
  seasonForm.elements.seasonId.value = currentSeason()?.id ?? "";
  announcementForm.elements.announcementId.value = "";
  
  applySiteColors();

  adminPendingResults.innerHTML = "";
  const pending = pendingMatches();
  if (!pending.length) {
    adminPendingResults.append(createEmptyState("Nothing waiting", "New submitted results will appear here for approval."));
  } else {
    pending.forEach((match) => {
      const card = createMatchCard(match, false);
      const actions = document.createElement("div");
      actions.className = "topbar-actions section-gap";
      const approveButton = document.createElement("button");
      approveButton.className = "primary-button";
      approveButton.type = "button";
      approveButton.textContent = "Approve";
      approveButton.addEventListener("click", () => adminSend("/api/admin/results/approve", { id: match.id }));
      const rejectButton = document.createElement("button");
      rejectButton.className = "ghost-button";
      rejectButton.type = "button";
      rejectButton.textContent = "Reject";
      rejectButton.addEventListener("click", () => adminSend("/api/admin/results/reject", { id: match.id }));
      actions.append(approveButton, rejectButton);
      card.append(actions);
      adminPendingResults.append(card);
    });
  }

  seasonCards.innerHTML = "";
  state.seasons.forEach((season) => {
    const card = document.createElement("article");
    card.className = "fixture-card";
    card.innerHTML = `<div class="fixture-meta"><strong>${season.name}</strong><span class="status-pill ${season.status === "archived" ? "pending" : ""}">${season.status}</span></div><p>${formatDate(season.startDate)} to ${formatDate(season.endDate)}</p>`;
    seasonCards.append(card);
  });

  teamCards.innerHTML = "";
  if (!state.teams.length) teamCards.append(createEmptyState("No teams yet", "Add a team to begin grouping players."));
  state.teams.forEach((team) => teamCards.append(createAdminItemCard(team.name, `Players: ${state.players.filter((player) => player.teamId === team.id).length}`, () => loadTeam(team), () => adminSend("/api/admin/team/delete", { id: team.id }))));

  adminPlayerCards.innerHTML = "";
  state.players.forEach((player) => {
    const card = createAdminItemCard(
      player.username,
      `${player.email} | ${getDivisionName(player.divisionId)}${player.isAdmin ? " | Admin" : ""}${player.adminRequestPending ? " | Admin request pending" : ""}`,
      () => loadAdminPlayer(player),
      () => adminSend("/api/admin/player/delete", { id: player.id })
    );
    if (player.adminRequestPending) {
      const actions = document.createElement("div");
      actions.className = "topbar-actions section-gap";
      const approveButton = document.createElement("button");
      approveButton.className = "primary-button";
      approveButton.type = "button";
      approveButton.textContent = "Approve Admin";
      approveButton.addEventListener("click", () => adminSend("/api/admin/approve-admin", { id: player.id }));
      const rejectButton = document.createElement("button");
      rejectButton.className = "ghost-button";
      rejectButton.type = "button";
      rejectButton.textContent = "Reject Admin";
      rejectButton.addEventListener("click", () => adminSend("/api/admin/reject-admin", { id: player.id }));
      actions.append(approveButton, rejectButton);
      card.append(actions);
    }
    adminPlayerCards.append(card);
  });

  adminFixtureCards.innerHTML = "";
  currentFixtures().forEach((fixture) => adminFixtureCards.append(createAdminItemCard(`${getUsername(fixture.playerOneId)} vs ${getUsername(fixture.playerTwoId)}`, formatDate(fixture.scheduledDate), () => loadFixture(fixture), () => adminSend("/api/admin/fixture/delete", { id: fixture.id }))));

  adminAnnouncementCards.innerHTML = "";
  if (!state.announcements.length) {
    adminAnnouncementCards.append(createEmptyState("No announcements posted", "Publish league updates here and they will also appear in the announcement chat."));
  } else {
    state.announcements.forEach((announcement) => {
      adminAnnouncementCards.append(
        createAdminItemCard(
          announcement.title,
          formatDateTime(announcement.createdAt),
          () => loadAnnouncement(announcement),
          () => adminSend("/api/admin/announcement/delete", { id: announcement.id })
        )
      );
    });
  }

  adminPaymentCards.innerHTML = "";
  if (!state.players.length) {
    adminPaymentCards.append(createEmptyState("No players yet", "Payment tracking appears here once players register."));
  } else {
    state.players.forEach((player) => {
      const card = document.createElement("article");
      card.className = "fixture-card";
      card.innerHTML = `
        <div class="fixture-meta">
          <strong>${player.username}</strong>
          <span class="status-pill ${player.paymentStatus !== "paid" ? "pending" : ""}">${player.paymentStatus}</span>
        </div>
        <p>${player.paymentMethod || "No method submitted"}${player.paymentReference ? ` | Ref ${player.paymentReference}` : ""}</p>
        ${player.paymentSubmittedAt ? `<p>Submitted ${formatDateTime(player.paymentSubmittedAt)}</p>` : "<p>No payment submitted yet.</p>"}
        ${player.paymentProofData ? `<div class="result-image-wrap">${renderMediaAttachment({ type: inferAttachmentType(player.paymentProofData), name: player.paymentProofName || "Payment proof", dataUrl: player.paymentProofData })}</div>` : ""}
      `;
      const actions = document.createElement("div");
      actions.className = "topbar-actions section-gap";
      const approveButton = document.createElement("button");
      approveButton.className = "primary-button";
      approveButton.type = "button";
      approveButton.textContent = "Mark Paid";
      approveButton.addEventListener("click", () => adminSend("/api/admin/payment/approve", { id: player.id }));
      const rejectButton = document.createElement("button");
      rejectButton.className = "ghost-button";
      rejectButton.type = "button";
      rejectButton.textContent = "Mark Unpaid";
      rejectButton.addEventListener("click", () => adminSend("/api/admin/payment/reject", { id: player.id }));
      actions.append(approveButton, rejectButton);
      card.append(actions);
      adminPaymentCards.append(card);
    });
  }

  adminPlayerForm.elements.playerTeamId.innerHTML = '<option value="">No team</option>' + state.teams.map((team) => `<option value="${team.id}">${team.name}</option>`).join("");
  fixtureForm.elements.fixturePlayerOneId.innerHTML = state.players.map((player) => `<option value="${player.id}">${player.username}</option>`).join("");
  fixtureForm.elements.fixturePlayerTwoId.innerHTML = state.players.map((player) => `<option value="${player.id}">${player.username}</option>`).join("");
}

async function submitMatch(event) {
  event.preventDefault();
  const formData = new FormData(matchForm);
  const resultImageData = await readFileAsDataUrl(formData.get("resultImage"));
  if (!resultImageData) {
    window.alert("Add a result screenshot before submitting the match.");
    return;
  }
  await send("/api/matches", {
    opponentId: formData.get("opponentId"),
    fixtureId: formData.get("fixtureId"),
    matchDate: formData.get("matchDate"),
    playerOneScore: Number(formData.get("playerOneScore")),
    playerTwoScore: Number(formData.get("playerTwoScore")),
    playerOneAverage: parseOptionalNumber(formData.get("playerOneAverage")),
    playerTwoAverage: parseOptionalNumber(formData.get("playerTwoAverage")),
    playerOne180s: parseOptionalInteger(formData.get("playerOne180s")),
    playerTwo180s: parseOptionalInteger(formData.get("playerTwo180s")),
    resultImageData,
    resultImageName: formData.get("resultImage")?.name ?? ""
  });
  matchForm.reset();
}

async function saveProfile(event) {
  event.preventDefault();
  const formData = new FormData(profileForm);
  await send("/api/profile", {
    username: formData.get("profileUsername"),
    threeDartAverage: parseOptionalNumber(formData.get("profileThreeDartAverage")),
    dartCounterLink: formData.get("profileDartCounterLink"),
    bio: formData.get("profileBio")
  });
}

async function saveSeason(event) {
  event.preventDefault();
  const formData = new FormData(seasonForm);
  await adminSend("/api/admin/season", {
    id: formData.get("seasonId"),
    name: formData.get("seasonName"),
    startDate: formData.get("seasonStart"),
    endDate: formData.get("seasonEnd"),
    status: formData.get("seasonStatus")
  });
}

async function saveTeam(event) {
  event.preventDefault();
  const formData = new FormData(teamForm);
  await adminSend("/api/admin/team", {
    id: formData.get("teamId"),
    name: formData.get("teamName")
  });
  teamForm.reset();
}

async function savePayment(event) {
  event.preventDefault();
  const formData = new FormData(paymentForm);
  const proofFile = formData.get("paymentProof");
  const paymentProofData = await readFileAsDataUrl(proofFile);
  await send("/api/payment/submit", {
    paymentMethod: formData.get("paymentMethod"),
    paymentReference: formData.get("paymentReference"),
    paymentProofData,
    paymentProofName: proofFile?.name ?? ""
  });
  paymentForm.reset();
}

async function saveAdminPlayer(event) {
  event.preventDefault();
  const formData = new FormData(adminPlayerForm);
  await adminSend("/api/admin/player", {
    id: formData.get("playerId"),
    username: formData.get("playerUsername"),
    email: formData.get("playerEmail"),
    password: formData.get("playerPassword"),
    threeDartAverage: parseOptionalNumber(formData.get("playerAverage")),
    teamId: formData.get("playerTeamId"),
    dartCounterLink: formData.get("playerDartCounterLink"),
    bio: formData.get("playerBio"),
    isAdmin: formData.get("playerIsAdmin") === "on",
    adminRequestPending: false
  });
  adminPlayerForm.reset();
}

async function saveFixture(event) {
  event.preventDefault();
  const formData = new FormData(fixtureForm);
  await adminSend("/api/admin/fixture", {
    id: formData.get("adminFixtureId"),
    playerOneId: formData.get("fixturePlayerOneId"),
    playerTwoId: formData.get("fixturePlayerTwoId"),
    scheduledDate: formData.get("fixtureScheduledDate"),
    notes: formData.get("fixtureNotes")
  });
  fixtureForm.reset();
}

async function saveAnnouncement(event) {
  event.preventDefault();
  const formData = new FormData(announcementForm);
  await adminSend("/api/admin/announcement", {
    id: formData.get("announcementId"),
    title: formData.get("announcementTitle"),
    body: formData.get("announcementBody")
  });
  announcementForm.reset();
}

async function exportData() {
  const response = await fetch(`/api/admin/export?sessionUserId=${encodeURIComponent(state.sessionUserId)}`);
  if (!response.ok) {
    window.alert("Could not export league data.");
    return;
  }
  const data = await response.json();
  importData.value = JSON.stringify(data, null, 2);
}

async function importLeagueData() {
  try {
    const parsed = JSON.parse(importData.value);
    await adminSend("/api/admin/import", { importData: parsed });
  } catch {
    window.alert("Paste valid JSON before importing.");
  }
}

async function saveSiteSettings(event) {
  event.preventDefault();
  const formData = new FormData(siteSettingsForm);
  await adminSend("/api/admin/site-settings", {
    backgroundColor: formData.get("backgroundColor"),
    accentColor: formData.get("accentColor"),
    buttonColor: formData.get("buttonColor")
  });
  applySiteColors();
  window.alert("Site colors updated successfully!");
}

async function send(url, payload) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, sessionUserId: state.sessionUserId })
    });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error || "Something went wrong.");
      return;
    }
    const oldStatus = currentUser()?.paymentStatus || previousPaymentStatus;
    state = data;
    const newStatus = currentUser()?.paymentStatus || "";
    if (oldStatus !== "paid" && newStatus === "paid") {
      window.alert("welcome to elite arrows, you are now a member!");
    }
    previousPaymentStatus = newStatus;
    render();
  } catch {
    window.alert("Could not reach the server.");
  }
}

async function adminSend(url, payload) {
  await send(url, payload);
}

function calculateStandings(playerIds) {
  const table = state.players.filter((player) => playerIds.includes(player.id)).map((player) => ({
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
  approvedMatches().forEach((match) => {
    const one = table.find((player) => player.id === match.playerOneId);
    const two = table.find((player) => player.id === match.playerTwoId);
    if (one) applyMatch(one, match.playerOneScore, match.playerTwoScore);
    if (two) applyMatch(two, match.playerTwoScore, match.playerOneScore);
  });
  return table.sort((a, b) => (b.points - a.points) || ((b.legsFor - b.legsAgainst) - (a.legsFor - a.legsAgainst)) || (b.legsFor - a.legsFor));
}

function applyMatch(player, scored, conceded) {
  player.played += 1;
  player.legsFor += scored;
  player.legsAgainst += conceded;
  if (scored > conceded) {
    player.won += 1;
    player.points += 2;
  } else if (scored < conceded) {
    player.lost += 1;
  } else {
    player.drawn += 1;
    player.points += 1;
  }
}

function renderStandingRows(standings) {
  if (!standings.length) return '<tr><td colspan="9">No approved results yet.</td></tr>';
  return standings.map((entry, index) => `<tr><td>${index + 1}</td><td>${entry.username}</td><td>${entry.played}</td><td>${entry.won}</td><td>${entry.drawn}</td><td>${entry.lost}</td><td>${entry.legsFor}-${entry.legsAgainst}</td><td>${entry.legsFor - entry.legsAgainst}</td><td><strong>${entry.points}</strong></td></tr>`).join("");
}

function renderInlineProfiles(players) {
  if (!players.length) return '<article class="empty-state"><strong>No profiles yet</strong><p>This division is waiting for registrations.</p></article>';
  return players.map((player) => `
    <article class="team-chip team-chip-profile">
      <div>
        <h3>${player.username}</h3>
        <p>3-dart avg ${formatAverage(player.threeDartAverage)}</p>
        <p>${player.bio || "No bio added yet."}</p>
      </div>
      <div class="profile-links">
        <span class="status-pill">${getPlayedMatches(player.id)} matches</span>
        ${player.dartCounterLink ? `<a class="chip-action button-link" href="${player.dartCounterLink}" target="_blank" rel="noreferrer">DartCounter</a>` : ""}
      </div>
    </article>
  `).join("");
}

function createMatchCard(match, compact) {
  const card = document.createElement("article");
  card.className = compact ? "result-card" : "fixture-card";
  const approvalText = match.status === "approved" ? "Approved" : "Pending";
  card.innerHTML = `
    <div class="fixture-meta">
      <strong>${getUsername(match.playerOneId)} ${match.playerOneScore} - ${match.playerTwoScore} ${getUsername(match.playerTwoId)}</strong>
      <span class="status-pill ${match.status === "pending" ? "pending" : ""}">${approvalText}</span>
    </div>
    <p>${formatDate(match.matchDate)} | Submitted by ${getUsername(match.submittedBy)}</p>
    <p>${formatMatchStats(match)}</p>
    ${renderResultImage(match)}
  `;
  return card;
}

function renderResultImage(match) {
  if (!match.resultImageData) return "";
  return `<div class="result-image-wrap"><img class="result-image" src="${match.resultImageData}" alt="Submitted result screenshot"></div>`;
}

function createAdminItemCard(title, description, onEdit, onDelete) {
  const card = document.createElement("article");
  card.className = "fixture-card";
  card.innerHTML = `<div class="fixture-meta"><strong>${title}</strong><span class="status-pill">Saved</span></div><p>${description}</p>`;
  const actions = document.createElement("div");
  actions.className = "topbar-actions section-gap";
  const editButton = document.createElement("button");
  editButton.className = "ghost-button";
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", onEdit);
  const deleteButton = document.createElement("button");
  deleteButton.className = "ghost-button";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", onDelete);
  actions.append(editButton, deleteButton);
  card.append(actions);
  return card;
}

function loadTeam(team) {
  teamForm.elements.teamId.value = team.id;
  teamForm.elements.teamName.value = team.name;
  setActiveSection("admin");
}

function loadAdminPlayer(player) {
  adminPlayerForm.elements.playerId.value = player.id;
  adminPlayerForm.elements.playerUsername.value = player.username;
  adminPlayerForm.elements.playerEmail.value = player.email;
  adminPlayerForm.elements.playerPassword.value = "";
  adminPlayerForm.elements.playerAverage.value = player.threeDartAverage ?? "";
  adminPlayerForm.elements.playerTeamId.value = player.teamId ?? "";
  adminPlayerForm.elements.playerDartCounterLink.value = player.dartCounterLink ?? "";
  adminPlayerForm.elements.playerBio.value = player.bio ?? "";
  adminPlayerForm.elements.playerIsAdmin.checked = Boolean(player.isAdmin);
  setActiveSection("admin");
}

function loadFixture(fixture) {
  fixtureForm.elements.adminFixtureId.value = fixture.id;
  fixtureForm.elements.fixturePlayerOneId.value = fixture.playerOneId;
  fixtureForm.elements.fixturePlayerTwoId.value = fixture.playerTwoId;
  fixtureForm.elements.fixtureScheduledDate.value = fixture.scheduledDate;
  fixtureForm.elements.fixtureNotes.value = fixture.notes ?? "";
  setActiveSection("admin");
}

function loadAnnouncement(announcement) {
  announcementForm.elements.announcementId.value = announcement.id;
  announcementForm.elements.announcementTitle.value = announcement.title;
  announcementForm.elements.announcementBody.value = announcement.body;
  setActiveSection("admin");
}

function currentUser() {
  return state.players.find((player) => player.id === state.sessionUserId) ?? null;
}

function hasUnlockedAccess() {
  const user = currentUser();
  return Boolean(user && (user.isAdmin || user.paymentStatus === "paid"));
}

function currentSeason() {
  return state.seasons.find((season) => season.id === state.currentSeasonId) || state.seasons[0] || null;
}

function currentFixtures() {
  return state.fixtures.filter((fixture) => fixture.seasonId === state.currentSeasonId);
}

function approvedMatches() {
  return state.matches.filter((match) => match.status === "approved" && match.seasonId === state.currentSeasonId);
}

function pendingMatches() {
  return state.matches.filter((match) => match.status === "pending" && match.seasonId === state.currentSeasonId);
}

function getDivisionName(divisionId) {
  return state.divisions.find((division) => division.id === divisionId)?.name ?? "Unknown";
}

function getUsername(playerId) {
  return state.players.find((player) => player.id === playerId)?.username ?? "Unknown";
}

function getPlayedMatches(playerId) {
  return approvedMatches().filter((match) => match.playerOneId === playerId || match.playerTwoId === playerId).length;
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

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(dateString));
}

function inferAttachmentType(dataUrl) {
  if (dataUrl.startsWith("data:image/")) return "image";
  if (dataUrl.startsWith("data:video/")) return "video";
  if (dataUrl.startsWith("data:audio/")) return "audio";
  return "file";
}

function renderMediaAttachment(attachment) {
  if (attachment.type === "image") {
    return `<img class="result-image" src="${attachment.dataUrl}" alt="${attachment.name}">`;
  }
  if (attachment.type === "video") {
    return `<video class="result-image" controls src="${attachment.dataUrl}"></video>`;
  }
  if (attachment.type === "audio") {
    return `<audio controls src="${attachment.dataUrl}"></audio>`;
  }
  return `<a class="chip-action button-link" href="${attachment.dataUrl}" download="${attachment.name}">Download ${attachment.name}</a>`;
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

function readFileAsDataUrl(file) {
  if (!(file instanceof File) || !file.size) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function createEmptyState(title, description) {
  const card = document.createElement("article");
  card.className = "empty-state";
  card.innerHTML = `<strong>${title}</strong><p>${description}</p>`;
  return card;
}

function setActiveSection(nextSection) {
  if (nextSection === "admin" && !currentUser()?.isAdmin) return;
  activeSection = nextSection;
  renderNavigation();
}

function signOut() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
  window.location.href = "/index.html";
}

function getStoredSessionId() {
  return localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || "";
}

function toggleTheme() {
  applyTheme(document.body.classList.contains("theme-light") ? "dark" : "light");
}

function applyTheme(theme) {
  document.body.classList.toggle("theme-light", theme === "light");
  localStorage.setItem(themeKey, theme);
  const label = theme === "light" ? "Dark Mode" : "Light Mode";
  themeToggleButton.textContent = label;
  topbarThemeToggleButton.textContent = label;
}

function applySiteColors() {
  const settings = state.siteSettings || {};
  const bg = settings.backgroundColor || "#0d1a28";
  const accent = settings.accentColor || "#4da6ff";
  const button = settings.buttonColor || "#4da6ff";
  
  document.documentElement.style.setProperty("--custom-bg", bg);
  document.documentElement.style.setProperty("--custom-accent", accent);
  document.documentElement.style.setProperty("--custom-brand", button);
  document.documentElement.style.setProperty("--custom-brand-dark", adjustBrightness(button, -20));
  document.documentElement.style.setProperty("--custom-brand-gradient", `linear-gradient(135deg, ${button}, ${adjustBrightness(button, 20)})`);
  
  siteSettingsForm.elements.backgroundColor.value = bg;
  siteSettingsForm.elements.accentColor.value = accent;
  siteSettingsForm.elements.buttonColor.value = button;
}

function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

async function promptInstall() {
  if (!deferredInstallPrompt) return;
  await deferredInstallPrompt.prompt();
  deferredInstallPrompt = null;
  syncInstallButtons();
}

function syncInstallButtons() {
  const hidden = !deferredInstallPrompt;
  installButton.hidden = hidden;
  topbarInstallButton.hidden = hidden;
}

function handleTouchStart(event) {
  if (profileDrawer.contains(event.target)) return;
  touchStartX = event.changedTouches[0]?.clientX ?? 0;
  touchStartY = event.changedTouches[0]?.clientY ?? 0;
}

function handleTouchEnd(event) {
  const touch = event.changedTouches[0];
  if (!touch) return;
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;
  if (Math.abs(deltaX) < 60 || Math.abs(deltaY) > 50) return;
  const availableSections = sectionOrder.filter((section) => section !== "admin" || currentUser()?.isAdmin);
  const currentIndex = availableSections.indexOf(activeSection);
  if (currentIndex === -1) return;
  if (deltaX < 0 && currentIndex < availableSections.length - 1) setActiveSection(availableSections[currentIndex + 1]);
  if (deltaX > 0 && currentIndex > 0) setActiveSection(availableSections[currentIndex - 1]);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  }).catch(() => {});
}

function startSeasonTimer() {
  if (seasonTimerHandle) window.clearInterval(seasonTimerHandle);
  seasonTimerHandle = window.setInterval(() => {
    if (!currentUser()) return;
    renderSeasonMetrics();
  }, 1000);
}
