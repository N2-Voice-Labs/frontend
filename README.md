# Voice Labs site and workspace

Next.js App Router, plain CSS, no animation libraries.

- `/` is the public landing page, ported from the approved reference `index2.html`
  (`app/(marketing)`, `components/landing`). Only the live demo needs a backend.
- `/agents` is the workspace Agents page, ported from `agents.html` (`app/(workspace)`,
  `components/workspace`). It reads the Platform API from the browser at `NEXT_PUBLIC_PLATFORM_URL`.
  Preview its other states with `/agents?state=loading`, `?state=error` and `?state=empty`.

- The other workspace pages come from the previous app (`frontend.voice-labs`). Their components and CSS are
  kept, and `styles/legacy/restyle.css` maps their tokens, fonts, radii and shared pieces onto the new design;
  they use the same pill nav and ASCII footer as `/agents` (`app/shell.css`). The pages: `/call`, `/join`, `/conversations`, `/voices` (+ clone/design), `/usage` (formerly
  `/analytics`, which redirects), `/agents/new`, `/agents/:id` (+ edit, and `/test`, the Voice
  Playground), `/campaigns`, `/knowledge`, `/tools`. `/playground?agent=<id>` redirects to the playground.

Each area has its own root layout: `app/(marketing)`, `app/(workspace)`, `app/(dashboard)` and `app/(call)`.
They ship different stylesheets (the previous app's tokens use the same variable names with other values,
in `styles/legacy/`), and moving between root layouts is a full page load, so the styles never mix. Unknown
URLs render `app/global-not-found.tsx`.

Fonts live in `lib/fonts/site.ts` and every area uses them. Only the two headline fonts (Manrope,
Instrument Serif) are preloaded. Korean uses the system faces (`--font-kr`, `--font-hangul-system`), not a
web font: Noto Sans KR through next/font adds 120–370 render-blocking `@font-face` rules per page, which was
the main reason first paint was slow.

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The microphone needs a secure context, so use
`http://localhost` or `https://`.

## The live demo ("Speak to it")

The orb and the signal band share one demo session (`lib/demo/session-store.ts`).

- **Mic preview.** When `NEXT_PUBLIC_DEMO_TOKEN_ENDPOINT` is empty, the page only draws your microphone.
  Nothing is sent anywhere.
- **Live agent.** When it is set to `/api/demo/session`, the browser POSTs `{ agentId: "concierge" }`.
  The route handler (`app/api/demo/session/route.ts`) then:
  - looks up the slug in `DEMO_AGENTS`,
  - calls the Platform's `POST /voice/sessions` with the server-only `PLATFORM_API_KEY`,
  - returns `{ url, token, sessionId, endToken, maxSeconds }`.

  The browser joins the LiveKit room and publishes the microphone. It ends the session after 3 minutes, on
  "End session" and on `pagehide`, and calls `/api/demo/session/end` each time.
- **Abuse limits.** The route accepts same-origin requests only and allow-listed agents only. It allows
  4 sessions per IP per minute. Deployed, that limit uses the `DEMO_RATE_LIMITER` binding in
  `wrangler.jsonc`; locally it uses an in-memory fallback. Set a `namespace_id` that is unique in your
  Cloudflare account.
- **Response time.** It is measured in the browser: end of your speech → first agent audio, using an RMS
  threshold of 0.07. It is not the server-side NS-01 number.

### Backend follow-ups (not in this repo)

- **Live captions.** The page listens for `RoomEvent.TranscriptionReceived` and the `lk.transcription`
  text stream. The current runtime (pipecat) publishes neither, so captions stay empty until it does. It
  should publish both the user's and the agent's text; for translation agents, the agent caption should
  be the translated text.
- **Hard session cap.** The browser ends sessions at 3 minutes, and Platform tokens expire after
  10 minutes. A modified client could still keep a room open longer. Enforcing a server-side maximum
  duration needs Platform/runtime support.
- **Transcripts.** The Platform stores a Conversation and transcript for every session, so the note under
  the orb says that demo transcripts are stored. Change `DEMO_CONFIG.storesTranscripts` if that changes.

## Agents page data

`lib/agents/view.ts` maps the Platform's `/agents`, `/providers` and `/voices` onto the cards and
inspector. Two things the Platform does not have yet:

- **First message.** Agents have no greeting field, so the inspector hides the "First message" block.
- **Voice preview.** The play button stays disabled until an agent has a real `sample` URL (for example,
  its first message rendered by its own voice through `POST /voices/{id}/preview`). It never plays a
  stand-in voice.

## Content and config

- Latency numbers live in `LATENCY_STAGES` (`lib/landing/config.ts`). `null` renders the `[p50 ms]`
  placeholder. Paste the real NS-01 p50 values there.
- Routes live in `ROUTES` (`lib/landing/config.ts`). `/agents` is in this app. Call, playground,
  conversations, voices and usage are prefixed with `NEXT_PUBLIC_APP_URL` (empty means the same origin).
- Footer links (email, GitHub, LinkedIn, contact, privacy, terms, pilot, docs, support) live in
  `SITE_LINKS`. A `null` link is not rendered, so paste the real URLs there.
- Sample agents for the landing gallery are in `lib/landing/showcase-data.ts`. Their slugs must be
  listed in `DEMO_AGENTS` to start a live session; an unlisted one says it is not available yet.
- Recorded translation clips for "Live translate" go in `SAMPLES` in the same file. Without one, the
  player shows a labelled text preview.
- The theme uses `data-vl-theme` and `localStorage["vl-theme"]`, shared with the workspace app.

## Checks

```bash
npm run typecheck
npm test
npm run build
```
