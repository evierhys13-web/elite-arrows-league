const sessionKey = "elite-arrows-session";
const themeKey = "elite-arrows-theme";

let sessionUserId = localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || "";

const themeToggle = document.querySelector("#themeToggle");
const logoutButton = document.querySelector("#logoutButton");

if (themeToggle) {
  if (document.body.classList.contains("theme-light")) {
    themeToggle.checked = true;
  }
  themeToggle.addEventListener("change", () => {
    toggleTheme();
  });
}

function toggleTheme() {
  const isDark = !document.body.classList.contains("theme-light");
  document.body.classList.toggle("theme-light", isDark);
  localStorage.setItem(themeKey, isDark ? "light" : "dark");
  if (themeToggle) {
    themeToggle.checked = isDark;
  }
}

function applyTheme(theme) {
  document.body.classList.toggle("theme-light", theme === "light");
  if (themeToggle) {
    themeToggle.checked = theme === "light";
  }
}

function signOut() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
  window.location.href = "/index.html";
}

logoutButton?.addEventListener("click", signOut);

const savedTheme = localStorage.getItem(themeKey);
if (savedTheme) {
  applyTheme(savedTheme);
}
