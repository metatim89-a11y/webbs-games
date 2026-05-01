# Wubs Games - Known Bugs & Feature Gaps

## Bug List - Updated 2026-05-01 09:48

1.  **Multiplayer Sync (General):** Latency issues causing state desync between Player 1 and Player 2 in real-time sessions.
2.  **Asset Loading:** Certain image assets fail to cache properly on mobile browsers, leading to flickering.
3.  **Touch Targets:** Button hitboxes on the main menu are too small for certain Android screen resolutions.
4.  **Session Persistence:** Refreshing the browser mid-game wipes the current session data instead of reconnecting.
5.  **Audio Latency:** Sound effects (SFX) trigger 200ms-500ms after the action occurs in Termux/Android environments.
6.  **Sorry Multiplayer Sync:** Draw card and "hopping" animations trigger on the active player's screen but do not render for the spectator.
7.  **Sorry Spectator UI:** The "Draw Card" image fails to appear for Player 2 when Player 1 draws.
8.  **Single Player AI Logic:** In "Versus Computer" mode, the game allows the human user to control the computer's turns.
9.  **Uno No Mercy Rendering:** The discard pile card is transparent; it needs to match the color of the last card played.
10. **Game Over Lifecycle:** Missing a modal that announces the winner and offers "Play Again" or "Back to Menu."
11. **Turn Rotation:** When selecting "Play Again," the starting player must rotate so the previous second player goes first.
12. **Chutes & Ladders Visuals:** Lack of clear trajectory lines/points showing exactly where a ladder leads or where a chute drops.
13. **Dice Animation:** The "Spin Roll" in Chutes & Ladders needs a more dynamic, polished dice rolling animation.
14. **Movement Physics:** Game pieces "teleport" to destinations; they should "hop" through each space and slide/climb during transitions.
15. **Nim Visual Contrast:** Pieces need better highlighting. Implementation should use a square background with high-contrast columns for each row.
16. **Global Winning Theme:** All games need a unified, animated "Game Over" pop-up for consistency across the suite.
17. **Mancala Sync:** Counter updates and seed-sowing animations are not showing for both players simultaneously in multiplayer.
18. **Mancala Latency:** Significant delay between clicking a pit and the move registering on the opponent's screen.
19. **Persistent Rules UI:** Replace the info pop-up with a permanent, minimizable rules block in the top-right corner using a toggle icon.
20. **UX Guidance:** Add "Need help" text in a small font underneath the "i" icon to guide users who are unfamiliar with the game objectives.

