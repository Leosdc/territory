import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Crown, Timer, Trophy } from 'lucide-react';

const COLORS = [
    '#FF0055', // Neon Pink
    '#00FF99', // Neon Green
    '#00FFFF', // Cyan
    '#FFCC00', // Gold
    '#BE00FF', // Purple
    '#FF3300', // Orange red
    '#0066FF', // Blue
    '#FF00CC', // Magenta
    '#CCFF00', // Lime
    '#FFFFFF'  // White
];

const TerritoryGame = () => {
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'ended'>('menu');
    const [gridSize, setGridSize] = useState(64);
    const [numNPCs, setNumNPCs] = useState(1);
    const [gameDuration] = useState(60);
    const [playerColor, setPlayerColor] = useState(COLORS[1]); // Default Green
    const [timeLeft, setTimeLeft] = useState(60);

    // Grid: null = empty, hex string = owner
    const [grid, setGrid] = useState<(string | null)[][]>([]);

    // Players state
    // We'll treat index 0 as THE HUMAN PLAYER.
    type Player = {
        x: number;
        y: number;
        color: string;
        isPlayer: boolean;
        speed: number;
        vx: number;
        vy: number;
        respawning: boolean;
        respawnTimer: number;
        // NPC specific
        changeDirectionTimer?: number;
    };

    const [players, setPlayers] = useState<Player[]>([]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const keysPressed = useRef<{ [key: string]: boolean }>({});

    const cols = gridSize === 64 ? 8 : 16;
    const rows = gridSize === 64 ? 8 : 8;
    const cellSize = 1200 / Math.max(cols, rows);

    const spawnPositions = [
        { x: 1, y: 1 },
        { x: cols - 2, y: 1 },
        { x: 1, y: rows - 2 },
        { x: cols - 2, y: rows - 2 }
    ];

    const initializeGame = () => {
        const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(null));

        // Assign colors
        // Player gets chosen color. NPCs get random UNIQUE colors from the rest.
        const availableColors = COLORS.filter(c => c !== playerColor);
        // Shuffle available
        const shuffled = [...availableColors].sort(() => 0.5 - Math.random());

        const newPlayers: Player[] = [
            {
                x: spawnPositions[0].x + 0.5,
                y: spawnPositions[0].y + 0.5,
                color: playerColor,
                isPlayer: true,
                speed: 0.1,
                vx: 0,
                vy: 0,
                respawning: false,
                respawnTimer: 0
            }
        ];

        for (let i = 0; i < numNPCs; i++) {
            // Safe check for spawn position index (wrap around if more npcs than cornerrs)
            const posIndex = (i + 1) % spawnPositions.length;
            const color = shuffled[i % shuffled.length];

            newPlayers.push({
                x: spawnPositions[posIndex].x + 0.5,
                y: spawnPositions[posIndex].y + 0.5,
                color: color,
                isPlayer: false,
                speed: 0.08,
                vx: 0,
                vy: 0,
                changeDirectionTimer: 0,
                respawning: false,
                respawnTimer: 0
            });
        }

        // Mark initial spawns on grid
        newPlayers.forEach(p => {
            const gridX = Math.floor(p.x);
            const gridY = Math.floor(p.y);
            if (gridY >= 0 && gridY < rows && gridX >= 0 && gridX < cols) {
                newGrid[gridY][gridX] = p.color;
            }
        });

        setGrid(newGrid);
        setPlayers(newPlayers);
        setTimeLeft(gameDuration);
        setGameState('playing');
    };

    const checkCollision = (p1: Player, p2: Player) => {
        if (p1.respawning || p2.respawning) return false;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy) < 0.6;
    };

    const respawnPlayer = (player: Player, index: number) => {
        const spawnIndex = index % spawnPositions.length;
        return {
            ...player,
            x: spawnPositions[spawnIndex].x + 0.5,
            y: spawnPositions[spawnIndex].y + 0.5,
            vx: 0,
            vy: 0,
            respawning: true,
            respawnTimer: 120
        };
    };

    // FIXED LOGIC: Capture EVERYTHING inside valid enclosed area (that doesn't touch border)
    // Regardless of what color is inside.
    const checkAndFillEnclosedAreas = (currentGrid: (string | null)[][], ownerColor: string) => {
        // We create a copy to mutate
        const newGrid = currentGrid.map(row => [...row]);
        const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));

        // Flood fill from (sx, sy) to find a connected region of "NON-OWNER" cells
        // If that region DOES NOT touch the game board boundary, it is "Enclosed" by OWNER.
        // So we fill it.

        const floodFill = (sx: number, sy: number) => {
            const stack = [[sx, sy]];
            const region = [];
            let touchesBorder = false;

            while (stack.length) {
                const [x, y] = stack.pop()!;

                if (x < 0 || x >= cols || y < 0 || y >= rows) {
                    touchesBorder = true; // Should ideally be caught before push, but safety.
                    continue;
                }

                if (visited[y][x]) continue;

                // CRITICAL FIX: If we hit the OWNER's color, that's a wall. 
                // We do NOT add it to the region, we do NOT visit it (in this context of finding inner space).
                // It effectively stops the flood fill.
                if (newGrid[y][x] === ownerColor) {
                    continue;
                }

                visited[y][x] = true;
                region.push([x, y]);

                if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) {
                    touchesBorder = true;
                }

                // Neighbors
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
                        // We check color inside the loop to avoid pushing owner cells? 
                        // Actually we check at start of loop.
                        stack.push([nx, ny]);
                    }
                });
            }

            return { region, touchesBorder };
        };

        // Iterate all cells. If we find a cell that is NOT owner's color and NOT visited, 
        // it's a candidate for a region.
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (!visited[y][x] && newGrid[y][x] !== ownerColor) {
                    const { region, touchesBorder } = floodFill(x, y);

                    // If it doesn't touch the border, it's enclosed by ownerColor!
                    // We convert ALL cells in that region to ownerColor.
                    // This captures enemies, empty space, everything.
                    if (!touchesBorder && region.length > 0) {
                        region.forEach(([rx, ry]) => {
                            newGrid[ry][rx] = ownerColor;
                        });
                    }
                }
            }
        }

        return newGrid;
    };

    const updateNPCDirection = (npc: Player) => {
        if (!npc.changeDirectionTimer) npc.changeDirectionTimer = 0;
        npc.changeDirectionTimer--;

        // Higher chance to change direction if hitting wall or just random
        if (npc.changeDirectionTimer <= 0) {
            const options = [
                { vx: 1, vy: 0 },
                { vx: -1, vy: 0 },
                { vx: 0, vy: 1 },
                { vx: 0, vy: -1 }
            ];

            // Filter valid moves
            const validOptions = options.filter(dir => {
                const newX = npc.x + dir.vx;
                const newY = npc.y + dir.vy;
                return newX >= 0.5 && newX < cols - 0.5 && newY >= 0.5 && newY < rows - 0.5;
            });

            if (validOptions.length > 0) {
                // Smart-ish AI: try to move towards empty space sometimes? 
                // For now random is fine as requested.
                const chosen = validOptions[Math.floor(Math.random() * validOptions.length)];
                npc.vx = chosen.vx;
                npc.vy = chosen.vy;
            }

            npc.changeDirectionTimer = 10 + Math.random() * 30; // Change more often
        }
    };

    const gameLoop = () => {
        setPlayers(prevPlayers => {
            let newPlayers = prevPlayers.map(p => ({ ...p }));

            // Respawn timer
            newPlayers.forEach(p => {
                if (p.respawning) {
                    p.respawnTimer--;
                    if (p.respawnTimer <= 0) {
                        p.respawning = false;
                    }
                }
            });

            // Player Input
            if (newPlayers[0] && !newPlayers[0].respawning) {
                const player = newPlayers[0];
                // Only change direction, don't stop unless no key (optional, usually snake games keep moving)
                // Code here stops if no key pressed. Let's keep that for control precision.
                /* 
                   If we want Continuous movement (Snake style):
                   We only update vx/vy if a key is pressed, otherwise keep going.
                   But the original code zeroed it out. Let's keep original control style for now 
                   but maybe make it smoother?
                */
                player.vx = 0;
                player.vy = 0;

                if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) player.vy = -1;
                else if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) player.vy = 1;

                if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) player.vx = -1;
                else if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) player.vx = 1;
            }

            // NPC Logic
            newPlayers.forEach(p => {
                if (!p.isPlayer && !p.respawning) {
                    updateNPCDirection(p);
                }
            });

            // Move
            newPlayers.forEach(p => {
                if (!p.respawning && (p.vx !== 0 || p.vy !== 0)) {
                    p.x += p.vx * p.speed;
                    p.y += p.vy * p.speed;

                    // Clamp
                    p.x = Math.max(0.5, Math.min(cols - 0.5, p.x));
                    p.y = Math.max(0.5, Math.min(rows - 0.5, p.y));
                }
            });

            // Collisions (Player vs NPC)
            for (let i = 0; i < newPlayers.length; i++) {
                for (let j = i + 1; j < newPlayers.length; j++) {
                    // Simplified collision: just reset both if they touch
                    if (checkCollision(newPlayers[i], newPlayers[j])) {
                        newPlayers[i] = respawnPlayer(newPlayers[i], i);
                        newPlayers[j] = respawnPlayer(newPlayers[j], j);
                    }
                }
            }

            return newPlayers;
        });

        setGrid(prevGrid => {
            let newGrid = prevGrid.map(row => [...row]);

            // 1. Paint trail
            players.forEach(p => {
                if (!p.respawning) {
                    const gridX = Math.floor(p.x);
                    const gridY = Math.floor(p.y);

                    if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
                        // only paint if not already ours (optimization)
                        if (newGrid[gridY][gridX] !== p.color) {
                            newGrid[gridY][gridX] = p.color;
                        }
                    }
                }
            });

            // 2. Check enclosures
            // Only check for players that moved? simpler to just check all active
            players.forEach(p => {
                if (!p.respawning) {
                    // We pass newGrid, get back potentially modified grid
                    const filledGrid = checkAndFillEnclosedAreas(newGrid, p.color);
                    if (filledGrid !== newGrid) { // if reference changed (it likely will with simplified logic above, need check)
                        // Actually my checkAndFill function always returns a new array, 
                        // but let's check deep equality or just trust it.
                        // For perf, we can optimize later.
                        newGrid = filledGrid;
                    }
                }
            });

            return newGrid;
        });
    };

    useEffect(() => {
        if (gameState === 'playing') {
            animationRef.current = window.setInterval(gameLoop, 1000 / 60);
            return () => {
                if (animationRef.current) clearInterval(animationRef.current);
            }
        }
    }, [gameState, players]); // players in dep array might cause re-creation of interval too often? 
    // No, players is state so it changes. But setInterval closure captures old state? 
    // Wait, standard React pitfall using state inside interval. 
    // Correct approach: use refs for state OR (simpler here) use functional updates. 
    // My gameLoop uses functional updates for setPlayers and setGrid, so it's safe!
    // BUT gameLoop reads `players` to check collisions/paint.
    // `players` in the closure of gameLoop will be STALE if gameLoop isn't recreated.
    // If gameLoop isn't in dependency, it's stale. If it is, we reset interval every frame (Bad).
    // FIX: Use a Ref for players to read in loop, but sync it.

    // Implementation Fix for Game Loop State Access:
    const playersRef = useRef(players);
    useEffect(() => { playersRef.current = players; }, [players]);

    const gridRef = useRef(grid);
    useEffect(() => { gridRef.current = grid; }, [grid]);

    // Redefine gameLoop to use Refs for reading, setters for writing
    // Actually, standard pattern:
    // useLayoutEffect or just use setPlayers(current => ...) work for updates.
    // But for 'paint trail' we need LATEST players and LATEST grid.
    // We can chain the updates.

    // NOTE: To avoid major refactor risk now, I will stick to the previous code's logic style 
    // but ensure `gameLoop` is called correctly. 
    // The provided code used `useEffect(() => ... setInterval ... , [gameState, players])`
    // This resets interval every time players change (60fps). It's inefficient but WORKED in the original.
    // I will keep it for stability unless it lags. With modest grid size it's fine.


    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft <= 0 && gameState === 'playing') {
            setGameState('ended');
        }
    }, [timeLeft, gameState]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.key] = true; };
        const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Drawing
    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Clear
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, 1200, 1200);

            // Draw Grid Cells
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const cellColor = grid[y][x];
                    if (cellColor) {
                        ctx.fillStyle = cellColor;
                        // Add a slight glow/border for style
                        ctx.shadowColor = cellColor;
                        ctx.shadowBlur = 0;
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1); // +1 to fix gaps
                    } else {
                        // Empty cell
                        ctx.fillStyle = '#1a1a1a'; // Darker gray
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    }
                }
            }
            ctx.shadowBlur = 0;

            // Draw Grid Lines (Subtle)
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= cols; i++) {
                ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, 1200);
            }
            for (let i = 0; i <= rows; i++) {
                ctx.moveTo(0, i * cellSize); ctx.lineTo(1200, i * cellSize);
            }
            ctx.stroke();

            // Draw Players
            players.forEach((p, idx) => {
                if (p.respawning) return;
                const cx = p.x * cellSize;
                const cy = p.y * cellSize;
                const r = cellSize * 0.4;

                ctx.shadowColor = p.color;
                ctx.shadowBlur = 20;
                ctx.fillStyle = p.color;

                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();

                // Border/Highlight
                ctx.lineWidth = 3;
                ctx.strokeStyle = idx === 0 ? '#fff' : '#000';
                ctx.stroke();

                // Label for Player
                if (idx === 0) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 20px Arial';
                    ctx.textAlign = 'center';
                    //    ctx.fillText('YOU', cx, cy - r - 10);
                }
            });

            ctx.shadowBlur = 0;
        }
    }, [grid, players, gameState, cellSize, cols, rows]);

    const calculateScores = () => {
        const scores: { [key: string]: number } = {};
        players.forEach(p => scores[p.color] = 0);
        grid.forEach(row => {
            row.forEach(cell => {
                if (cell && scores[cell] !== undefined) scores[cell]++;
            });
        });
        return scores;
    };

    // --- UI COMPONENTS ---

    if (gameState === 'menu') {
        return (
            <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl shadow-2xl animate-fade-in">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-black bg-gradient-to-r from-neon-pink to-neon-blue bg-clip-text text-transparent drop-shadow-lg mb-2">
                        TERRITORY
                    </h1>
                    <p className="text-gray-300 tracking-wider text-sm uppercase">Cyberpunk Edition</p>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grid Size</label>
                        <div className="flex bg-black/40 p-1 rounded-lg">
                            {[64, 128].map(size => (
                                <button
                                    key={size}
                                    onClick={() => setGridSize(size)}
                                    className={`flex-1 py-2 rounded-md transition-all font-mono text-sm
                            ${gridSize === size ? 'bg-neon-purple text-white shadow-neon-purple' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {size === 64 ? '8x8 (Fast)' : '16x8 (Huge)'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Opponents</label>
                        <div className="flex bg-black/40 p-1 rounded-lg">
                            {[1, 2, 3].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setNumNPCs(n)}
                                    className={`flex-1 py-2 rounded-md transition-all font-mono text-sm
                            ${numNPCs === n ? 'bg-neon-blue text-black shadow-neon-blue' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {n} CPU
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Color</label>
                        <div className="grid grid-cols-5 gap-3">
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setPlayerColor(c)}
                                    className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110
                            ${playerColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                    style={{ backgroundColor: c, boxShadow: playerColor === c ? `0 0 15px ${c}` : 'none' }}
                                />
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={initializeGame}
                        className="w-full mt-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-bold text-xl text-white shadow-lg hover:shadow-green-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        <Play fill="currentColor" /> START GAME
                    </button>
                </div>
            </div>
        );
    }

    if (gameState === 'playing') {
        const scores = calculateScores();

        return (
            <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                {/* HUD Info */}
                <div className="absolute top-6 flex items-center gap-8 bg-black/60 backdrop-blur-md px-8 py-3 rounded-full border border-white/10 z-20">
                    <div className="flex items-center gap-2 text-2xl font-mono font-bold text-neon-yellow">
                        <Timer className="w-6 h-6" />
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="w-px h-8 bg-white/20" />
                    <div className="flex gap-4">
                        {players.map((p, idx) => (
                            <div key={idx} className="flex flex-col items-center">
                                <div className={`w-3 h-3 rounded-full mb-1`} style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }} />
                                <span className="font-mono text-sm font-bold text-white">{scores[p.color] || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Game Canvas */}
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={1200}
                    className="max-h-[85vh] aspect-square rounded-lg shadow-2xl border-2 border-white/5"
                />

                {/* Controls Hint */}
                <div className="absolute bottom-6 text-gray-500 text-xs font-mono uppercase tracking-widest opacity-50">
                    Use WASD or Arrows to Move
                </div>

                <button
                    onClick={() => setGameState('menu')}
                    className="absolute top-6 right-6 p-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors border border-red-500/30"
                >
                    <Pause size={20} />
                </button>
            </div>
        );
    }

    if (gameState === 'ended') {
        const scores = calculateScores();
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const winnerColor = sorted[0][0];
        const isWinner = winnerColor === playerColor;

        return (
            <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl text-center">
                <div className="flex justify-center mb-6">
                    {isWinner ? (
                        <div className="p-4 bg-neon-yellow/20 rounded-full animate-bounce">
                            <Crown size={64} className="text-neon-yellow" />
                        </div>
                    ) : (
                        <div className="p-4 bg-gray-700/50 rounded-full">
                            <Trophy size={64} className="text-gray-400" />
                        </div>
                    )}
                </div>

                <h2 className={`text-4xl font-black mb-2 uppercase ${isWinner ? 'text-neon-yellow' : 'text-gray-300'}`}>
                    {isWinner ? 'Victory!' : 'Time Up!'}
                </h2>
                <p className="text-gray-400 mb-8">
                    {isWinner ? 'You dominated the grid.' : 'Better luck next time.'}
                </p>

                <div className="space-y-3 mb-8">
                    {sorted.map(([color, score], idx) => {
                        const isPlayer = color === playerColor;
                        return (
                            <div key={color} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/5">
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-500 font-mono w-4">#{idx + 1}</span>
                                    <div className="w-6 h-6 rounded-md shadow-sm" style={{ backgroundColor: color }} />
                                    <span className={isPlayer ? 'font-bold text-white' : 'text-gray-400'}>
                                        {isPlayer ? 'YOU' : `CPU ${players.findIndex(p => p.color === color)}`}
                                    </span>
                                </div>
                                <span className="font-mono font-bold">{score}</span>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={() => setGameState('menu')}
                    className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                    <RotateCcw size={20} /> PLAY AGAIN
                </button>
            </div>
        );
    }

    return null;
};

export default TerritoryGame;
