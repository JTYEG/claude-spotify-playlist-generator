// State machine: LOGGED_OUT → LOGGED_IN → LOADING → PREVIEW → SAVING → SUCCESS | ERROR
const State = { LOGGED_OUT: 0, LOGGED_IN: 1, LOADING: 2, PREVIEW: 3, SAVING: 4, SUCCESS: 5, ERROR: 6 };

const $ = (id) => document.getElementById(id);

const els = {
  sectionLoggedOut: $("section-logged-out"),
  sectionLoggedIn:  $("section-logged-in"),
  btnLogin:         $("btn-login"),
  btnGenerate:      $("btn-generate"),
  btnLogout:        $("btn-logout"),
  btnAnother:       $("btn-another"),
  btnMakeAnother:   $("btn-make-another"),
  btnRegenerate:    $("btn-regenerate"),
  btnSave:          $("btn-save"),
  btnRetry:         $("btn-retry"),
  btnNowPlaying:    $("btn-now-playing"),
  welcomeText:      $("welcome-text"),
  seedInput:        $("seed-input"),
  promptInput:      $("prompt-input"),
  promptError:      $("prompt-error"),
  showReasons:      $("show-reasons"),
  tokenInfo:        $("token-info"),
  songCount:        $("song-count"),
  songCountLabel:   $("song-count-label"),
  discoveryMode:    $("discovery-mode"),
  discoveryLabel:   $("discovery-label"),
  discoveryDesc:    $("discovery-desc"),
  genrePills:       $("genre-pills"),
  genreBlendHint:   $("genre-blend-hint"),
  playlistNameInput: $("playlist-name-input"),
  loadingText:      $("loading-text"),
  sectionLoading:   $("section-loading"),
  sectionPreview:   $("section-preview"),
  previewList:      $("preview-list"),
  sectionSuccess:   $("section-success"),
  sectionError:     $("section-error"),
  resultName:       $("result-name"),
  resultCount:      $("result-count"),
  resultLink:       $("result-link"),
  errorMessage:     $("error-message"),
};

const DISCOVERY_MODES = {
  1: { key: "tight_match",        label: "Similar",    desc: "Songs that sound very similar — same mood, instrumentation, and energy. Accuracy over discovery." },
  2: { key: "adjacent_discovery", label: "Explore",    desc: "Start close, then branch out into adjacent artists and scenes." },
  3: { key: "influence_trail",    label: "Influences", desc: "Trace the musical lineage — artists and songs that shaped this sound." },
  4: { key: "left_field",         label: "Surprise",   desc: "Unexpected connections that still make musical sense. Anything goes." },
};

let lastPrompt = "";
let currentSongs = [];
let currentUris = [];
let selectedGenreTags = [];   // max 2
let genreDebounceTimer = null;

function setState(state, payload = {}) {
  els.sectionLoggedOut.classList.add("hidden");
  els.sectionLoggedIn.classList.add("hidden");
  els.sectionLoading.classList.add("hidden");
  els.sectionPreview.classList.add("hidden");
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
    els.loadingText.textContent = payload.message || "Claude is picking songs\u2026";
    els.btnGenerate.disabled = true;
  }

  if (state === State.PREVIEW) {
    els.sectionLoggedIn.classList.remove("hidden");
    els.sectionPreview.classList.remove("hidden");
    els.previewList.innerHTML = "";
    (payload.songs || []).forEach(song => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="song-title">${song.title}</span><span class="song-artist">${song.artist}</span>${song.reason ? `<span class="song-reason">${song.reason}</span>` : ""}`;
      els.previewList.appendChild(li);
    });
  }

  if (state === State.SUCCESS) {
    els.sectionLoggedIn.classList.remove("hidden");
    els.sectionSuccess.classList.remove("hidden");
    els.resultName.textContent = payload.playlistName || "";
    const count = payload.tracksFound || 0;
    els.resultCount.textContent = `${count} tracks added`;
    els.resultLink.href = payload.playlistUrl || "#";
  }

  if (state === State.ERROR) {
    els.sectionLoggedIn.classList.remove("hidden");
    els.sectionError.classList.remove("hidden");
    els.errorMessage.textContent = payload.message || "Something went wrong. Please try again.";
  }
}

// ---------------------------------------------------------------------------
// Core actions
// ---------------------------------------------------------------------------

async function fetchSongs(prompt) {
  setState(State.LOADING, { message: "Claude is picking songs and checking Spotify\u2026" });
  const song_count = parseInt(els.songCount.value, 10);
  const mode = DISCOVERY_MODES[els.discoveryMode.value]?.key ?? "adjacent_discovery";
  const seed = selectedGenreTags.length > 0 ? "" : els.seedInput.value.trim();
  try {
    const resp = await fetch("/api/get-songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, seed, song_count, mode, show_reasons: els.showReasons.checked, genre_tags: selectedGenreTags }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = Array.isArray(data.detail)
        ? data.detail.map(e => e.msg).join(", ")
        : (data.detail || `Error ${resp.status}`);
      setState(State.ERROR, { message: msg });
      return;
    }
    currentSongs = data.songs;
    currentUris = data.songs.map(s => s.uri);
    if (data.debug && els.tokenInfo) {
      const d = data.debug;
      els.tokenInfo.textContent = `↑ ${d.input_tokens} in  ↓ ${d.output_tokens} out  (${d.total_tokens} total)`;
      els.tokenInfo.classList.remove("hidden");
    }
    setState(State.PREVIEW, { songs: currentSongs });
  } catch {
    setState(State.ERROR, { message: "Network error — please check your connection and try again." });
  }
}

async function savePlaylist() {
  setState(State.LOADING, { message: "Saving to Spotify\u2026" });
  const nameSuffix = els.playlistNameInput.value.trim();
  const playlist_name = nameSuffix ? `AI Mix: ${nameSuffix}` : `AI Mix: ${lastPrompt.slice(0, 50)}`;
  try {
    const resp = await fetch("/api/save-playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: currentUris, playlist_name }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = Array.isArray(data.detail)
        ? data.detail.map(e => e.msg).join(", ")
        : (data.detail || `Error ${resp.status}`);
      setState(State.ERROR, { message: msg });
      return;
    }
    setState(State.SUCCESS, {
      playlistName: data.playlist_name,
      playlistUrl: data.playlist_url,
      tracksFound: data.tracks_found,
    });
  } catch {
    setState(State.ERROR, { message: "Network error — please check your connection and try again." });
  }
}

// ---------------------------------------------------------------------------
// Genre pills
// ---------------------------------------------------------------------------

function renderGenrePills(tags) {
  els.genrePills.innerHTML = "";
  if (!tags || tags.length === 0) {
    els.genrePills.classList.add("hidden");
    els.genreBlendHint.classList.add("hidden");
    return;
  }
  tags.forEach(tag => {
    const pill = document.createElement("button");
    const isActive = selectedGenreTags.includes(tag);
    pill.className = "genre-pill" + (isActive ? " active" : "");
    pill.textContent = tag;
    pill.addEventListener("click", () => {
      if (selectedGenreTags.includes(tag)) {
        // deselect
        selectedGenreTags = selectedGenreTags.filter(t => t !== tag);
      } else if (selectedGenreTags.length < 2) {
        selectedGenreTags = [...selectedGenreTags, tag];
      } else {
        // replace oldest (first) selection
        selectedGenreTags = [selectedGenreTags[1], tag];
      }
      renderGenrePills(tags);
    });
    els.genrePills.appendChild(pill);
  });
  els.genrePills.classList.remove("hidden");
  // Show blend hint when 2 selected
  if (selectedGenreTags.length === 2) {
    els.genreBlendHint.textContent = `Blending: ${selectedGenreTags[0]} + ${selectedGenreTags[1]}`;
    els.genreBlendHint.classList.remove("hidden");
  } else {
    els.genreBlendHint.classList.add("hidden");
  }
}

function clearGenrePills() {
  selectedGenreTags = [];
  els.genrePills.innerHTML = "";
  els.genrePills.classList.add("hidden");
  els.genreBlendHint.classList.add("hidden");
}

async function fetchGenreTags(artistName) {
  if (!artistName || artistName.length < 2) {
    clearGenrePills();
    return;
  }
  try {
    const resp = await fetch(`/api/tags?artist=${encodeURIComponent(artistName)}`);
    const data = await resp.json();
    // remove any active selections no longer in new tag list
    selectedGenreTags = selectedGenreTags.filter(t => (data.tags || []).includes(t));
    renderGenrePills(data.tags || []);
  } catch {
    clearGenrePills();
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

els.showReasons.addEventListener("change", () => {
  const status = document.getElementById("reasons-status");
  status.textContent = els.showReasons.checked ? "ON" : "OFF";
  status.style.color = els.showReasons.checked ? "var(--green)" : "var(--error)";
});

els.btnLogin.addEventListener("click", () => { window.location.href = "/auth/login"; });
els.btnLogout.addEventListener("click", () => { window.location.href = "/auth/logout"; });

els.btnNowPlaying.addEventListener("click", async () => {
  els.btnNowPlaying.textContent = "\u25B6 Loading\u2026";
  els.btnNowPlaying.disabled = true;
  try {
    const resp = await fetch("/api/now-playing");
    const data = await resp.json();
    if (data.playing) {
      els.seedInput.value = `${data.artist} - ${data.track}`;
      // trigger tag fetch for the artist
      clearTimeout(genreDebounceTimer);
      fetchGenreTags(data.artist);
    } else {
      els.btnNowPlaying.textContent = "\u25B6 Nothing playing";
      setTimeout(() => {
        els.btnNowPlaying.textContent = "\u25B6 Now playing";
        els.btnNowPlaying.disabled = false;
      }, 2000);
      return;
    }
  } catch {
    // silently ignore
  }
  els.btnNowPlaying.textContent = "\u25B6 Now playing";
  els.btnNowPlaying.disabled = false;
});

els.songCount.addEventListener("input", () => {
  els.songCountLabel.textContent = els.songCount.value;
});

els.seedInput.addEventListener("input", () => {
  clearTimeout(genreDebounceTimer);
  const val = els.seedInput.value.trim();
  // Extract artist name (before " - " or "+")
  const artistPart = val.split(/\s*[-+]\s*/)[0].trim();
  if (!artistPart) {
    clearGenrePills();
    return;
  }
  genreDebounceTimer = setTimeout(() => fetchGenreTags(artistPart), 700);
});

els.discoveryMode.addEventListener("input", () => {
  const m = DISCOVERY_MODES[els.discoveryMode.value];
  els.discoveryLabel.textContent = m.label;
  els.discoveryDesc.textContent = m.desc;
});

els.btnGenerate.addEventListener("click", () => {
  const seed = els.seedInput.value.trim();
  const prompt = els.promptInput.value.trim();
  if (!seed && !prompt && selectedGenreTags.length === 0) {
    els.promptError.classList.remove("hidden");
    els.seedInput.focus();
    return;
  }
  els.promptError.classList.add("hidden");
  lastPrompt = prompt || selectedGenreTags.join(" + ") || seed;
  fetchSongs(prompt);
});

els.btnSave.addEventListener("click", () => savePlaylist());

els.btnRegenerate.addEventListener("click", () => {
  if (lastPrompt) fetchSongs(lastPrompt);
});

els.btnAnother.addEventListener("click", () => {
  els.seedInput.value = "";
  els.promptInput.value = "";
  currentSongs = [];
  currentUris = [];
  clearGenrePills();
  setState(State.LOGGED_IN);
  els.seedInput.focus();
});

els.btnMakeAnother.addEventListener("click", () => {
  els.seedInput.value = "";
  els.promptInput.value = "";
  currentSongs = [];
  currentUris = [];
  clearGenrePills();
  setState(State.LOGGED_IN);
  els.seedInput.focus();
});

els.btnRetry.addEventListener("click", () => setState(State.LOGGED_IN));

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
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
        const errEl = document.createElement("p");
        errEl.style.cssText = "color:#e74c3c;margin-top:1rem;font-size:.9rem;";
        errEl.textContent = `Login error: ${oauthError}`;
        $("section-logged-out").appendChild(errEl);
      }
    }
  } catch {
    setState(State.LOGGED_OUT);
  }
}

init();
