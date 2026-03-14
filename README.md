# Spotify AI Playlist Generator

Generate Spotify playlists from natural language prompts using Claude AI. Describe a mood, artist, vibe, or any musical idea — Claude picks the songs, Spotify builds the playlist.

## What it does

1. You type a prompt (e.g. *"songs like Radiohead's OK Computer"* or *"late night driving, melancholic indie"*)
2. Claude AI selects songs that genuinely match the sound and feel you described
3. The app searches Spotify to verify each track exists
4. You preview the list, name the playlist, and save it directly to your Spotify account

## Tech stack

- **Backend** — Python, [FastAPI](https://fastapi.tiangolo.com/), [httpx](https://www.python-httpx.org/)
- **AI** — [Anthropic Claude](https://www.anthropic.com/) (`claude-sonnet-4-6`) for song recommendations
- **Auth** — Spotify OAuth 2.0, signed session cookies (no database required)
- **Frontend** — Vanilla HTML/CSS/JS (no framework)

## Prerequisites

- Python 3.11+
- A [Spotify Developer](https://developer.spotify.com/dashboard) account and app
- An [Anthropic API](https://console.anthropic.com/) key

## Local setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/JTYEG/spotify-ai-playlist.git
   cd spotify-ai-playlist
   ```

2. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in your keys:

   ```bash
   cp .env.example .env
   ```

   | Variable | Where to get it |
   |---|---|
   | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) |
   | `SPOTIFY_CLIENT_ID` | Spotify Developer Dashboard |
   | `SPOTIFY_CLIENT_SECRET` | Spotify Developer Dashboard |
   | `SPOTIFY_REDIRECT_URI` | Set to `http://localhost:8000/callback` locally |
   | `SECRET_KEY` | Any long random string (used to sign session cookies) |

4. **Add the redirect URI to your Spotify app**

   In your Spotify Developer Dashboard → your app → Edit Settings → Redirect URIs, add:
   ```
   http://localhost:8000/callback
   ```

5. **Run the server**

   ```bash
   uvicorn main:app --reload
   ```

   Open [http://localhost:8000](http://localhost:8000) in your browser.

## Deployment

See [DEPLOY.md](DEPLOY.md) for instructions on deploying to Render.

## How the AI recommendation works

Claude is instructed to prioritize songs that **sound and feel** similar to the input — not just songs that are historically or culturally connected. The recommendation priority is:

1. Sonic similarity (production, instrumentation, tempo, texture)
2. Emotional similarity (mood, atmosphere, intensity)
3. Musical similarity (melody, harmony, structure)
4. Genre/subgenre fit
5. Era and historical context (only when it improves accuracy)

This means if you ask for *"songs like Bohemian Rhapsody,"* you'll get tracks that actually feel operatic, dramatic, and layered — not just a list of Queen's other hits or 70s rock bands.

## Project structure

```
├── main.py              # FastAPI app — all routes and Claude/Spotify logic
├── static/
│   ├── index.html       # Single-page UI
│   ├── app.js           # Frontend logic
│   └── style.css        # Styles
├── requirements.txt
├── .env.example         # Environment variable template
└── Procfile             # For Render/Heroku deployment
```

## License

MIT
