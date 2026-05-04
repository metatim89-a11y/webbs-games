# Wubs Games - Known Bugs & Feature Gaps

## Resolved Bugs (Verified 2026-05-04 10:45 AM)
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

## Remaining Bug List
2.  **Asset Loading:** Certain image assets fail to cache properly on mobile browsers, leading to flickering.
5.  **Audio Latency:** Sound effects (SFX) engine not yet implemented; assets are missing.
18. **Mancala Latency:** While improved with Optimistic UI, seed-sowing logic could be further optimized for ultra-low latency.



