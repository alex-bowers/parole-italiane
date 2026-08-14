# Parole italiane

Parole italiane is a dependency-free Italian vocabulary game. It runs as a
Cloudflare Worker with Workers KV for saved vocabulary, or as a local Node.js
server when you want to practise without deploying.

The interface is an installable Progressive Web App (PWA). After one online
visit, it can open and run offline. Vocabulary additions made offline remain on
the device and synchronise with Workers KV when the connection returns.

## Project structure

The browser interface uses three static files:

- `public/index.html` contains the page markup.
- `public/styles.css` contains the page styles.
- `public/app.js` contains the game behaviour.

The Worker API is in `src/worker.js`. Wrangler deploys the `public` directory
as static assets and routes `/api/*` requests to the Worker.

## Included learning content

- 100 everyday Italian words
- 30 practical A1 sentences
- A Words deck, a Sentences deck, and a Mixed deck
- An in-app form for adding your own words or sentences

## Practice activities

| Activity | Your task |
| --- | --- |
| **Multiple choice** | Choose the correct Italian translation. |
| **Translation** | Type the Italian or English translation. |
| **Listen and choose** | Hear Italian and choose the phrase that was spoken. |
| **Listen and type** | Transcribe spoken Italian. |
| **Pronunciation** | Say the displayed Italian and compare the recognised words. |
| **Matching** | Match five English and Italian pairs. |
| **Build a sentence** | Arrange Italian words to match an English sentence. |

Typed answers are case-insensitive and accept Italian text without accents, so
`perche` is accepted for `perché`. The app shows the correct answer after every
attempt and reads Italian aloud using the browser's speech synthesis. Listening
activities include normal and slower playback controls.

Pronunciation practice uses the browser's speech recognition when it is
available. Recognition checks the words that the browser heard; it does not
grade accent quality. Browsers without speech recognition provide a
listen-and-repeat fallback instead.

## Install on a phone

Deploy the app, open its HTTPS address in your phone's browser, then use the
browser's **Add to Home Screen** or **Install app** command. Visit the app once
while online before relying on offline mode.

## Run locally

Requirements: Node.js 18 or newer and pnpm 11 or newer. You do not need to
install dependencies to run the local server.

```sh
pnpm run local
```

Local additions are saved in `data/words.json`. This file is not committed and
does not affect a deployed Cloudflare vocabulary list.

## Deploy to Cloudflare

Requirements: a Cloudflare account, Node.js 18 or newer, and pnpm 11 or newer.
Wrangler is included as a project development dependency.

1. Install the project dependencies. pnpm is configured to permit the required
   `esbuild` and `workerd` build scripts.

   ```sh
   pnpm install
   ```

2. Create a KV namespace:

   ```sh
   pnpm wrangler kv namespace create VOCABULARY
   ```

3. Copy the namespace ID printed by that command into `wrangler.toml`, replacing
   `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

4. Sign in and deploy:

   ```sh
   pnpm wrangler login
   pnpm run deploy
   ```

The first visit creates the starter list in KV. Later starter-list updates add
missing built-in entries without removing any words or sentences you added.
