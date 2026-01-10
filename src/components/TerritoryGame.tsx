import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Crown, Timer } from 'lucide-react';

const COLORS = ['#FF0055', '#00FF99', '#00FFFF', '#FFCC00', '#BE00FF', '#FF3300', '#0066FF'];

interface Player {
    x: number;
    y: number;
    color: string;
    isPlayer: boolean;
    speed: number;
    vx: number;
    vy: number;
}

const TerritoryGame = () => {
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'ended'>('menu');
    const [gridSize, setGridSize] = useState(32);
    const [numNPCs, setNumNPCs] = useState(1);
    const [playerColor, setPlayerColor] = useState(COLORS[1]);
    const [timeLeft, setTimeLeft] = useState(60);

    const gridRef = useRef<(string | null)[][]>([]);
    const playersRef = useRef<Player[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const keysPressed = useRef<{ [key: string]: boolean }>({});
    const gameLoopRef = useRef<number>();

    const CELL_SIZE = 20;

    const initializeGame = useCallback(() => {
        const rows = gridSize;
        const cols = gridSize;

        // Initialize grid
        gridRef.current = Array(rows).fill(null).map(() => Array(cols).fill(null));

        // Initialize players
        const positions = [
            { x: 5, y: 5 },
            { x: cols - 6, y: 5 },
            { x: 5, y: rows - 6 },
            { x: cols - 6, y: rows - 6 }
        ];

        playersRef.current = [
            {
                x: positions[0].x,
                y: positions[0].y,
                color: playerColor,
                isPlayer: true,
                speed: 0.15,
                vx: 0,
                vy: 0
            }
        ];

        // Add NPCs
        for (let i = 0; i < numNPCs; i++) {
            const pos = positions[(i + 1) % positions.length];
            playersRef.current.push({
                x: pos.x,
                y: pos.y,
                color: COLORS[(i + 2) % COLORS.length],
                isPlayer: false,
                speed: 0.12,
                vx: Math.random() > 0.5 ? 1 : -1,
                vy: 0
            });
        }

        // Paint initial areas
        playersRef.current.forEach(p => {
            const cx = Math.floor(p.x);
            const cy = Math.floor(p.y);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = cy + dy;
                    const nx = cx + dx;
                    if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
                        gridRef.current[ny][nx] = p.color;
                    }
                }
            }
        });

        setTimeLeft(60);
        setGameState('playing');
    }, [gridSize, numNPCs, playerColor]);

    const updateNPCDirection = useCallback((npc: Player) => {
        if (Math.random() < 0.02) {
            const dirs = [
                { vx: 1, vy: 0 }, { vx: -1, vy: 0 },
                { vx: 0, vy: 1 }, { vx: 0, vy: -1 }
            ];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            npc.vx = dir.vx;
            npc.vy = dir.vy;
        }
    }, []);

    const gameLoop = useCallback(() => {
        const players = playersRef.current;
        const grid = gridRef.current;
        const rows = grid.length;
        const cols = grid[0]?.length || 0;

        // Update player from keyboard
        if (players[0]) {
            const p = players[0];
            p.vx = 0;
            p.vy = 0;
            if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) p.vy = -1;
            if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) p.vy = 1;
            if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) p.vx = -1;
            if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) p.vx = 1;
        }

        // Update NPCs and move all players
        players.forEach(p => {
            if (!p.isPlayer) {
                updateNPCDirection(p);
            }

            if (p.vx !== 0 || p.vy !== 0) {
                p.x += p.vx * p.speed;
                p.y += p.vy * p.speed;
                p.x = Math.max(0.5, Math.min(cols - 0.5, p.x));
                p.y = Math.max(0.5, Math.min(rows - 0.5, p.y));

                // Paint cell
                const gx = Math.floor(p.x);
                const gy = Math.floor(p.y);
                if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
                    grid[gy][gx] = p.color;
                }
            }
        });

        // Draw
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate camera (center on player)
        const player = players[0];
        const cameraX = canvas.width / 2 - player.x * CELL_SIZE;
        const cameraY = canvas.height / 2 - player.y * CELL_SIZE;

        ctx.save();
        ctx.translate(cameraX, cameraY);

        // Draw grid
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const color = grid[y][x];
                ctx.fillStyle = color || '#1a1a1a';
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

                if (!color) {
                    ctx.strokeStyle = '#2a2a2a';
                    ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                }
            }
        }

        // Draw players
        players.forEach((p, i) => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(
                p.x * CELL_SIZE,
                p.y * CELL_SIZE,
                CELL_SIZE * 0.4,
                0,
                Math.PI * 2
            );
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (i === 0) {
                ctx.fillStyle = '#fff';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('YOU', p.x * CELL_SIZE, p.y * CELL_SIZE - 12);
            }
        });

        ctx.restore();
    }, [CELL_SIZE, updateNPCDirection]);

    // Game loop effect
    useEffect(() => {
        if (gameState === 'playing') {
            const loop = () => {
                gameLoop();
                gameLoopRef.current = requestAnimationFrame(loop);
            };
            gameLoopRef.current = requestAnimationFrame(loop);

            return () => {
                if (gameLoopRef.current) {
                    cancelAnimationFrame(gameLoopRef.current);
                }
            };
        }
    }, [gameState, gameLoop]);

    // Timer
    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0 && gameState === 'playing') {
            setGameState('ended');
        }
    }, [timeLeft, gameState]);

    // Keyboard
    useEffect(() => {
        const down = (e: KeyboardEvent) => { keysPressed.current[e.key] = true; };
        const up = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, []);

    // Canvas resize
    useEffect(() => {
        const resize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    const calculateScores = () => {
        const scores: Record<string, number> = {};
        playersRef.current.forEach(p => scores[p.color] = 0);
        gridRef.current.forEach(row => {
            row.forEach(cell => {
                if (cell && scores[cell] !== undefined) scores[cell]++;
            });
        });
        return scores;
    };

    if (gameState === 'menu') {
        return (
            <div className="w-full max-w-lg bg-black/90 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl text-center">
                <Crown size={48} className="mx-auto text-yellow-400 mb-4" />
                <h1 className="text-5xl font-black bg-gradient-to-r from-pink-500 to-cyan-500 bg-clip-text text-transparent mb-6">
                    NEON WARS
                </h1>

                <div className="space-y-4 text-left">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Tamanho do Mapa</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[16, 32, 64].map(s => (
                                <button key={s} onClick={() => setGridSize(s)}
                                    className={`py-3 rounded-xl font-bold transition-all ${gridSize === s
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}>
                                    {s}x{s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Inimigos</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map(n => (
                                <button key={n} onClick={() => setNumNPCs(n)}
                                    className={`py-3 rounded-xl font-bold transition-all ${numNPCs === n
                                            ? 'bg-cyan-500 text-black'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}>
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Sua Cor</label>
                        <div className="flex gap-2 justify-center">
                            {COLORS.slice(0, 5).map(c => (
                                <button key={c} onClick={() => setPlayerColor(c)}
                                    className={`w-12 h-12 rounded-full transition-transform ${playerColor === c ? 'ring-4 ring-white scale-110' : 'opacity-50'
                                        }`}
                                    style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>

                    <button onClick={initializeGame}
                        className="w-full mt-6 py-4 bg-white text-black font-black text-xl rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-3">
                        <Play className="fill-black" size={24} />
                        JOGAR
                    </button>
                </div>
            </div>
        );
    }

    if (gameState === 'playing') {
        const scores = calculateScores();
        return (
            <div className="fixed inset-0 overflow-hidden bg-black">
                <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/70 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 z-10">
                    <div className="flex items-center gap-2">
                        <Timer className="text-yellow-400" size={20} />
                        <span className="text-2xl font-black text-white font-mono">
                            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </span>
                    </div>
                    <div className="h-6 w-px bg-white/30"></div>
                    <div className="flex gap-4">
                        {playersRef.current.map((p, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: p.color }} />
                                <span className="text-xs font-bold text-white">{scores[p.color] || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={() => { setGameState('menu'); setTimeLeft(60); }}
                    className="absolute top-8 right-8 p-3 bg-black/70 rounded-full border border-red-500/50 hover:bg-red-500/30 transition-all z-10">
                    <Crown size={20} className="text-red-400" />
                </button>

                <canvas ref={canvasRef} className="block" />
            </div>
        );
    }

    if (gameState === 'ended') {
        const scores = calculateScores();
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

        return (
            <div className="bg-black/90 backdrop-blur border border-white/10 p-10 rounded-3xl text-center max-w-md">
                <Crown size={64} className="mx-auto mb-6 text-yellow-400" />
                <h2 className="text-4xl font-black text-white mb-6">FIM DE JOGO</h2>

                <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2">
                    {sorted.map(([color, score], i) => {
                        const player = playersRef.current.find(p => p.color === color);
                        return (
                            <div key={color} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-500 font-mono">#{i + 1}</span>
                                    <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                                    <span className="text-white font-bold">
                                        {player?.isPlayer ? 'VOCÊ' : `BOT ${i}`}
                                    </span>
                                </div>
                                <span className="text-white font-bold font-mono">{score}</span>
                            </div>
                        );
                    })}
                </div>

                <button onClick={() => setGameState('menu')}
                    className="w-full py-4 bg-cyan-500 text-black font-bold rounded-xl hover:bg-white transition-all">
                    JOGAR NOVAMENTE
                </button>
            </div>
        );
    }

    return null;
};

export default TerritoryGame;