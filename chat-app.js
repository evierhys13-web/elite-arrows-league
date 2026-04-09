const sessionKey = "elite-arrows-session";

let state = {
  divisions: [],
  players: [],
  friendships: [],
  friendRequests: [],
  chats: [],
  announcements: [],
  sessionUserId: localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || ""
};

let activeRoomId = "main";
let refreshTimer = null;
let replyToId = "";
let mediaRecorder = null;
let recordedAudio = null;

const chatRoomList = document.querySelector("#chatRoomList");
const friendList = document.querySelector("#friendList");
const friendRequestList = document.querySelector("#friendRequestList");
const playerDirectory = document.querySelector("#playerDirectory");
const chatMessages = document.querySelector("#chatMessages");
const chatRoomTitle = document.querySelector("#chatRoomTitle");
const chatRoomMeta = document.querySelector("#chatRoomMeta");
const chatForm = document.querySelector("#chatForm");
const replyComposer = document.querySelector("#replyComposer");
const replyLabel = document.querySelector("#replyLabel");
const replyPreview = document.querySelector("#replyPreview");
const clearReplyButton = document.querySelector("#clearReplyButton");
const attachmentInput = document.querySelector("#chatAttachments");
const attachmentPreview = document.querySelector("#attachmentPreview");
const recordAudioButton = document.querySelector("#recordAudioButton");
const messageInput = document.querySelector("#chatMessageInput");
const submitButton = chatForm.querySelector("button[type='submit']");
const emojiButtons = [...document.querySelectorAll(".emoji-button")];

chatForm.addEventListener("submit", submitMessage);
clearReplyButton.addEventListener("click", clearReply);
attachmentInput.addEventListener("change", renderAttachmentPreview);
recordAudioButton.addEventListener("click", toggleAudioRecording);
emojiButtons.forEach((button) => button.addEventListener("click", () => {
  messageInput.value += `${decodeEmoji(button.dataset.emoji)} `;
  messageInput.focus();
}));

bootstrap();

async function bootstrap() {
  if (!state.sessionUserId) {
    window.location.href = "/index.html";
    return;
  }

  await loadState();
  if (!currentUser()) {
    localStorage.removeItem(sessionKey);
    sessionStorage.removeItem(sessionKey);
    window.location.href = "/index.html";
    return;
  }

  render();
  refreshTimer = window.setInterval(loadState, 10000);
}

async function loadState() {
  const response = await fetch("/api/bootstrap");
  const data = await response.json();
  state = { ...data, sessionUserId: state.sessionUserId };
  if (!currentUser()) return;
  if (!roomExists(activeRoomId)) activeRoomId = "main";
  render();
}

async function submitMessage(event) {
  event.preventDefault();
  const attachments = await getAttachmentsPayload();
  if (recordedAudio) attachments.push(recordedAudio);

  const sent = await send("/api/chat/message", {
    roomId: activeRoomId,
    message: messageInput.value,
    replyToId,
    attachments
  });

  if (!sent) return;

  chatForm.reset();
  messageInput.value = "";
  recordedAudio = null;
  clearReply();
  renderAttachmentPreview();
  messageInput.focus();
}

async function send(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, sessionUserId: state.sessionUserId })
  });
  const data = await response.json();
  if (!response.ok) {
    window.alert(data.error || "Something went wrong.");
    return false;
  }
  state = data;
  render();
  return true;
}

function render() {
  if (!currentUser()) return;
  renderRooms();
  renderFriends();
  renderFriendRequests();
  renderPlayerDirectory();
  renderMessages();
  renderReplyComposer();
}

function renderRooms() {
  chatRoomList.innerHTML = "";
  buildLeagueRooms().forEach((room) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `nav-button${room.id === activeRoomId ? " is-active" : ""}`;
    button.textContent = room.name;
    button.addEventListener("click", () => {
      activeRoomId = room.id;
      clearReply();
      render();
    });
    chatRoomList.append(button);
  });
}

function renderFriends() {
  friendList.innerHTML = "";
  const friends = getFriends();
  if (!friends.length) {
    friendList.append(renderEmptyCard("No friends yet", "Send a request below to unlock private chats."));
    return;
  }

  friends.forEach((player) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `nav-button${activeRoomId === directRoomId(currentUser().id, player.id) ? " is-active" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(player.username)}</strong><span>${escapeHtml(getDivisionName(player.divisionId))}</span>`;
    button.addEventListener("click", () => {
      activeRoomId = directRoomId(currentUser().id, player.id);
      clearReply();
      render();
    });
    friendList.append(button);
  });
}

function renderFriendRequests() {
  friendRequestList.innerHTML = "";
  const incoming = state.friendRequests.filter((entry) => entry.toUserId === currentUser().id);
  if (!incoming.length) {
    friendRequestList.append(renderEmptyCard("No requests", "New add requests will show up here."));
    return;
  }

  incoming.forEach((requestEntry) => {
    const player = getPlayer(requestEntry.fromUserId);
    const card = document.createElement("article");
    card.className = "team-chip chat-list-card";
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(player?.username || "Player")}</h3>
        <p>Wants to add you for private chat.</p>
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "topbar-actions chat-action-group";

    const acceptButton = document.createElement("button");
    acceptButton.type = "button";
    acceptButton.className = "primary-button";
    acceptButton.textContent = "Accept";
    acceptButton.addEventListener("click", async () => {
      const accepted = await send("/api/chat/friend-accept", { requestId: requestEntry.id });
      if (accepted) {
        activeRoomId = directRoomId(currentUser().id, requestEntry.fromUserId);
        render();
      }
    });

    const declineButton = document.createElement("button");
    declineButton.type = "button";
    declineButton.className = "ghost-button";
    declineButton.textContent = "Decline";
    declineButton.addEventListener("click", () => send("/api/chat/friend-decline", { requestId: requestEntry.id }));

    actions.append(acceptButton, declineButton);
    card.append(actions);
    friendRequestList.append(card);
  });
}

function renderPlayerDirectory() {
  playerDirectory.innerHTML = "";
  const players = state.players
    .filter((player) => player.id !== currentUser().id)
    .sort((a, b) => a.username.localeCompare(b.username));

  if (!players.length) {
    playerDirectory.append(renderEmptyCard("No players yet", "Once players sign up you can send them requests."));
    return;
  }

  players.forEach((player) => {
    const card = document.createElement("article");
    card.className = "team-chip chat-list-card";
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(player.username)}</h3>
        <p>${escapeHtml(getDivisionName(player.divisionId))} division</p>
      </div>
    `;

    const status = friendStatusWith(player.id);
    const action = document.createElement("div");
    action.className = "profile-links";

    if (status === "friend") {
      const badge = document.createElement("span");
      badge.className = "chip-action chip-action-static";
      badge.textContent = "Friends";
      action.append(badge);
    } else if (status === "incoming") {
      const badge = document.createElement("span");
      badge.className = "chip-action chip-action-static";
      badge.textContent = "Sent you a request";
      action.append(badge);
    } else if (status === "outgoing") {
      const badge = document.createElement("span");
      badge.className = "chip-action chip-action-static";
      badge.textContent = "Request sent";
      action.append(badge);
    } else {
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "ghost-button";
      addButton.textContent = "Add";
      addButton.addEventListener("click", () => send("/api/chat/friend-request", { targetId: player.id }));
      action.append(addButton);
    }

    card.append(action);
    playerDirectory.append(card);
  });
}

function renderMessages() {
  const room = getRoom(activeRoomId);
  chatRoomTitle.textContent = room?.name || "Chat";
  chatRoomMeta.textContent = roomDescription(room);
  chatMessages.innerHTML = "";

  const messages = room?.messages ?? [];
  if (!messages.length) {
    chatMessages.append(renderEmptyCard("No messages yet", "Start the conversation here."));
  } else {
    messages
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .forEach((message) => {
        const card = document.createElement("article");
        card.className = `result-card chat-message-card${message.authorId === currentUser()?.id ? " is-own" : ""}`;
        const replySource = getMessageById(room, message.replyToId);
        card.innerHTML = `
          <div class="result-meta"><strong>${escapeHtml(getUsername(message.authorId))}</strong><span>${formatDateTime(message.createdAt)}${message.editedAt ? " * edited" : ""}</span></div>
          ${replySource ? `<div class="message-reply"><strong>${escapeHtml(getUsername(replySource.authorId))}</strong><p>${escapeHtml(replySource.body || "Attachment")}</p></div>` : ""}
          ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}
          <div class="chat-attachment-list">${(message.attachments || []).map(renderAttachment).join("")}</div>
        `;

        const actions = document.createElement("div");
        actions.className = "chat-message-actions";

        const replyButton = document.createElement("button");
        replyButton.className = "ghost-button chat-icon-button";
        replyButton.type = "button";
        replyButton.innerHTML = "&#8629;";
        replyButton.title = "Reply";
        replyButton.setAttribute("aria-label", "Reply to message");
        replyButton.addEventListener("click", () => startReply(message));
        actions.append(replyButton);

        if (message.authorId === currentUser()?.id || currentUser()?.isAdmin) {
          const deleteButton = document.createElement("button");
          deleteButton.className = "ghost-button chat-icon-button";
          deleteButton.type = "button";
          deleteButton.innerHTML = "&#128465;";
          deleteButton.title = "Delete";
          deleteButton.setAttribute("aria-label", "Delete message");
          deleteButton.addEventListener("click", () => deleteMessage(message));
          actions.append(deleteButton);
        }

        card.append(actions);
        chatMessages.append(card);
      });
  }

  const locked = room?.id === "announcements" && !currentUser()?.isAdmin;
  messageInput.disabled = locked;
  submitButton.disabled = locked;
  attachmentInput.disabled = locked;
  recordAudioButton.disabled = locked;
  messageInput.placeholder = locked ? "Only admins can post in announcements." : "Type a message and press Enter";
}

function renderReplyComposer() {
  const room = getRoom(activeRoomId);
  const message = getMessageById(room, replyToId);
  if (!message) {
    replyComposer.hidden = true;
    return;
  }
  replyComposer.hidden = false;
  replyLabel.textContent = `Replying to ${getUsername(message.authorId)}`;
  replyPreview.textContent = message.body || (message.attachments?.length ? "Attachment" : "Message");
}

function renderAttachmentPreview() {
  attachmentPreview.innerHTML = "";
  [...attachmentInput.files].forEach((file) => {
    const item = document.createElement("article");
    item.className = "fixture-card";
    item.innerHTML = `<strong>${escapeHtml(file.name)}</strong><p>${Math.round(file.size / 1024)} KB</p>`;
    attachmentPreview.append(item);
  });
  if (recordedAudio) {
    const item = document.createElement("article");
    item.className = "fixture-card";
    item.innerHTML = `<strong>${escapeHtml(recordedAudio.name)}</strong><p>Voice recording ready</p>`;
    attachmentPreview.append(item);
  }
}

function buildLeagueRooms() {
  const user = currentUser();
  return [
    { id: "announcements", name: "Announcements" },
    { id: "main", name: "Main Group Chat" },
    { id: `division-${user.divisionId}`, name: `${getDivisionName(user.divisionId)} Division Chat` }
  ];
}

function getRoom(roomId) {
  let room = state.chats.find((entry) => entry.id === roomId);
  if (!room && roomId.startsWith("direct:")) {
    const ids = roomId.replace("direct:", "").split("--");
    const otherId = ids.find((id) => id !== currentUser()?.id) || "";
    room = {
      id: roomId,
      name: `Chat With ${getUsername(otherId)}`,
      type: "direct",
      participantIds: ids,
      messages: []
    };
  }
  if (room && room.id.startsWith("direct:")) {
    const otherId = room.participantIds?.find((id) => id !== currentUser()?.id) || room.id.replace("direct:", "").split("--").find((id) => id !== currentUser()?.id) || "";
    room.name = `Chat With ${getUsername(otherId)}`;
  }
  return room;
}

function roomExists(roomId) {
  return Boolean(getRoom(roomId) && (roomId.startsWith("direct:") ? isFriendRoom(roomId) : true));
}

function getMessageById(room, messageId) {
  return room?.messages?.find((entry) => entry.id === messageId) ?? null;
}

function currentUser() {
  return state.players.find((player) => player.id === state.sessionUserId) ?? null;
}

function getPlayer(playerId) {
  return state.players.find((player) => player.id === playerId) ?? null;
}

function directRoomId(a, b) {
  return `direct:${[a, b].sort().join("--")}`;
}

function getFriends() {
  const user = currentUser();
  return state.friendships
    .filter((entry) => entry.userIds.includes(user.id))
    .map((entry) => entry.userIds.find((id) => id !== user.id))
    .filter(Boolean)
    .map((id) => getPlayer(id))
    .filter(Boolean)
    .sort((a, b) => a.username.localeCompare(b.username));
}

function isFriendRoom(roomId) {
  const ids = roomId.replace("direct:", "").split("--").filter(Boolean);
  if (ids.length !== 2 || !ids.includes(currentUser()?.id)) return false;
  return state.friendships.some((entry) => entry.userIds.join("--") === ids.slice().sort().join("--"));
}

function friendStatusWith(playerId) {
  if (state.friendships.some((entry) => entry.userIds.includes(currentUser().id) && entry.userIds.includes(playerId))) {
    return "friend";
  }
  if (state.friendRequests.some((entry) => entry.fromUserId === currentUser().id && entry.toUserId === playerId)) {
    return "outgoing";
  }
  if (state.friendRequests.some((entry) => entry.fromUserId === playerId && entry.toUserId === currentUser().id)) {
    return "incoming";
  }
  return "none";
}

function roomDescription(room) {
  if (!room) return "";
  if (room.id === "announcements") return "League-wide admin updates.";
  if (room.id === "main") return "All registered players can chat here.";
  if (room.id.startsWith("division-")) return "Only players in your division can view and post here.";
  return "Private chat with one of your accepted friends.";
}

function getUsername(playerId) {
  return state.players.find((player) => player.id === playerId)?.username ?? "Admin";
}

function getDivisionName(divisionId) {
  return state.divisions.find((division) => division.id === divisionId)?.name ?? "Division";
}

function startReply(message) {
  replyToId = message.id;
  renderReplyComposer();
  messageInput.focus();
}

function clearReply() {
  replyToId = "";
  replyComposer.hidden = true;
}

async function deleteMessage(message) {
  if (!window.confirm("Delete this message?")) return;
  await send("/api/chat/message/delete", { roomId: activeRoomId, messageId: message.id });
}

async function getAttachmentsPayload() {
  const files = [...attachmentInput.files];
  return Promise.all(files.map(async (file) => ({
    id: crypto.randomUUID(),
    type: inferAttachmentType(file.type),
    name: file.name,
    dataUrl: await readFileAsDataUrl(file)
  })));
}

async function toggleAudioRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    recordAudioButton.textContent = "Stop";
    mediaRecorder.addEventListener("dataavailable", (event) => chunks.push(event.data));
    mediaRecorder.addEventListener("stop", async () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
      recordedAudio = {
        id: crypto.randomUUID(),
        type: "audio",
        name: `voice-${Date.now()}.webm`,
        dataUrl: await blobToDataUrl(blob)
      };
      stream.getTracks().forEach((track) => track.stop());
      recordAudioButton.textContent = "Voice";
      renderAttachmentPreview();
    });
    mediaRecorder.start();
  } catch {
    window.alert("Microphone access is needed to record a voice message.");
  }
}

function renderAttachment(attachment) {
  if (attachment.type === "image") return `<img class="result-image" src="${attachment.dataUrl}" alt="${escapeHtml(attachment.name)}">`;
  if (attachment.type === "video") return `<video class="result-image" controls src="${attachment.dataUrl}"></video>`;
  if (attachment.type === "audio") return `<audio controls src="${attachment.dataUrl}"></audio>`;
  return `<a class="chip-action button-link" href="${attachment.dataUrl}" download="${escapeHtml(attachment.name)}">${escapeHtml(attachment.name)}</a>`;
}

function renderEmptyCard(title, body) {
  const card = document.createElement("article");
  card.className = "empty-state";
  card.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>`;
  return card;
}

function inferAttachmentType(mime) {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(dateString));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeEmoji(value) {
  const parser = new DOMParser();
  return parser.parseFromString(value, "text/html").documentElement.textContent || value;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(blob);
  });
}
