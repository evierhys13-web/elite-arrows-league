const sessionKey = "elite-arrows-session";

let state = {
  divisions: [],
  players: [],
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
const chatMessages = document.querySelector("#chatMessages");
const chatRoomTitle = document.querySelector("#chatRoomTitle");
const chatRoomMeta = document.querySelector("#chatRoomMeta");
const chatForm = document.querySelector("#chatForm");
const replyBanner = document.querySelector("#replyBanner");
const replyLabel = document.querySelector("#replyLabel");
const replyPreview = document.querySelector("#replyPreview");
const clearReplyButton = document.querySelector("#clearReplyButton");
const attachmentInput = document.querySelector("#chatAttachments");
const attachmentPreview = document.querySelector("#attachmentPreview");
const recordAudioButton = document.querySelector("#recordAudioButton");
const messageInput = chatForm.querySelector("textarea");
const emojiButtons = [...document.querySelectorAll(".emoji-button")];

chatForm.addEventListener("submit", submitMessage);
clearReplyButton.addEventListener("click", clearReply);
attachmentInput.addEventListener("change", renderAttachmentPreview);
recordAudioButton.addEventListener("click", toggleAudioRecording);
emojiButtons.forEach((button) => button.addEventListener("click", () => {
  messageInput.value += `${button.dataset.emoji} `;
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
  if (!roomExists(activeRoomId)) activeRoomId = "main";
  render();
}

async function submitMessage(event) {
  event.preventDefault();
  const formData = new FormData(chatForm);
  const attachments = await getAttachmentsPayload();
  if (recordedAudio) attachments.push(recordedAudio);
  await send("/api/chat/message", {
    roomId: activeRoomId,
    message: formData.get("message"),
    replyToId,
    attachments
  });
  chatForm.reset();
  recordedAudio = null;
  clearReply();
  renderAttachmentPreview();
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
  renderRooms();
  renderMessages();
  renderReplyBanner();
}

function renderRooms() {
  chatRoomList.innerHTML = "";
  buildRooms().forEach((room) => {
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

function renderMessages() {
  const room = getRoom(activeRoomId);
  chatRoomTitle.textContent = room?.name || "Chat";
  chatRoomMeta.textContent = roomDescription(room);
  chatMessages.innerHTML = "";

  const messages = room?.messages ?? [];
  if (!messages.length) {
    const empty = document.createElement("article");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>No messages yet</strong><p>Start the conversation here.</p>";
    chatMessages.append(empty);
  } else {
    messages.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach((message) => {
      const card = document.createElement("article");
      card.className = "result-card";
      const replySource = getMessageById(room, message.replyToId);
      card.innerHTML = `
        <div class="result-meta"><strong>${getUsername(message.authorId)}</strong><span>${formatDateTime(message.createdAt)}${message.editedAt ? " • edited" : ""}</span></div>
        ${replySource ? `<div class="message-reply"><strong>Replying to ${getUsername(replySource.authorId)}</strong><p>${escapeHtml(replySource.body || "Attachment")}</p></div>` : ""}
        <p>${escapeHtml(message.body || "").replace(/\n/g, "<br>")}</p>
        <div class="chat-attachment-list">${(message.attachments || []).map(renderAttachment).join("")}</div>
      `;
      const actions = document.createElement("div");
      actions.className = "topbar-actions section-gap";
      const replyButton = document.createElement("button");
      replyButton.className = "ghost-button";
      replyButton.type = "button";
      replyButton.textContent = "Reply";
      replyButton.addEventListener("click", () => startReply(message));
      actions.append(replyButton);
      if (message.authorId === currentUser()?.id || currentUser()?.isAdmin) {
        const editButton = document.createElement("button");
        editButton.className = "ghost-button";
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => editMessage(message));
        const deleteButton = document.createElement("button");
        deleteButton.className = "ghost-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteMessage(message));
        actions.append(editButton, deleteButton);
      }
      card.append(actions);
      chatMessages.append(card);
    });
  }

  const locked = room?.id === "announcements" && !currentUser()?.isAdmin;
  messageInput.disabled = locked;
  chatForm.querySelector("button.primary-button").disabled = locked;
  attachmentInput.disabled = locked;
  recordAudioButton.disabled = locked;
  messageInput.placeholder = locked ? "Only admins can post in announcements." : "Write your message...";
}

function renderReplyBanner() {
  const room = getRoom(activeRoomId);
  const message = getMessageById(room, replyToId);
  if (!message) {
    replyBanner.hidden = true;
    return;
  }
  replyBanner.hidden = false;
  replyLabel.textContent = `Replying to ${getUsername(message.authorId)}`;
  replyPreview.textContent = message.body || (message.attachments?.length ? "Attachment" : "Message");
}

function renderAttachmentPreview() {
  attachmentPreview.innerHTML = "";
  [...attachmentInput.files].forEach((file) => {
    const item = document.createElement("article");
    item.className = "fixture-card";
    item.innerHTML = `<strong>${file.name}</strong><p>${Math.round(file.size / 1024)} KB</p>`;
    attachmentPreview.append(item);
  });
  if (recordedAudio) {
    const item = document.createElement("article");
    item.className = "fixture-card";
    item.innerHTML = `<strong>${recordedAudio.name}</strong><p>Voice recording ready</p>`;
    attachmentPreview.append(item);
  }
}

function buildRooms() {
  const user = currentUser();
  const directRooms = state.players
    .filter((player) => player.id !== user.id)
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((player) => ({ id: directRoomId(user.id, player.id), name: `Chat With ${player.username}` }));

  return [
    { id: "announcements", name: "Announcements" },
    { id: "main", name: "Main Group Chat" },
    { id: `division-${user.divisionId}`, name: `${getDivisionName(user.divisionId)} Division Chat` },
    ...directRooms
  ];
}

function getRoom(roomId) {
  let room = state.chats.find((entry) => entry.id === roomId);
  if (!room && roomId.startsWith("direct:")) {
    const ids = roomId.replace("direct:", "").split("--");
    room = { id: roomId, name: `Chat With ${getUsername(ids.find((id) => id !== currentUser().id) || "")}`, type: "direct", messages: [] };
  }
  return room;
}

function roomExists(roomId) {
  return Boolean(getRoom(roomId));
}

function getMessageById(room, messageId) {
  return room?.messages?.find((entry) => entry.id === messageId) ?? null;
}

function currentUser() {
  return state.players.find((player) => player.id === state.sessionUserId) ?? null;
}

function directRoomId(a, b) {
  return `direct:${[a, b].sort().join("--")}`;
}

function roomDescription(room) {
  if (!room) return "";
  if (room.id === "announcements") return "League-wide admin updates.";
  if (room.id === "main") return "All registered players can chat here.";
  if (room.id.startsWith("division-")) return "Only players in your division can view and post here.";
  return "Private player-to-player chat for arranging games.";
}

function getUsername(playerId) {
  return state.players.find((player) => player.id === playerId)?.username ?? "Admin";
}

function getDivisionName(divisionId) {
  return state.divisions.find((division) => division.id === divisionId)?.name ?? "Division";
}

function startReply(message) {
  replyToId = message.id;
  renderReplyBanner();
  messageInput.focus();
}

function clearReply() {
  replyToId = "";
  replyBanner.hidden = true;
}

async function editMessage(message) {
  const nextBody = window.prompt("Edit message", message.body || "");
  if (nextBody === null) return;
  await send("/api/chat/message/edit", { roomId: activeRoomId, messageId: message.id, message: nextBody });
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
    recordAudioButton.textContent = "Stop Recording";
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
      recordAudioButton.textContent = "Record Voice";
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
