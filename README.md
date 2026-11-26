# Webbs Games

A private family game room: Tic-Tac-Toe, 357, Mancala, Black Hole, Chutes & Ladders,
Sorry and Uno No Mercy. Play on one phone, against the computer, or online with a
table PIN or invite link. No ads, no fees.

Live: https://metatim89-a11y.github.io/webbs-games/ (served from the `production` branch)

## Family accounts (Firebase)

Each player taps their name and uses a 4-digit PIN. Accounts live in Firebase
(Google Cloud project `x300-506418`), so the same PIN, messages and wins work on any phone.

- New players start **waiting for approval**. Until Tim approves them they can play
  every game but can't message, see open tables or send invites.
- **Private messages** are 1-to-1. Only the two people in a chat can read it, plus Tim
  (admin) from the settings gear > "Read family messages", where he can also delete
  messages. Nobody can edit or delete their own sent messages.
- **Family chat** is the shared board, the same on every phone.
- **Open tables**: hosting an online game lists it for the family until someone joins.
- **Invites**: from the host's PIN box, send a link (any app) or tap a family member's
  name to send an in-app invite.
- If Firebase can't load, the games still work with the PINs saved on that phone.

The database rules are the real protection (`firebase/rules.src.json`):
`firebase/deploy-rules.sh` builds and uploads them, and `python3 firebase/test-rules.py <key>`
attacks them with throwaway accounts (45 checks) and cleans up.

## Ship a change

1. `./version-update.sh 1.x.y` (cache-busting so phones load the new files)
2. Commit and `git push origin production` (as the metatim89-a11y GitHub account)

## Tests

Headless Chromium, real network, no extra packages. Serve the site first:
`python3 -m http.server 8123 --bind 127.0.0.1`

- `node tests/family_test.mjs <tmpdir>`: two phones sign up, get approved, message,
  family chat, lobby, invite and join (16 steps, test accounts removed afterwards)
- `node tests/pin_test.mjs <tmpdir>`: make a PIN, wrong PIN, log in from another phone
- `node tests/invite_test.mjs <tmpdir>`: invite link joins an online Sorry table, 6 turns in sync
- `node tests/chat_test.mjs`: game table chat with a host and two joiners on a pretend network
  (each message arrives once, greyed out with a reason until someone joins, 300-letter limit).
  Needs no browser or server.
- `node tests/games_test.mjs`: every game against the computer, with someone here and online,
  on pretend phones (needs `npm install --no-save jsdom` once; no browser or server)
- `node tests/lobby_test.mjs`: "Who's playing?", the Game Lobby (listed and invite-only tables,
  invites, join), the shared top bar and actions row on every game, chat quick messages,
  help guides and the tour. Uses a pretend family server, so real accounts are never touched.
- `tests/bot.js`, `unobot.js`, `anybot.js`: auto-play bots that play whole games (see the test commands in git history)

Parked ideas: [LATER.md](LATER.md)
