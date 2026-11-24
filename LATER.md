# Later (parked ideas, not in the code yet)

Found during the 2026-11-24 review. Finish current work before starting these.

## Needs a small server (everything is saved per phone today)
- Sign-up requests, the message board, PINs and win/loss stats live in each phone's
  own browser storage. "Request sent to Tim!" only reaches the phone it was typed on,
  and stats don't follow a player to another phone.
- PINs are stored as plain text and anyone can create a PIN for "Tim" on a new phone,
  so the admin page is not really protected.
- Online tables use the free public PeerJS server and a 4-digit PIN; fine for family,
  not for lots of strangers.

## Games
- Uno No Mercy: 0 should pass hands and 7 should swap with a chosen player (with only
  2 players both just swap today). Online 7/0 swap flow is fragile.
- Uno local play: pass-the-phone cover is a simple button; a full-screen cover would
  hide cards better.
- Chutes & Ladders + Sorry: online play is host-authoritative only for turns; a
  "rejoin after disconnect" would help on phones that sleep.

## If it is ever offered to the public
- Sorry!, UNO and Chutes and Ladders are other companies' trademarks; those games
  would need new names, rules and art of their own first.
