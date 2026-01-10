# 🌆 Neon Territory

> A high-performance, cyberpunk-themed territory capture game built with React, Vite, and Tailwind CSS.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-purple.svg)

## 🎮 Features

- **Cyberpunk Aesthetic**: Immersive dark mode with glowing pastel trails and glassmorphism UI.
- **Smart Capture System**: Enclose any area to capture it instantly—stealing territory from enemies or claiming empty space.
- **Dynamic AI**: Battle against up to 3 NPC bots with randomized behaviors.
- **Modes**: challenge yourself in **Normal** or try the chaotic **Insane Mode** with hacking AIs.
- **Responsive Controls**: Smooth movement using `WASD`, `Arrow Keys` or **Touch Controls** on mobile.
- **Auto-Deployment**: Integrated GitHub Actions for seamless deployment to GitHub Pages.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/territory-game.git
   cd territory-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## 🕹️ How to Play

1. **Start**: Choose your neon color, grid size, and number of opponents in the main menu.
2. **Move**: Use your keyboard to navigate the grid.
3. **Paint**: Your movement leaves a trail.
4. **Capture**: Return to your own existing territory to "close the loop". **Everything** inside that loop becomes yours!
5. **Win**: The player with the most tiles when the timer hits zero wins the crown.

## 🛠️ Tech Stack

- **Core**: React 18, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS, PostCSS
- **Icons**: Lucide React

## 📦 Deployment

This project is configured for **zero-config deployment** to GitHub Pages.

1. Push this code to a GitHub repository.
2. Watch the **Actions** tab.
3. The included workflow will build and deploy your game automatically.

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
