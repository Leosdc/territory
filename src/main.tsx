import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// CRITICAL DEBUGGING: Global Error Handler
window.addEventListener('error', (e) => {
    document.body.innerHTML = `
        <div style="color: #ff5555; background: #220000; padding: 20px; font-family: monospace; height: 100vh;">
            <h1>🔥 GLOBAL FATAL ERROR 🔥</h1>
            <p>${e.message}</p>
            <p>${e.filename}:${e.lineno}:${e.colno}</p>
        </div>
    `;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
