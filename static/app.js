// State machine: LOGGED_OUT → LOGGED_IN → LOADING → SUCCESS | ERROR
const State = { LOGGED_OUT: 0, LOGGED_IN: 1, LOADING: 2, SUCCESS: 3, ERROR: 4 };

const $ = (id) => document.getElementById(id);

const els = {
  sectionLoggedOut: $("section-logged-out"),
  sectionLoggedIn:  $("section-logged-in"),
  btnLogin:         $("btn-login"),
  btnGenerate:      $("btn-generate"),
  btnLogout:        $("btn-logout"),
  btnAnother:       $("btn-another"),
  btnRetry:         $("btn-retry"),
  welcomeText:      $("welcome-text"),
  promptInput:      $("prompt-input"),
  promptError:      $("prompt-error"),
  sectionLoading:   $("section-loading"),
  sectionSuccess:   $("section-success"),
  sectionError:     $("section-error"),
  resultName:       $("result-name"),
  resultCount:      $("result-count"),
  resultLink:       $("result-link"),
  errorMessage:     $("error-message"),
};

function setState(state, payload = {}) {
  // Reset all dynamic sections
  els.sectionLoggedOut.classList.add("hidden");
  els.sectionLoggedIn.classList.add("hidden");
  els.sectionLoading.classList.add("hidden");
  els.sectionSuccess.classList.add("hidden");
  els.sectionError.classList.add("hidden");
  els.promptError.classList.add("hidden");
  els.btnGenerate.disabled = false;

  if (state === State.LOGGED_OUT) {
    els.sectionLoggedOut.classList.remove("hidden");
  }

  if (state === State.LOGGED_IN) {
    els.sectionLoggedIn.classList.remove("hidden");
    if (payload.displayName) {
      els.welcomeText.textContent = `Logged in as ${payload.displayName}`;
    }
  }

  if (state === State.LOADING) {
    els.sectionLoggedIn.classList.remove("hidden");
    els.sectionLoading.classList.remove("hidden");
    els.btnGenerate.disabled = true;
  }

  if (state === State.SUCCESS) {
    els.sectionLoggedIn.classList.remove("hidden");
    els.sectionSuccess.classList.remove("hidden");
    els.resultName.textContent = payload.playlistName || "";
    const count = payload.tracksFound || 0;
    const skipped = (payload.tracksNotFound || []).length;
    els.resultCount.textContent = skipped > 0
      ? `${count} tracks added (${skipped} not found on Spotify)`
      : `${count} tracks added`;
    els.resultLink.href = payload.playlistUrl || "#";
  }

  if (state === State.ERROR) {
    els.sectionLoggedIn.classList.remove("hidden");
    els.sectionError.classList.remove("hidden");
    els.errorMessage.textContent = payload.message || "Something went wrong. Please try again.";
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

els.btnLogin.addEventListener("click", () => {
  window.location.href = "/auth/login";
});

els.btnLogout.addEventListener("click", () => {
  window.location.href = "/auth/logout";
});

els.btnGenerate.addEventListener("click", async () => {
  const prompt = els.promptInput.value.trim();
  if (!prompt) {
    els.promptError.classList.remove("hidden");
    els.promptInput.focus();
    return;
  }
  els.promptError.classList.add("hidden");

  setState(State.LOADING);

  try {
    const resp = await fetch("/api/generate-playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      setState(State.ERROR, { message: data.detail || `Error ${resp.status}` });
      return;
    }

    setState(State.SUCCESS, {
      playlistName: data.playlist_name,
      playlistUrl: data.playlist_url,
      tracksFound: data.tracks_found,
      tracksNotFound: data.tracks_not_found,
    });
  } catch (err) {
    setState(State.ERROR, { message: "Network error — please check your connection and try again." });
  }
});

els.btnAnother.addEventListener("click", () => {
  els.promptInput.value = "";
  setState(State.LOGGED_IN);
  els.promptInput.focus();
});

els.btnRetry.addEventListener("click", () => {
  setState(State.LOGGED_IN);
});

// ---------------------------------------------------------------------------
// Init: check login status
// ---------------------------------------------------------------------------

async function init() {
  // Show login error from OAuth redirect if present
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error");

  try {
    const resp = await fetch("/auth/status");
    const data = await resp.json();

    if (data.logged_in) {
      setState(State.LOGGED_IN, { displayName: data.display_name });
      if (oauthError) {
        setState(State.ERROR, { message: `Spotify login failed: ${oauthError}` });
      }
    } else {
      setState(State.LOGGED_OUT);
      if (oauthError) {
        // Show error below the login button
        const errEl = document.createElement("p");
        errEl.style.cssText = "color:#e74c3c;margin-top:1rem;font-size:.9rem;";
        errEl.textContent = `Login error: ${oauthError}`;
        document.getElementById("section-logged-out").appendChild(errEl);
      }
    }
  } catch {
    setState(State.LOGGED_OUT);
  }
}

init();
