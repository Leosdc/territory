/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                neon: {
                    pink: '#ff00ff',
                    blue: '#00ffff',
                    green: '#00ff00',
                    purple: '#bc13fe',
                    yellow: '#f9f871',
                },
                dark: {
                    bg: '#0a0a0a',
                    card: '#1a1a1a',
                }
            },
            boxShadow: {
                'neon-pink': '0 0 10px #ff00ff, 0 0 20px #ff00ff',
                'neon-blue': '0 0 10px #00ffff, 0 0 20px #00ffff',
                'neon-green': '0 0 10px #00ff00, 0 0 20px #00ff00',
            }
        },
    },
    plugins: [],
}
