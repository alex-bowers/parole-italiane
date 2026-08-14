# Parole italiane

Parole italiane is a dependency-free Italian vocabulary game. It runs as a
Cloudflare Worker with Workers KV for saved vocabulary, or as a local Node.js
server when you want to practise without deploying.

## Included learning content

- 100 everyday Italian words
- 30 practical A1 sentences
- A Words deck, a Sentences deck, and a Mixed deck
- An in-app form for adding your own words or sentences

## Game modes

| Mode | Prompt | Your task |
| --- | --- | --- |
| **Easy** | English | Choose the correct Italian answer from six options. |
| **Normal** | Italian | Type the English translation. |
| **Hard** | English | Type the Italian translation. |

Typed answers are case-insensitive and accept Italian text without accents, so
`perche` is accepted for `perché`. The app shows the correct answer after every
attempt and reads it aloud in Italian using the browser's speech synthesis. It
automatically advances after the pronunciation finishes for a correct answer.
Browsers without speech synthesis continue without audio.

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
