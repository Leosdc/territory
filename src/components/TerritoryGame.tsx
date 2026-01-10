import { useState, useEffect, useRef } from 'react';
import { Play, Crown, Timer, Zap, Snowflake, RefreshCw } from 'lucide-react';

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

type PowerUpType = 'SWAP' | 'SPEED' | 'FREEZE' | 'BOMB';

interface PowerUp {
    id: string;
    x: number;
    y: number;
    type: PowerUpType;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    life: number;
    maxLife: number;
}

interface Player {
    x: number;
    y: number;
    color: string;
    isPlayer: boolean;
    baseSpeed: number; // Store base speed
    currentSpeed: number; // Actual speed (affected by powerups)
    vx: number;
    vy: number;
    respawning: boolean;
    respawnTimer: number;
    // NPC
    changeDirectionTimer?: number;
    frozen?: boolean; // NPC freeze status
    freezeTimer?: number;
    // PowerUp Effects
    speedTimer?: number;
}

const TerritoryGame = () => {
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'ended'>('menu');
    const [gridSize, setGridSize] = useState(32);
    const [numNPCs, setNumNPCs] = useState(1);
    const [difficulty, setDifficulty] = useState<'normal' | 'insane'>('normal');
    const [gameDuration] = useState(60);
    const [playerColor, setPlayerColor] = useState(COLORS[1]);
    const [playerName] = useState('YOU');
    const [timeLeft, setTimeLeft] = useState(60);
    const [messages, setMessages] = useState<{ id: number, text: string, color: string }[]>([]);
    const [showTutorial, setShowTutorial] = useState(false);

    const [grid, setGrid] = useState<(string | null)[][]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [powerUps, setPowerUps] = useState<PowerUp[]>([]);

    const [activeEffects, setActiveEffects] = useState<string[]>([]); // For UI feedback

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const keysPressed = useRef<{ [key: string]: boolean }>({});

    // Mobile touch controls
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [touchCurrent, setTouchCurrent] = useState<{ x: number; y: number } | null>(null);

    // Dynamic Camera Viewport
    const [camera, setCamera] = useState({ x: 0, y: 0 });

    // Map Constants
    // For giant maps, we keep cells reasonable visual size
    const VISUAL_CELL_SIZE = 40;
    // But we need to limit canvas size? No, canvas is fixed viewport size (e.g. window size).
    // We'll calculate viewport relative to player.

    const cols = gridSize;
    const rows = gridSize;

    const spawnPositions = [
        { x: 5, y: 5 },
        { x: cols - 6, y: 5 },
        { x: 5, y: rows - 6 },
        { x: cols - 6, y: rows - 6 }
    ];

    const initializeGame = () => {
        const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(null));

        const availableColors = COLORS.filter(c => c !== playerColor);
        const shuffled = [...availableColors].sort(() => 0.5 - Math.random());

        const newPlayers: Player[] = [
            {
                x: spawnPositions[0].x,
                y: spawnPositions[0].y,
                color: playerColor,
                isPlayer: true,
                baseSpeed: 0.15,
                currentSpeed: 0.15,
                vx: 0,
                vy: 0,
                respawning: false,
                respawnTimer: 0
            }
        ];

        for (let i = 0; i < numNPCs; i++) {
            const posIndex = (i + 1) % spawnPositions.length;
            const color = shuffled[i % shuffled.length];

            // Insane mode: NPCs are MUCH faster and more aggressive
            const npcSpeed = difficulty === 'insane' ? 0.18 : 0.12;

            // NPCs start with random direction
            const directions = [{ vx: 1, vy: 0 }, { vx: -1, vy: 0 }, { vx: 0, vy: 1 }, { vx: 0, vy: -1 }, { vx: 1, vy: 1 }, { vx: -1, vy: 1 }, { vx: 1, vy: -1 }, { vx: -1, vy: -1 }];
            const randomDir = directions[Math.floor(Math.random() * directions.length)];

            newPlayers.push({
                x: spawnPositions[posIndex].x,
                y: spawnPositions[posIndex].y,
                color: color,
                isPlayer: false,
                baseSpeed: npcSpeed,
                currentSpeed: npcSpeed,
                vx: randomDir.vx,
                vy: randomDir.vy,
                changeDirectionTimer: 30 + Math.random() * 30,
                respawning: false,
                respawnTimer: 0
            });
        }

        // Initial Safe Zone Paint
        newPlayers.forEach(p => {
            const cx = Math.floor(p.x);
            const cy = Math.floor(p.y);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (cy + dy >= 0 && cy + dy < rows && cx + dx >= 0 && cx + dx < cols) {
                        newGrid[cy + dy][cx + dx] = p.color;
                    }
                }
            }
        });

        setGrid(newGrid);
        setPlayers(newPlayers);
        setPowerUps([]);
        setActiveEffects([]);
        setTimeLeft(gameDuration);
        setGameState('playing');
    };

    const particlesRef = useRef<Particle[]>([]);

    const spawnParticles = (x: number, y: number, c1: string, c2: string) => {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.2 + 0.05;
            particlesRef.current.push({
                id: Math.random(),
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: Math.random() > 0.5 ? c1 : c2,
                life: 1.0,
                maxLife: 1.0
            });
        }
    };

    // --- POWER UP UTILS ---
    const spawnPowerUp = () => {
        // 5% chance per second called externally? Or simpler logic.
        // Let's just spawn one if count < 3 every few seconds.
        if (Math.random() > 0.3) return; // 30% success when attempted

        const types: PowerUpType[] = ['SWAP', 'SPEED', 'FREEZE', 'BOMB'];
        const type = types[Math.floor(Math.random() * types.length)];

        // Random position
        const x = Math.floor(Math.random() * (cols - 2)) + 1;
        const y = Math.floor(Math.random() * (rows - 2)) + 1;

        setPowerUps(prev => [
            ...prev,
            { id: Math.random().toString(), x: x + 0.5, y: y + 0.5, type }
        ]);
    };

    useEffect(() => {
        if (gameState !== 'playing') return;
        // Powerup Spawner Loop
        const interval = setInterval(() => {
            if (powerUps.length < 5) {
                spawnPowerUp();
            }
        }, 3000); // Try every 3 seconds
        return () => clearInterval(interval);
    }, [gameState, powerUps.length]); // Dependency ok

    const applyPowerUp = (type: PowerUpType, playerIdx: number) => {
        const player = players[playerIdx];
        const me = player.isPlayer; // Only show UI effects for human
        const newEffects = [...activeEffects];

        switch (type) {
            case 'SPEED':
                // Handled in state update, but here we just trigger
                // Actual logic is inside gameLoop updater
                if (me && !newEffects.includes('SPEED')) setActiveEffects([...newEffects, 'SPEED']);
                break;

            case 'FREEZE':
                // Freeze stats for ALL NPCs
                // Logic in gameLoop
                if (me) setActiveEffects([...newEffects, 'FREEZE']);
                break;

            case 'BOMB':
                // Flood fill circle
                setGrid(prev => {
                    const ng = prev.map(r => [...r]);
                    const r = 4; // Radius
                    const cx = Math.floor(player.x);
                    const cy = Math.floor(player.y);

                    for (let y = cy - r; y <= cy + r; y++) {
                        for (let x = cx - r; x <= cx + r; x++) {
                            if (y >= 0 && y < rows && x >= 0 && x < cols) {
                                if (Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) <= r) {
                                    ng[y][x] = player.color;
                                }
                            }
                        }
                    }
                    return ng;
                });
                break;

            case 'SWAP':
                // Swap territories with random opponent
                setGrid(prev => {
                    // Start finding opponents
                    const opponents = players.filter(p => p.color !== player.color && !p.respawning);
                    if (opponents.length === 0) return prev;

                    // Improved Targeting: 
                    // 1. If I am NPC, target PLAYER if he has high score or just generally target PLAYER in Insane
                    // 2. Or target the LEADER
                    let target: Player | undefined;

                    // Score calculation to find leader
                    const scores: Record<string, number> = {};
                    players.forEach(p => scores[p.color] = 0);
                    prev.forEach(r => r.forEach(c => { if (c && scores[c] !== undefined) scores[c]++; }));

                    const sorted = opponents.sort((a, b) => (scores[b.color] || 0) - (scores[a.color] || 0));
                    const leader = sorted[0];

                    if (difficulty === 'insane' && !me) {
                        // High chance to target player if player is doing well or just simply target player
                        const playerUser = players.find(p => p.isPlayer);
                        if (playerUser && !playerUser.respawning && Math.random() < 0.7) {
                            target = playerUser;
                        } else {
                            target = leader;
                        }
                    } else {
                        // Normal mode: Random or Leader
                        if (Math.random() < 0.5) target = leader;
                        else target = opponents[Math.floor(Math.random() * opponents.length)];
                    }

                    if (!target) target = opponents[Math.floor(Math.random() * opponents.length)];

                    const myColor = player.color;
                    const targetColor = target.color;

                    // Notification
                    if (me) addMessage(`You swapped with ${target.isPlayer ? 'YOURSELF?!' : 'Bot'}!`, '#00ffff');
                    else if (target.isPlayer) addMessage(`SWAPPED! Bot stole your territory!`, '#ff0055');

                    // FULL GRID SWAP (Expensive but fun)
                    const ng = prev.map(r => r.map(c => {
                        if (c === myColor) return targetColor;
                        if (c === targetColor) return myColor;
                        return c;
                    }));
                    return ng;
                });
                if (me) setActiveEffects([...newEffects, 'SWAP']);
                break;
        }


        // --- GAME LOGIC ---

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
                respawnTimer: 120,
                currentSpeed: player.baseSpeed, // Reset speed
                speedTimer: 0,
                frozen: false
            };
        };

        const checkAndFillEnclosedAreas = (currentGrid: (string | null)[][], ownerColor: string) => {
            const newGrid = currentGrid.map(row => [...row]);
            const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));

            // Optimized flood fill
            const floodFill = (sx: number, sy: number) => {
                const stack = [[sx, sy]];
                const region = [];
                let touchesBorder = false;

                while (stack.length) {
                    const [x, y] = stack.pop()!;
                    if (x < 0 || x >= cols || y < 0 || y >= rows) { touchesBorder = true; continue; }
                    if (visited[y][x] || newGrid[y][x] === ownerColor) continue;

                    visited[y][x] = true;
                    region.push([x, y]);

                    if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) touchesBorder = true;

                    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                        stack.push([x + dx, y + dy]);
                    });
                }
                return { region, touchesBorder };
            };

            // Only scan relevant areas? For giant maps scaning 256x256 every frame is BAD.
            // OPTIMIZATION: Only scan around player?
            // User requested giant maps. Full scan 65k cells at 60fps is questionable.
            // Compromise: Run fill logic only every 10 frames OR only on a smaller window around player.
            // BUT capture must be global. 
            // Let's rely on JS speed for now, it handles 1M ops fine usually. 256*256 = 65k. Fast enough.

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    if (!visited[y][x] && newGrid[y][x] !== ownerColor) {
                        const { region, touchesBorder } = floodFill(x, y);
                        if (!touchesBorder && region.length > 0) {
                            region.forEach(([rx, ry]) => { newGrid[ry][rx] = ownerColor; });
                        }
                    }
                }
            }
            return newGrid;
        };

        const updateNPCDirection = (npc: Player, currentGrid: (string | null)[][]) => {
            if (npc.frozen) return;
            if (!npc.changeDirectionTimer) npc.changeDirectionTimer = 0;
            npc.changeDirectionTimer--;

            if (npc.changeDirectionTimer <= 0) {
                // INSANE MODE: NPCs are OBSESSED with power-ups (95% chance vs 70%)
                const powerUpChance = difficulty === 'insane' ? 0.95 : 0.3;
                if (powerUps.length > 0 && Math.random() > (1 - powerUpChance)) {
                    const nearest = powerUps.reduce((closest, pu) => {
                        const dist = Math.sqrt((npc.x - pu.x) ** 2 + (npc.y - pu.y) ** 2);
                        const closestDist = Math.sqrt((npc.x - closest.x) ** 2 + (npc.y - closest.y) ** 2);
                        return dist < closestDist ? pu : closest;
                    });

                    // Move towards power-up (diagonal movement)
                    const dx = nearest.x - npc.x;
                    const dy = nearest.y - npc.y;

                    npc.vx = dx > 0.5 ? 1 : dx < -0.5 ? -1 : 0;
                    npc.vy = dy > 0.5 ? 1 : dy < -0.5 ? -1 : 0;
                    npc.changeDirectionTimer = difficulty === 'insane' ? 5 : 10; // INSANE: Re-evaluate VERY quickly
                } else {
                    // Strategic movement: Try to form rectangles/enclosed areas
                    const currentCell = currentGrid[Math.floor(npc.y)]?.[Math.floor(npc.x)];
                    const isOnMyTerritory = currentCell === npc.color;

                    // If on own territory, try to expand outward in a consistent direction
                    if (isOnMyTerritory) {
                        // Continue in same direction to form lines/rectangles
                        if (npc.vx !== 0 || npc.vy !== 0) {
                            const nextX = Math.floor(npc.x + npc.vx);
                            const nextY = Math.floor(npc.y + npc.vy);
                            const nextCell = currentGrid[nextY]?.[nextX];

                            // Keep going if next cell is empty or enemy territory
                            if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows &&
                                (nextCell === null || nextCell !== npc.color)) {
                                // Continue in same direction
                                const lineLength = difficulty === 'insane' ? 40 : 30; // INSANE: Longer lines
                                npc.changeDirectionTimer = lineLength + Math.random() * 10;
                                return;
                            }
                        }

                        // Turn 90 degrees to form rectangle
                        if (Math.random() > 0.5) {
                            const temp = npc.vx;
                            npc.vx = npc.vy;
                            npc.vy = temp;
                        } else {
                            const temp = npc.vx;
                            npc.vx = -npc.vy;
                            npc.vy = -temp;
                        }
                    } else {
                        // Not on own territory - move with purpose (diagonal allowed)
                        const options = [
                            { vx: 1, vy: 0 }, { vx: -1, vy: 0 }, { vx: 0, vy: 1 }, { vx: 0, vy: -1 },
                            { vx: 1, vy: 1 }, { vx: 1, vy: -1 }, { vx: -1, vy: 1 }, { vx: -1, vy: -1 }
                        ];

                        // Prefer directions that lead to empty space or back to own territory
                        const scoredOptions = options.map(dir => {
                            const lookAhead = difficulty === 'insane' ? 5 : 3; // INSANE: Look further ahead
                            const newX = Math.floor(npc.x + dir.vx * lookAhead);
                            const newY = Math.floor(npc.y + dir.vy * lookAhead);
                            if (newX < 0 || newX >= cols || newY < 0 || newY >= rows) return { ...dir, score: -100 };

                            const targetCell = currentGrid[newY]?.[newX];
                            let score = 0;
                            if (targetCell === null) score = 10; // Empty space is good
                            if (targetCell === npc.color) score = 5; // Own territory is ok
                            // INSANE MODE: AGGRESSIVELY target enemy territory
                            if (difficulty === 'insane') {
                                if (targetCell && targetCell !== npc.color) score = 15; // ATTACK!
                            } else {
                                if (targetCell && targetCell !== npc.color) score = -5; // Enemy territory is bad
                            }

                            return { ...dir, score };
                        });

                        scoredOptions.sort((a, b) => b.score - a.score);
                        const best = scoredOptions[0];

                        if (best.score > -100) {
                            npc.vx = best.vx;
                            npc.vy = best.vy;
                        }
                    }

                    const timerRange = difficulty === 'insane' ? 15 : 25; // INSANE: Change direction more often
                    npc.changeDirectionTimer = timerRange + Math.random() * timerRange;
                }
            }
        };

        const gameLoop = () => {
            setPlayers(prevPlayers => {
                // Create deep copy to mutate
                let newPlayers = prevPlayers.map(p => ({ ...p }));

                // 1. Update Effects/Timers
                newPlayers.forEach(p => {
                    // Respawn
                    if (p.respawning) {
                        p.respawnTimer--;
                        if (p.respawnTimer <= 0) p.respawning = false;
                    }

                    // Speed Boost
                    if (p.speedTimer && p.speedTimer > 0) {
                        p.speedTimer--;
                        p.currentSpeed = p.baseSpeed * 2;
                        if (p.speedTimer <= 0) p.currentSpeed = p.baseSpeed;
                    }

                    // Freeze Status
                    if (p.frozen && p.freezeTimer && p.freezeTimer > 0) {
                        p.freezeTimer--;
                        p.vx = 0;
                        p.vy = 0;
                        if (p.freezeTimer <= 0) p.frozen = false;
                    }
                });

                // 2. Player Input (Keyboard + Touch)
                if (newPlayers[0] && !newPlayers[0].respawning) {
                    const player = newPlayers[0];
                    player.vx = 0; player.vy = 0;

                    // Touch controls (mobile)
                    if (touchStart && touchCurrent) {
                        const dx = touchCurrent.x - touchStart.x;
                        const dy = touchCurrent.y - touchStart.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance > 20) { // Minimum distance to register movement
                            const angle = Math.atan2(dy, dx);
                            // Convert angle to 8-directional movement
                            const dir = Math.round(angle / (Math.PI / 4));
                            if (dir === 0 || dir === 4 || dir === -4) player.vx = 1;
                            if (dir === 2 || dir === -2) player.vx = -1;
                            if (dir === 1 || dir === 2) player.vy = 1;
                            if (dir === -1 || dir === -2) player.vy = -1;
                        }
                    }

                    // Keyboard controls (desktop)
                    if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) player.vy = -1;
                    else if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) player.vy = 1;
                    if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) player.vx = -1;
                    else if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) player.vx = 1;
                }

                // 3. NPC AI
                newPlayers.forEach(p => {
                    if (!p.isPlayer && !p.respawning) updateNPCDirection(p, grid);
                });

                // 4. Movement & PowerUp Pickup
                newPlayers.forEach((p, idx) => {
                    if (!p.respawning && (p.vx !== 0 || p.vy !== 0) && !p.frozen) {
                        p.x += p.vx * p.currentSpeed;
                        p.y += p.vy * p.currentSpeed;
                        p.x = Math.max(0.5, Math.min(cols - 0.5, p.x));
                        p.y = Math.max(0.5, Math.min(rows - 0.5, p.y));

                        // Check PowerUp Pickup
                        setPowerUps(currentPowerUps => {
                            const remaining = [];
                            let picked = false;
                            for (const pu of currentPowerUps) {
                                const dx = p.x - pu.x;
                                const dy = p.y - pu.y;
                                if (Math.sqrt(dx * dx + dy * dy) < 0.8) {
                                    // PICKUP!
                                    picked = true;

                                    // Apply Logic
                                    // If SPEED -> Apply to SELF
                                    // If FREEZE -> Apply to ENEMIES
                                    // If SWAP -> Apply global
                                    // If BOMB -> Apply global

                                    if (pu.type === 'SPEED') {
                                        p.speedTimer = 300; // 5s
                                        if (p.isPlayer) setActiveEffects(prev => [...prev.filter(e => e !== 'SPEED'), 'SPEED']);
                                    } else if (pu.type === 'FREEZE') {
                                        // Freeze OTHERS
                                        newPlayers.forEach((other, oIdx) => {
                                            if (oIdx !== idx) {
                                                other.frozen = true;
                                                other.freezeTimer = 300;
                                            }
                                        });
                                        if (p.isPlayer) setActiveEffects(prev => [...prev.filter(e => e !== 'FREEZE'), 'FREEZE']);
                                    } else {
                                        // Immediate effects
                                        applyPowerUp(pu.type, idx);
                                    }

                                } else {
                                    remaining.push(pu);
                                }
                            }
                            return picked ? remaining : currentPowerUps;
                        });
                    }
                });

                // 5. Collisions
                for (let i = 0; i < newPlayers.length; i++) {
                    for (let j = i + 1; j < newPlayers.length; j++) {
                        if (checkCollision(newPlayers[i], newPlayers[j])) {
                            // Spawn Particles
                            const p1 = newPlayers[i];
                            const p2 = newPlayers[j];
                            const cx = (p1.x + p2.x) / 2;
                            const cy = (p1.y + p2.y) / 2;

                            spawnParticles(cx, cy, p1.color, p2.color);

                            // Chat / Kill Log
                            if (p1.isPlayer || p2.isPlayer) {
                                const killer = p1.isPlayer ? p1 : p2; // Actually we don't know who killed who, usually both die
                                // But let's pretend both die.
                                addMessage(TRASH_TALK.kill[Math.floor(Math.random() * TRASH_TALK.kill.length)], '#ff0000');
                            }

                            newPlayers[i] = respawnPlayer(newPlayers[i], i);
                            newPlayers[j] = respawnPlayer(newPlayers[j], j);
                        }
                    }
                }

                // INSANE MODE CHEATS
                if (difficulty === 'insane' && gameState === 'playing' && Math.random() < 0.005) { // Small chance per frame
                    const bot = newPlayers.find(p => !p.isPlayer && !p.respawning);
                    if (bot) {
                        const cheatType = Math.random();
                        if (cheatType < 0.4) {
                            // SPEED HACK
                            bot.currentSpeed *= 3;
                            bot.speedTimer = 120; // 2s
                            addMessage("⚠ HACKER DETECTED: Speed Override", "#ff0000");
                        } else if (cheatType < 0.7) {
                            // TELEPORT
                            bot.x = players[0].x + (Math.random() - 0.5) * 10;
                            bot.y = players[0].y + (Math.random() - 0.5) * 10;
                            addMessage("⚠ HACKER DETECTED: Illegal Teleport", "#ff0000");
                        } else {
                            // STEAL
                            // We can't easily modify grid here, but we can signal it via a special property or Ref?
                            // Or just skip grid mod here to avoid complexity in this heavy loop.
                            // Let's settle for Speed and Teleport for now inside this loop.
                            addMessage("⚠ HACKER DETECTED: Aim Assist", "#ff0000");
                        }
                    }
                }

                return newPlayers;
            });

            // Grid Updates
            setGrid(prevGrid => {
                let newGrid = prevGrid.map(row => [...row]);

                players.forEach(p => {
                    if (!p.respawning) {
                        const gridX = Math.floor(p.x);
                        const gridY = Math.floor(p.y);
                        if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
                            // ALWAYS paint where you walk, even if it's already captured
                            newGrid[gridY][gridX] = p.color;
                        }
                    }
                });

                // Enclosure Check (Global) - Expensive but necessary for mechanics
                players.forEach(p => {
                    if (!p.respawning) {
                        // Only run if player has moved enough to potentially close loop? 
                        // For simplicity, run always.
                        newGrid = checkAndFillEnclosedAreas(newGrid, p.color);
                    }
                });

                return newGrid;
            });
        };

        // Particle Loop (Visual only, decoupled from logic state to avoid re-renders? No, needs render to draw)
        // Actually, we can draw from Ref directly in canvas loop to avoid React render cycle for particles!
        // This is much more performant.

        useEffect(() => {
            if (gameState === 'playing') {
                const interval = setInterval(() => {
                    // Update particles
                    if (particlesRef.current.length > 0) {
                        particlesRef.current = particlesRef.current.map(p => ({
                            ...p,
                            x: p.x + p.vx,
                            y: p.y + p.vy,
                            life: p.life - 0.02
                        })).filter(p => p.life > 0);
                    }
                }, 16);
                return () => clearInterval(interval);
            }
        }, [gameState]);

        // --- RENDERING & LOOP ---

        useEffect(() => {
            if (gameState === 'playing') {
                animationRef.current = window.setInterval(gameLoop, 1000 / 60);
                return () => { if (animationRef.current) clearInterval(animationRef.current); }
            }
        }, [gameState, players, powerUps]); // Need to include powerUps/players for closure freshness or use Refs?
        // Using Refs for state in loop is better practice for performance, 
        // but sticking to useEffect re-binding for safety with this architecture.
        // Note: High frequency re-binding might be jittery. Ideally use useLayoutEffect or refs.
        // Given "Giant Map" requirement, I'll trust standard React batching for now.

        const playersRef = useRef(players);
        useEffect(() => { playersRef.current = players; }, [players]);


        useEffect(() => {
            // Camera Follow Logic
            if (players[0] && canvasRef.current) {
                const p = players[0];

                // Center player. 
                // Viewport is let's say window size.
                // We want pivot at center.
                const cx = window.innerWidth / 2;
                const cy = window.innerHeight / 2;

                const px = p.x * VISUAL_CELL_SIZE;
                const py = p.y * VISUAL_CELL_SIZE;

                setCamera({
                    x: cx - px,
                    y: cy - py
                });
            }
        }, [players]);

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

        // Canvas Resize Handler
        useEffect(() => {
            const handleResize = () => {
                if (canvasRef.current) {
                    canvasRef.current.width = window.innerWidth;
                    canvasRef.current.height = window.innerHeight;
                }
            };

            handleResize(); // Set initial size
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }, []);

        // Timer
        useEffect(() => {
            if (gameState === 'playing' && timeLeft > 0) {
                const timer = setTimeout(() => {
                    setTimeLeft(t => t - 1);
                    // Auto remove effects from UI every sec just to be safe/simple
                    setActiveEffects([]);
                    // Wait, that clears icons instantly. Ideally we track timer. 
                    // Let's just not clear, and let them be there. 
                }, 1000);
                return () => clearTimeout(timer);
            } else if (timeLeft <= 0 && gameState === 'playing') {
                setGameState('ended');
            }
        }, [timeLeft, gameState]);


        // CANVAS DRAW
        useEffect(() => {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (!ctx) return;

                // Canvas Setup (Full Window)
                const W = window.innerWidth;
                const H = window.innerHeight;
                canvasRef.current.width = W;
                canvasRef.current.height = H;

                // Background
                ctx.fillStyle = '#050505';
                ctx.fillRect(0, 0, W, H);

                ctx.save();
                // APLLY CAMERA
                ctx.translate(camera.x, camera.y);

                // Draw Visible Grid Logic (Culling)
                // Viewport in World Coords:
                // -camera.x to -camera.x + W
                const startCol = Math.max(0, Math.floor(-camera.x / VISUAL_CELL_SIZE));
                const endCol = Math.min(cols, Math.ceil((-camera.x + W) / VISUAL_CELL_SIZE));
                const startRow = Math.max(0, Math.floor(-camera.y / VISUAL_CELL_SIZE));
                const endRow = Math.min(rows, Math.ceil((-camera.y + H) / VISUAL_CELL_SIZE));

                // Draw World Border
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 4;
                ctx.strokeRect(0, 0, cols * VISUAL_CELL_SIZE, rows * VISUAL_CELL_SIZE);

                for (let y = startRow; y < endRow; y++) {
                    for (let x = startCol; x < endCol; x++) {
                        const cellColor = grid[y][x];
                        const px = x * VISUAL_CELL_SIZE;
                        const py = y * VISUAL_CELL_SIZE;

                        if (cellColor) {
                            ctx.fillStyle = cellColor;
                            // Simplify glow for giant maps performance
                            // ctx.shadowColor = cellColor; ctx.shadowBlur = 10; 
                            ctx.fillRect(px, py, VISUAL_CELL_SIZE, VISUAL_CELL_SIZE);
                            // ctx.shadowBlur = 0;
                        } else {
                            ctx.fillStyle = '#111'; // Empty
                            ctx.fillRect(px, py, VISUAL_CELL_SIZE, VISUAL_CELL_SIZE);
                            // Grid lines
                            ctx.strokeStyle = '#222';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(px, py, VISUAL_CELL_SIZE, VISUAL_CELL_SIZE);
                        }
                    }
                }

                // Draw PowerUps with Lucide-style icons
                powerUps.forEach(pu => {
                    const px = pu.x * VISUAL_CELL_SIZE;
                    const py = pu.y * VISUAL_CELL_SIZE;

                    // Draw glowing background
                    ctx.fillStyle = '#ffffff22';
                    ctx.beginPath();
                    ctx.arc(px, py, VISUAL_CELL_SIZE * 0.45, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw icon background
                    ctx.fillStyle = pu.type === 'SWAP' ? '#00FFFF' :
                        pu.type === 'SPEED' ? '#FFCC00' :
                            pu.type === 'FREEZE' ? '#00FF99' : '#FF0055';
                    ctx.beginPath();
                    ctx.arc(px, py, VISUAL_CELL_SIZE * 0.35, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw icon symbol
                    ctx.fillStyle = '#000';
                    ctx.font = `bold ${VISUAL_CELL_SIZE * 0.5}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const symbol = pu.type === 'SWAP' ? '⇄' :
                        pu.type === 'SPEED' ? '⚡' :
                            pu.type === 'FREEZE' ? '❄' : '💥';
                    ctx.fillText(symbol, px, py + 2);
                });

                // Draw Players
                players.forEach((p, idx) => {
                    if (p.respawning) return;
                    const cx = p.x * VISUAL_CELL_SIZE;
                    const cy = p.y * VISUAL_CELL_SIZE;
                    const r = VISUAL_CELL_SIZE * 0.4;

                    ctx.shadowColor = p.color;
                    ctx.shadowBlur = 15;
                    ctx.fillStyle = p.color;

                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#fff';
                    ctx.stroke();

                    // Name/Arrow
                    if (idx === 0) {
                        ctx.fillStyle = 'white';
                        ctx.font = '12px Arial';
                        ctx.fillText('YOU', cx, cy - r - 5);
                    }
                });

                // Draw Particles
                particlesRef.current.forEach(p => {
                    const px = p.x * VISUAL_CELL_SIZE;
                    const py = p.y * VISUAL_CELL_SIZE;
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(px, py, VISUAL_CELL_SIZE * 0.2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                });

                ctx.restore();
            }
        }, [grid, players, gameState, camera, powerUps]);


        // --- UI ---
        const calculateScores = () => {
            const scores: { [key: string]: number } = {};
            players.forEach(p => scores[p.color] = 0);
            grid.forEach(row => { row.forEach(cell => { if (cell && scores[cell] !== undefined) scores[cell]++; }); });
            return scores;
        };

        if (gameState === 'menu') {
            return (
                <div className="relative z-10 w-full max-w-lg bg-black/90 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl animate-fade-in text-center max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex-1"></div>
                        <Crown size={48} className="mx-auto text-neon-yellow animate-pulse md:w-16 md:h-16" />
                        <button onClick={() => setShowTutorial(true)}
                            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all flex-1 flex justify-end">
                            <HelpCircle size={24} className="text-white" />
                        </button>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-neon-pink to-neon-blue bg-clip-text text-transparent mb-2 drop-shadow-2xl tracking-tighter">
                        NEON WARS
                    </h1>
                    <p className="text-gray-400 mb-6 uppercase tracking-widest font-bold text-xs md:text-base">Territory Conquest</p>

                    <div className="space-y-4 text-left">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Map Size</label>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                                {[8, 16, 32].map(s => (
                                    <button key={s} onClick={() => setGridSize(s)}
                                        className={`py-2 md:py-3 rounded-xl font-mono text-xs md:text-sm font-bold border transition-all
                         ${gridSize === s ? 'bg-neon-purple border-neon-purple text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600'}`}>
                                        {s}x{s}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {[64, 128, 256].map(s => (
                                    <button key={s} onClick={() => setGridSize(s)}
                                        className={`py-3 rounded-xl font-mono text-sm font-bold border transition-all
                         ${gridSize === s ? 'bg-neon-purple border-neon-purple text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600'}`}>
                                        {s}x{s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Enemies</label>
                            <div className="flex gap-2 mt-1">
                                {[1, 2, 3].map(n => (
                                    <button key={n} onClick={() => setNumNPCs(n)}
                                        className={`flex-1 py-3 rounded-xl font-mono text-sm font-bold border transition-all
                         ${numNPCs === n ? 'bg-neon-blue border-neon-blue text-black' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600'}`}>
                                        {n} BOTS
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Difficulty</label>
                            <div className="flex gap-2 mt-1">
                                <button onClick={() => setDifficulty('normal')}
                                    className={`flex-1 py-3 rounded-xl font-mono text-sm font-bold border transition-all ${difficulty === 'normal' ? 'bg-neon-green border-neon-green text-black' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600'}`}>
                                    NORMAL
                                </button>
                                <button onClick={() => setDifficulty('insane')}
                                    className={`flex-1 py-3 rounded-xl font-mono text-sm font-bold border transition-all ${difficulty === 'insane' ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600'}`}>
                                    🔥 INSANE
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Color Class</label>
                            <div className="flex justify-between gap-2 mt-1">
                                {COLORS.slice(0, 5).map(c => (
                                    <button key={c} onClick={() => setPlayerColor(c)}
                                        className={`w-12 h-12 rounded-full border-4 transition-transform hover:scale-110 ${playerColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40'}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>

                        <button onClick={initializeGame}
                            className="w-full mt-4 py-4 md:py-5 sticky bottom-0 bg-white text-black font-black text-xl md:text-2xl rounded-2xl hover:bg-gray-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl z-20">
                            <Play className="fill-black" size={24} /> <span className="tracking-tighter">DEPLOY</span>
                        </button>
                    </div>
                </div>
            );
        }

        if (gameState === 'playing') {
            const scores = calculateScores();
            return (
                <div className="fixed inset-0 overflow-hidden bg-black">
                    {/* HUD */}
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 pointer-events-none select-none">
                        <div className="flex items-center gap-2 text-2xl font-black text-white font-mono">
                            <Timer className="text-neon-yellow" />
                            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                        <div className="h-8 w-px bg-white/20"></div>
                        <div className="flex gap-4">
                            {players.map((p, idx) => (
                                <div key={idx} className="flex flex-col items-center">
                                    <div className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}` }} />
                                    <span className="text-xs font-bold font-mono text-white">{scores[p.color] || 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pause/Exit Buttons */}
                    <div className="absolute top-8 right-8 flex gap-2 z-50">
                        <button onClick={() => setGameState('paused')}
                            className="p-3 bg-black/70 backdrop-blur-md rounded-full border border-white/30 hover:bg-white/20 transition-all">
                            <RefreshCw size={20} className="text-white" />
                        </button>
                        <button onClick={() => { setGameState('menu'); setTimeLeft(gameDuration); }}
                            className="p-3 bg-black/70 backdrop-blur-md rounded-full border border-red-500/50 hover:bg-red-500/30 transition-all">
                            <Crown size={20} className="text-red-400" />
                        </button>
                    </div>

                    {/* Active Effects */}
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 flex gap-2">
                        {players[0]?.currentSpeed > 0.15 && <div className="p-2 bg-neon-green/20 rounded-lg border border-neon-green/50 animate-pulse"><Zap size={20} className="text-neon-green" /></div>}
                        {players.some(p => !p.isPlayer && p.frozen) && <div className="p-2 bg-neon-blue/20 rounded-lg border border-neon-blue/50 animate-pulse"><Snowflake size={20} className="text-neon-blue" /></div>}
                    </div>

                    {/* Chat Overlay */}
                    <div className="absolute bottom-4 left-4 z-40 flex flex-col items-start space-y-2 pointer-events-none w-96">
                        {messages.map(msg => (
                            <div key={msg.id} className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border-l-4 border-white/50 text-white font-mono text-sm font-bold shadow-lg animate-fade-in-up">
                                <span style={{ color: msg.color }}>{msg.text}</span>
                            </div>
                        ))}
                    </div>

                    <canvas
                        ref={canvasRef}
                        className="block"
                        onTouchStart={(e) => {
                            const touch = e.touches[0];
                            setTouchStart({ x: touch.clientX, y: touch.clientY });
                            setTouchCurrent({ x: touch.clientX, y: touch.clientY });
                        }}
                        onTouchMove={(e) => {
                            if (touchStart) {
                                const touch = e.touches[0];
                                setTouchCurrent({ x: touch.clientX, y: touch.clientY });
                            }
                        }}
                        onTouchEnd={() => {
                            setTouchStart(null);
                            setTouchCurrent(null);
                        }}
                    />

                    {/* Mobile Joystick */}
                    {touchStart && touchCurrent && (
                        <div className="absolute pointer-events-none">
                            <div className="absolute w-32 h-32 rounded-full bg-white/10 border-4 border-white/30"
                                style={{ left: touchStart.x - 64, top: touchStart.y - 64 }} />
                            <div className="absolute w-16 h-16 rounded-full bg-white/50 border-4 border-white"
                                style={{ left: touchCurrent.x - 32, top: touchCurrent.y - 32 }} />
                        </div>
                    )}

                    {/* Minimap Hint? No, too complex. Just coordinate hint? */}
                    <div className="absolute bottom-4 right-4 text-white/20 font-mono text-xs">
                        Pos: {Math.floor(players[0]?.x)}, {Math.floor(players[0]?.y)}
                    </div>
                </div>
            );
        }

        return (
            <div className="relative z-10 bg-black/90 backdrop-blur border border-white/10 p-10 rounded-3xl text-center max-w-md w-full">
                <Crown size={64} className="mx-auto mb-6 text-neon-yellow animate-bounce" />
                <h2 className="text-4xl font-black text-white mb-2">GAME OVER</h2>
                <div className="bg-white/5 rounded-xl p-4 my-6 space-y-2">
                    {Object.entries(calculateScores()).sort((a, b) => b[1] - a[1]).map(([color, score], idx) => {
                        const isPlayer = color === playerColor;
                        const playerLabel = isPlayer ? playerName : `BOT ${idx}`;
                        return (
                            <div key={color} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-gray-500">#{idx + 1}</span>
                                    <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                                    <span className="text-sm font-bold text-white">{playerLabel}</span>
                                </div>
                                <span className="font-bold font-mono text-white">{score}</span>
                            </div>
                        );
                    })}
                </div>
                <button onClick={() => setGameState('menu')}
                    className="w-full py-4 bg-neon-blue text-black font-bold rounded-xl hover:bg-white transition-colors flex items-center justify-center gap-2">
                    <RefreshCw /> PLAY AGAIN
                </button>
            </div>
        );

        // Tutorial Modal
        if (showTutorial) {
            return (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-3xl font-black text-white">📖 COMO JOGAR</h2>
                            <button onClick={() => setShowTutorial(false)}
                                className="p-2 rounded-full hover:bg-white/10 transition-all">
                                <Crown size={24} className="text-white" />
                            </button>
                        </div>

                        <div className="space-y-6 text-left">
                            <div>
                                <h3 className="text-xl font-bold text-neon-yellow mb-2">🎯 Objetivo</h3>
                                <p className="text-gray-300">Conquiste o máximo de território possível! Pinte células do mapa com sua cor movendo-se pelo grid. Quem tiver mais território ao final do tempo vence!</p>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-neon-blue mb-2">🎮 Controles</h3>
                                <p className="text-gray-300 mb-2"><strong>Desktop:</strong> Use WASD ou setas do teclado para mover</p>
                                <p className="text-gray-300"><strong>Mobile:</strong> Toque e arraste na tela para criar um joystick virtual</p>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-neon-purple mb-2">⚡ Power-Ups</h3>
                                <div className="space-y-2 text-gray-300">
                                    <p>• <strong>⇄ SWAP:</strong> Troca posição com um inimigo aleatório</p>
                                    <p>• <strong>⚡ SPEED:</strong> Dobra sua velocidade temporariamente</p>
                                    <p>• <strong>❄ FREEZE:</strong> Congela todos os inimigos por alguns segundos</p>
                                    <p>• <strong>💥 BOMB:</strong> Destrói território inimigo ao redor</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-neon-green mb-2">💡 Dicas</h3>
                                <div className="space-y-1 text-gray-300">
                                    <p>• Pinte constantemente para expandir seu território</p>
                                    <p>• Busque power-ups para vantagem estratégica</p>
                                    <p>• No modo INSANE, os bots são muito mais agressivos!</p>
                                    <p>• Mapas menores = partidas mais rápidas e intensas</p>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => setShowTutorial(false)}
                            className="w-full mt-6 py-3 bg-neon-yellow text-black font-bold rounded-xl hover:bg-white transition-all">
                            ENTENDI! VAMOS JOGAR 🚀
                        </button>
                    </div>
                </div>
            );
        }
    };

    export default TerritoryGame;
