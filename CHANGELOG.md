# Changelog

All notable changes to the **Neon Territory** project will be documented in this file.

## [1.0.0] - 2026-01-09

### 🚀 Major Features & Overhaul
- **Project Migration**: Converted from a single `.tsx` file to a scalable **Vite + React + TypeScript** architecture.
- **UI/UX Redesign**:
  - Implemented a "Cyberpunk/Neon" visual theme.
  - Added Glassmorphism effects to menus and HUD.
  - Added glowing trail effects for players.
  - Replaced native color pickers with a curated Neon Palette.
- **Game Mechanics**:
  - **Capture Logic Overhaul**: Closing a loop now captures **ALL** enclosed tiles, regardless of whether they are empty or belong to an enemy.
  - **Flood Fill Fix**: corrected algorithms to properly respect player boundaries during capture calculations.
  - **AI Improvements**: NPCs now select random colors ensuring they never clash with the player.

### 🛠 Technical Updates
- Added `tailwind.config.js` with custom neon color extensions.
- Configured **GitHub Actions** (`deploy.yml`) for automatic deployment to GitHub Pages.
- Added `checkAndFillEnclosedAreas` optimization.
- Fixed collision detection stability.

### 🐛 Bug Fixes
- Fixed issue where flood fill would capture the entire board if boundaries weren't detected.
- Fixed inconsistent NPC behavior when hitting walls.
- Fixed scaling issues on larger grid sizes (128x128).
