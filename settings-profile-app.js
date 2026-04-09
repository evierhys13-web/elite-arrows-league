const sessionKey = "elite-arrows-session";
const themeKey = "elite-arrows-theme";

let state = {
  players: [],
  siteSettings: {},
  sessionUserId: localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || ""
};

let currentProfilePicture = "";

const profileForm = document.querySelector("#profileForm");
const profileAvatarImg = document.querySelector("#profileAvatarImg");
const profileAvatarInitial = document.querySelector("#profileAvatarInitial");
const profilePictureInput = document.querySelector("#profilePictureInput");
const logoutButton = document.querySelector("#logoutButton");

function currentUser() {
  return state.players.find((p) => p.id === state.sessionUserId);
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

function formatAverage(value) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toFixed(1);
}

async function fetchState() {
  try {
    const response = await fetch("/api/state");
    if (response.ok) {
      const data = await response.json();
      state = data;
      renderProfile();
    } else {
      window.location.href = "/index.html";
    }
  } catch {
    window.location.href = "/index.html";
  }
}

function updateProfileAvatar() {
  const img = currentProfilePicture;
  const user = currentUser();
  const initial = user?.username?.charAt(0).toUpperCase() || "?";
  
  if (profileAvatarImg) {
    if (img) {
      profileAvatarImg.src = img;
      profileAvatarImg.style.display = "block";
      profileAvatarInitial.style.display = "none";
    } else {
      profileAvatarImg.style.display = "none";
      profileAvatarInitial.textContent = initial;
      profileAvatarInitial.style.display = "flex";
    }
  }
}

function renderProfile() {
  const user = currentUser();
  if (!user) {
    window.location.href = "/index.html";
    return;
  }
  
  currentProfilePicture = user.profilePicture || "";
  updateProfileAvatar();
  
  profileForm.elements.profileUsername.value = user.username || "";
  profileForm.elements.profileBio.value = user.bio || "";
  profileForm.elements.profileDartCounterLink.value = user.dartCounterLink || "";
  profileForm.elements.profileThreeDartAverage.value = user.threeDartAverage ?? "";
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
      return null;
    }
    state = data;
    return data;
  } catch {
    window.alert("Could not reach the server.");
    return null;
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const formData = new FormData(profileForm);
  const result = await send("/api/profile", {
    username: formData.get("profileUsername"),
    bio: formData.get("profileBio"),
    dartCounterLink: formData.get("profileDartCounterLink"),
    threeDartAverage: parseOptionalNumber(formData.get("profileThreeDartAverage")),
    profilePicture: currentProfilePicture
  });
  if (result) {
    window.alert("Profile updated successfully!");
  }
}

async function handleProfilePictureUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target?.result;
    if (typeof dataUrl === "string") {
      currentProfilePicture = dataUrl;
      updateProfileAvatar();
    }
  };
  reader.readAsDataURL(file);
}

function signOut() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
  window.location.href = "/index.html";
}

function applyTheme(theme) {
  document.body.classList.toggle("theme-light", theme === "light");
}

profileForm?.addEventListener("submit", saveProfile);
profilePictureInput?.addEventListener("change", handleProfilePictureUpload);
logoutButton?.addEventListener("click", signOut);

const savedTheme = localStorage.getItem(themeKey);
if (savedTheme) {
  applyTheme(savedTheme);
}

fetchState();
