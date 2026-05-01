# Gemini Engineering Protocol (v.041)
# Project: Wubs Games
# Logic: Radical Simplicity & Envision First

## MANDATORY CONSTRAINTS:
1. NEVER use placeholder code, "TODO" comments, or "..." snippets.
2. Provide FULL source code for every file modified.
3. Use absolute paths and explicit file signatures.
4. If a system works, do not modify its core logic; only extend it.
5. All UI/UX must be mobile-first and utilize the Pixel 8 aspect ratio.

## THE TASK: RESOLVE BUG BATCH (1-20)
You are tasked with resolving the 20 bugs listed in BUGS.md. 

### PRIORITY ARCHITECTURE:
1. **Game Lifecycle:** Implement a unified "Game Over" modal with an animated winner announcement and a "Play Again" button that rotates player turns.
2. **Visual Feedback:** Refactor piece movement from "teleportation" to "hopping" logic using CSS Keyframes.
3. **UI Overlay:** Add a minimizable rules block to the top-right of every game with the "i" icon and "Need help" subtext.
4. **State Sync:** Ensure all animations (Mancala seeds, Sorry hopping, Dice rolls) trigger for BOTH players via the network layer.
5. **Nim/357:** Redesign the board for high contrast with square backgrounds and column-based alignment.

### OUTPUT FORMAT:
Provide the updated code for all affected files (index.html, style.css, network.js, and specific game folders) in a single response.
