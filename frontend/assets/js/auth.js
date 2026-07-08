function renderLanding() {
  app.innerHTML = `
    <section class="landing">
      <div class="landing-shell">
        <div class="brand-row"><div class="logo-mark">LR</div><h1>LogiRoute</h1></div>
        <p class="muted">One logistics platform with role-based login for owners and customers.</p>
        <div class="portal-cards">
          <button class="portal-card" onclick="openLogin('owner')">
            <div><div class="portal-icon">Owner</div><h2>I am a Business Owner</h2><p>Add trucks, assign drivers, plan routes, monitor incidents, and manage packages.</p></div>
            <strong>Login as Owner</strong>
          </button>
          <button class="portal-card" onclick="openLogin('customer')">
            <div><div class="portal-icon">Track</div><h2>I am a Customer</h2><p>Track a package, receive notifications, update instructions, and view order history.</p></div>
            <strong>Login as Customer</strong>
          </button>
        </div>
      </div>
    </section>`;
}

function renderLogin() {
  const isOwner = state.loginRole === "owner";
  app.innerHTML = `
    <section class="auth-shell">
      <div class="auth-card">
        <aside class="auth-side">
          <div>
            <div class="brand-row" style="justify-content:flex-start;margin-bottom:0"><div class="logo-mark">LR</div><h1 style="font-size:28px">LogiRoute</h1></div>
            <h1>${isOwner ? "Owner portal access" : "Customer portal access"}</h1>
            <p>${isOwner ? "Create an owner account or sign in to manage trucks, routes, packages, and incidents." : "Create an account or sign in to track packages and manage delivery preferences."}</p>
          </div>
          <p>${isOwner ? "Demo: owner@logiroute.in / owner123" : "Demo: customer@logiroute.in / track123"}</p>
        </aside>
        ${state.authScreen === "signup" ? `
          <form class="auth-form" onsubmit="submitSignup(event)">
            <div>
              <h2>Create ${isOwner ? "Owner" : "Customer"} Account</h2>
              <p>Sign up with email + password (stored in backend).</p>
            </div>
            <div class="auth-tabs">
              <button type="button" class="${state.authScreen === "login" ? "active" : ""}" onclick="setAuthScreen('login')">Login</button>
              <button type="button" class="${state.authScreen === "signup" ? "active" : ""}" onclick="setAuthScreen('signup')">Sign up</button>
            </div>
            <label class="field">Name<input id="signupName" autocomplete="name" placeholder="Your name"></label>
            <label class="field">Email ID<input id="signupEmail" type="email" autocomplete="email" required placeholder="${isOwner ? "owner@company.com" : "customer@email.com"}"></label>
            <label class="field">Password<input id="signupPassword" type="password" autocomplete="new-password" required placeholder="At least 4 characters"></label>
            <label class="field">Confirm Password<input id="signupPassword2" type="password" autocomplete="new-password" required placeholder="Repeat password"></label>
            ${state.authError ? `<div class="pill red" style="width:100%;justify-content:flex-start">${state.authError}</div>` : ""}
            <button class="btn primary" style="width:100%;padding:13px">Create Account</button>
            <button type="button" class="btn" onclick="routeTo('landing')" style="width:100%">Back</button>
          </form>
        ` : `
          <form class="auth-form" onsubmit="submitLogin(event)">
            <div>
              <h2>${isOwner ? "Sign in to Owner Portal" : "Sign in to Customer Portal"}</h2>
              <p>Login with email + password (validated from backend).</p>
            </div>
            <div class="auth-tabs">
              <button type="button" class="${state.authScreen === "login" ? "active" : ""}" onclick="setAuthScreen('login')">Login</button>
              <button type="button" class="${state.authScreen === "signup" ? "active" : ""}" onclick="setAuthScreen('signup')">Sign up</button>
            </div>
            <label class="field">Email ID<input id="loginEmail" type="email" autocomplete="email" required value="${isOwner ? "owner@logiroute.in" : "customer@logiroute.in"}"></label>
            <label class="field">Password<input id="loginPassword" type="password" autocomplete="current-password" required value="${isOwner ? "owner123" : "track123"}"></label>
            ${state.authError ? `<div class="pill red" style="width:100%;justify-content:flex-start">${state.authError}</div>` : ""}
            <button class="btn primary" style="width:100%;padding:13px">${isOwner ? "Continue to Owner Portal" : "Continue to Customer Portal"}</button>
            <button type="button" class="btn" onclick="routeTo('landing')" style="width:100%">Back</button>
          </form>
        `}
      </div>
    </section>`;
}

function setAuthScreen(screen) {
  state.authScreen = screen === "signup" ? "signup" : "login";
  state.authError = "";
  render();
}

async function authRequest(path, payload) {
  const url = typeof resolveApiUrl === "function" ? resolveApiUrl(path) : path;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Auth failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function persistSession(session) {
  try {
    localStorage.setItem("lrSession", JSON.stringify(session));
  } catch {
    // ignore
  }
}

function clearSession() {
  try {
    localStorage.removeItem("lrSession");
  } catch {
    // ignore
  }
}

async function submitLogin(event) {
  event.preventDefault();
  const isOwner = state.loginRole === "owner";
  state.authError = "";

  const id = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const data = await authRequest("/api/auth/login", { role: state.loginRole, id, password });
    state.activeUser = { ...data.user, token: data.token };
    persistSession({ user: state.activeUser });
    if (typeof refreshFromBackend === "function") {
      try { await refreshFromBackend(); } catch { /* ignore */ }
    }
    routeTo(isOwner ? "owner" : "customerHome", "Dashboard");
  } catch (e) {
    state.authError = e?.message || "Login failed";
    render();
  }
}

async function submitSignup(event) {
  event.preventDefault();
  const isOwner = state.loginRole === "owner";
  state.authError = "";

  const name = document.getElementById("signupName").value.trim();
  const id = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const password2 = document.getElementById("signupPassword2").value;

  if (password !== password2) {
    state.authError = "Passwords do not match.";
    render();
    return;
  }

  try {
    const data = await authRequest("/api/auth/signup", { role: state.loginRole, id, password, name });
    state.activeUser = { ...data.user, token: data.token };
    persistSession({ user: state.activeUser });
    if (typeof refreshFromBackend === "function") {
      try { await refreshFromBackend(); } catch { /* ignore */ }
    }
    routeTo(isOwner ? "owner" : "customerHome", "Dashboard");
  } catch (e) {
    state.authError = e?.message || "Signup failed";
    render();
  }
}

function logout() {
  state.activeUser = null;
  clearSession();
  routeTo("landing");
}

