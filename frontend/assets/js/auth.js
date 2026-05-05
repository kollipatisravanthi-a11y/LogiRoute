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
            <h1>${isOwner ? "Owner operations login" : "Customer delivery login"}</h1>
            <p>${isOwner ? "Sign in to add vehicles, drivers, route plans, packages, and incident actions." : "Sign in with email or mobile number so delivery notifications go to the right customer."}</p>
          </div>
          <p>${isOwner ? "Demo: owner@logiroute.in / owner123" : "Demo: customer@logiroute.in / track123"}<br>OTP demo code: 123456</p>
        </aside>
        <form class="auth-form" onsubmit="submitLogin(event)">
          <div>
            <h2>${isOwner ? "Sign in to Owner Portal" : "Sign in to Customer Portal"}</h2>
            <p>${isOwner ? "Owner access is permission based." : "Customer access supports email, password, mobile OTP, and notification consent."}</p>
          </div>
          <div class="auth-tabs">
            <button type="button" class="${state.authMode === "password" ? "active" : ""}" onclick="setAuthMode('password')">Password</button>
            <button type="button" class="${state.authMode === "emailOtp" ? "active" : ""}" onclick="setAuthMode('emailOtp')">Email OTP</button>
            <button type="button" class="${state.authMode === "mobileOtp" ? "active" : ""}" onclick="setAuthMode('mobileOtp')">Mobile OTP</button>
          </div>
          ${state.authMode === "password" ? `
            <label class="field">Email ID<input id="loginEmail" type="email" required value="${isOwner ? "owner@logiroute.in" : "customer@logiroute.in"}"></label>
            <label class="field">Password<input id="loginPassword" type="password" required value="${isOwner ? "owner123" : "track123"}"></label>
          ` : state.authMode === "emailOtp" ? `
            <label class="field">Email ID<input id="loginEmailOtp" type="email" required value="${isOwner ? "owner@logiroute.in" : "customer@logiroute.in"}"></label>
            <label class="field">Email OTP<input id="loginEmailOtpCode" inputmode="numeric" required value="123456"></label>
          ` : `
            <label class="field">Mobile Number<input id="loginMobile" inputmode="numeric" required value="${isOwner ? "9876501111" : "9876502222"}"></label>
            <label class="field">OTP<input id="loginOtp" inputmode="numeric" required value="123456"></label>
          `}
          <div class="permission-box">
            <b>Permissions and consent</b>
            <label class="check-row"><input id="permNotify" type="checkbox" required checked><span>Allow LogiRoute to send updates to the registered email or mobile number.</span></label>
            <label class="check-row"><input id="permTracking" type="checkbox" required checked><span>${isOwner ? "Allow fleet GPS and route monitoring for company vehicles." : "Allow package tracking and ETA updates for orders linked to this account."}</span></label>
            <label class="check-row"><input id="permPolicy" type="checkbox" required checked><span>I agree to role-based access and privacy controls.</span></label>
          </div>
          ${state.authError ? `<div class="pill red" style="width:100%;justify-content:flex-start">${state.authError}</div>` : ""}
          <button class="btn primary" style="width:100%;padding:13px">${isOwner ? "Continue to Owner Portal" : "Continue to Customer Portal"}</button>
          <button type="button" class="btn" onclick="routeTo('landing')" style="width:100%">Back</button>
        </form>
      </div>
    </section>`;
}

function setAuthMode(mode) {
  state.authMode = mode;
  state.authError = "";
  render();
}

function submitLogin(event) {
  event.preventDefault();
  const isOwner = state.loginRole === "owner";
  let id = "";
  if (state.authMode === "password") {
    id = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const okOwner = isOwner && id === "owner@logiroute.in" && password === "owner123";
    const okCustomer = !isOwner && id === "customer@logiroute.in" && password === "track123";
    if (!okOwner && !okCustomer) {
      state.authError = "Use the demo credentials shown on the left side.";
      render();
      return;
    }
  } else if (state.authMode === "emailOtp") {
    id = document.getElementById("loginEmailOtp").value.trim();
    const otp = document.getElementById("loginEmailOtpCode").value.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    if (!emailOk || otp !== "123456") {
      state.authError = "Enter a valid email and OTP 123456.";
      render();
      return;
    }
  } else {
    id = document.getElementById("loginMobile").value.trim();
    const otp = document.getElementById("loginOtp").value.trim();
    if (!/^[0-9]{10}$/.test(id) || otp !== "123456") {
      state.authError = "Enter a 10 digit mobile number and OTP 123456.";
      render();
      return;
    }
  }
  state.activeUser = {
    role: state.loginRole,
    id,
    permissions: {
      notifications: document.getElementById("permNotify").checked,
      tracking: document.getElementById("permTracking").checked,
      policy: document.getElementById("permPolicy").checked
    }
  };
  routeTo(isOwner ? "owner" : "customerHome", "Dashboard");
}

function logout() {
  state.activeUser = null;
  routeTo("landing");
}

