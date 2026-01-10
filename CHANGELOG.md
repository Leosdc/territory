# Changelog

All notable changes to the **Neon Territory** project will be documented in this file.

## [1.1.0] - 2026-01-10

### ✨ Visual & UI Updates
- **Pastel Color Palette**: Swapped aggressive neon colors for a softer, high-contrast pastel palette for better visibility.
- **Tutorial System**: Added a "COMO JOGAR" button to the main menu with updated instructions.
- **Mobile Controls Hints**: Added explicit instructions for mobile touch controls.

### 🎮 Gameplay Balance & Fixes
- **Insane Mode**: 
  - Hacker AI is now vulnerable to Freeze power-ups (hacks disabled while frozen).
  - AI "Hacker" painting reduced slightly to avoid instant overwhelming.
- **Painting Logic Fix**:
  - Fixed a critical bug where painting would fail or be erased if walking over enemy territory in certain patterns.
  - **New Rule**: Territories cannot be captured if an enemy is currently standing inside the region. This prevents "path erasing" and trapping active players in invalid fills.
- **AI Start**: Fixed an issue where AI bots would delay/freeze at the start of the match. Bots now launch immediately.

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
