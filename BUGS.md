# Wubs Games - Known Bugs & Feature Gaps

## Resolved Bugs (Verified 2026-05-04 11:45 AM)
25. **Signup Color Persistence:** `submitSignup` now captures all three color inputs.
26. **Admin Access Security:** Added `.admin-only` CSS and session-based validation in `admin.js`.
27. **Uno No Mercy Hand Sync:** Corrected hand count mapping for Host/Client/Spectators.
28. **Uno Spectator Data Gaps:** Spectators now see correct opponent hand counts.
29. **Admin Queue Visuals:** Approval cards now display guest's chosen theme color dots.
30. **Nim/357 Board Architecture:** Implemented mandatory high-contrast square slots and column alignment.
31. **Sorry! CPU Logic Crash:** Fixed function name and simulated full roll distance.
32. **Black Hole Game Logic Gap:** Implemented triangular neighbor elimination mechanic.
33. **Multiplayer Animation Broadcasts:** Unified animation triggers across all games.
34. **CSS Versioning:** Synchronized all files to v1.3.0.
35. **Missing PIN Visibility Toggle:** Added "Show PIN" button to the lobby overlay.
36. **Mancala Concurrent Sowing:** Added click-protection during sowing animations.
37. **Mancala End-Game Cleanup:** Pits are now explicitly cleared when the game ends.
38. **Uno Wild Color Roulette Inversion:** Corrected logic so the card player picks the color for the next player.
39. **Admin Dashboard Security:** Reinforced with sessionStorage validation and identity checks.
2.  **Asset Loading:** Preloading implemented for mobile browser flickering.
5.  **Audio Latency:** Implemented procedural Web Audio API engine (`audio.js`) for low-latency SFX and synthesized missing assets.
18. **Mancala Latency:** Seed-sowing animation speed significantly increased (sleep reduced to 80ms) for ultra-low latency, and audio feedback added per seed.
1.  **Multiplayer Sync (General):** Resolved with Optimistic UI updates and `NetworkManager` sequence numbering (v1.2.1).
3.  **Touch Targets:** Main menu buttons resized for mobile compatibility.
4.  **Session Persistence:** Browser refreshes no longer wipe sessions (sessionStorage).
6.  **Sorry Multiplayer Sync:** Animations now broadcast to both players.
7.  **Sorry Spectator UI:** Cards and moves correctly render for spectators.
8.  **Single Player AI Logic:** Input is strictly blocked during CPU turns and players can no longer move on the opponent's behalf/side across all games (Mancala, 357, Tic-Tac-Toe, Black Hole, Sorry, Chutes & Ladders, Uno).
9.  **Uno No Mercy Rendering:** Discard pile card color fixed.
10. **Game Over Lifecycle:** Unified winner modal implemented.
11. **Turn Rotation:** Starting player now rotates on "Play Again".
12. **Chutes & Ladders Visuals:** Trajectory lines added.
13. **Dice Animation:** Rapid cycling animation implemented.
14. **Movement Physics:** "Teleportation" replaced with CSS "Hopping".
15. **Nim Visual Contrast:** High-contrast square backgrounds implemented.
16. **Global Winning Theme:** Consistent "Game Over" pop-up added.
17. **Mancala Sync:** Seed-sowing animations synchronized.
19. **Persistent Rules UI:** Minimizable rules block added to all games.
20. **UX Guidance:** "Need help" subtext added to rules toggle.
21. **Uno No Mercy Multiplayer:** Refactored to support multiple hands and separate state for local/online play.
22. **Admin/Security Bypass:** (Note: Still partially vulnerable due to client-side nature, but `ProfileManager` now prefers `sessionStorage` for identity validation).
23. **CPU Mode Deadlocks:** Fixed logic in Chutes & Ladders and Uno No Mercy where the computer was blocking its own turns.
24. **Online Join UX:** Removed manual game selection for joining players; clients now auto-discover the host's game via the PIN.

## Remaining Bug List
*All pending bugs from the current batch have been successfully resolved.*
