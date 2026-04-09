const sessionKey = "elite-arrows-session";
const authMessage = document.querySelector("#authMessage");
const signupForm = document.querySelector("#signupForm");
const loginForm = document.querySelector("#loginForm");
const heroMetrics = document.querySelector("#heroMetrics");

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  await send("/api/auth/signup", {
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    threeDartAverage: Number(formData.get("threeDartAverage")),
    dartCounterLink: formData.get("dartCounterLink"),
    bio: formData.get("bio"),
    isAdmin: formData.get("isAdmin") === "on"
  }, formData.get("rememberMe") === "on");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  await send("/api/auth/login", {
    email: formData.get("loginEmail"),
    password: formData.get("loginPassword")
  }, formData.get("rememberMe") === "on");
});

bootstrap();

async function bootstrap() {
  if (window.location.protocol === "file:") {
    authMessage.textContent = "Open Elite Arrows through http://localhost:3000 after running npm start.";
    return;
  }

  if (getStoredSessionId()) {
    window.location.href = "/dashboard.html";
    return;
  }

  try {
    const response = await fetch("/api/bootstrap");
    const data = await response.json();
    heroMetrics.innerHTML = `
      <div class="metric"><span>Divisions</span><strong>${data.divisions.length}</strong></div>
      <div class="metric"><span>Players</span><strong>${data.players.length}</strong></div>
      <div class="metric"><span>Pending Results</span><strong>${data.matches.filter((match) => match.status === "pending").length}</strong></div>
      <div class="metric"><span>Mode</span><strong>Welcome</strong></div>
    `;
  } catch {
    authMessage.textContent = "The app server is not responding. Run npm start, then open http://localhost:3000.";
  }
}

async function send(url, payload, rememberMe) {
  authMessage.textContent = "";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      authMessage.textContent = data.error || "Something went wrong.";
      return;
    }

    if (data.sessionUserId) {
      if (url === "/api/auth/signup" && payload.isAdmin && payload.email?.toLowerCase() !== "rhyshowe2023@outlook.com") {
        sessionStorage.setItem("elite-arrows-auth-flash", "Your admin request has been submitted. An existing admin will need to approve it before admin tools unlock.");
      }
      setStoredSessionId(data.sessionUserId, rememberMe);
      window.location.href = "/dashboard.html";
    }
  } catch {
    authMessage.textContent = "Could not reach the server. Run npm start, then reload the page.";
  }
}

function getStoredSessionId() {
  return localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || "";
}

function setStoredSessionId(value, rememberMe) {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
  if (rememberMe) {
    localStorage.setItem(sessionKey, value);
  } else {
    sessionStorage.setItem(sessionKey, value);
  }
}
