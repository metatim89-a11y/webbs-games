# Later (parked ideas, not in the code yet)

Finish current work before starting these.

## Done 2026-11-24 (was parked here)
- Family accounts on Firebase: sign-up requests reach Tim, PINs checked by the server,
  stats follow the player, messages and chat on every phone.

## Family features
- Phone notifications for new messages and invites when the site is closed
  (needs a service worker + Firebase Cloud Messaging).
- "Rejoin" an online game after a phone sleeps or loses signal.
- Player themes for newly approved players (today they get the default colours;
  their chosen colours are saved in their profile).

## Games
- Uno No Mercy: 0 should pass hands and 7 should swap with a chosen player (with only
  2 players both just swap today). Online 7/0 swap flow is fragile.
- Uno local play: pass-the-phone cover is a simple button; a full-screen cover would
  hide cards better.

## If it is ever offered to the public
- Sorry!, UNO and Chutes and Ladders are other companies' trademarks; those games
  would need new names, rules and art of their own first.
- The free public PeerJS server and 4-digit table PINs are fine for family, not for
  lots of strangers.

## Terms check (2026-11-25)
- Google APIs Terms 4(b)(1) say developer keys "may not be embedded in open source projects".
  The repo is public and the sign-in key is in cloud.js. Firebase's own docs say web keys are
  not secret; ours is restricted to sign-in only and to this site. If that ever matters: make
  the repo private (needs GitHub Pro for Pages) or move hosting to Firebase Hosting.
- Firebase terms ask users to confirm use is "related to my trade, business, craft, or profession".
