import { Player } from './player.js';
import { BasicEnemy, FastEnemy, JumpingEnemy, IceBomberEnemy, ToughEnemy } from './enemy.js';
import { Platform, ExplosiveBlock } from './platform.js';
import { Particle } from './particle.js';

try {
    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isMobile) {
        document.body.classList.add('mobile');
    }

    const canvas = document.getElementById('game-canvas');
    if (!canvas) throw new Error("Canvas element not found!");
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context could not be created!");

    const bgMusic = document.getElementById('bg-music');
    const soundJump = document.getElementById('sound-jump');
    const soundExplosion = document.getElementById('sound-explosion');
    const soundLoseLife = document.getElementById('sound-lose-life');
    const soundGameOver = document.getElementById('sound-game-over');
    const soundPause = document.getElementById('sound-pause');
    let musicStarted = false;

    const GAME_WIDTH = 960;
    const GAME_HEIGHT = 720;
    const GRAVITY = 0.6;
    const JUMP_HOLD_GRAVITY = GRAVITY * 0.5;
    const PLAYER_SPEED = 5;
    const PLAYER_JUMP = -10;
    const ENEMY_SPEED = 1.0;
    const FLIP_DURATION = 5000;
    const HIGH_SCORE_KEY = 'retroArcadeHighScore';
    const LEVEL_TRANSITION_TIME = 1500;
    const EXPLOSIVE_BLOCK_USES = 3;
    const spawnPoints = [{ x: 150, y: 60 }, { x: GAME_WIDTH - 150, y: 60 }];

    let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0');
    let level = 1, players = [], enemies = [], platforms = [], particles = [], explosiveBlock;
    let keys = {}, gameState = 'playerSelect', levelTransitionTimer = 0, playerSelectOption = 1;

    function playSound(sound) {
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log("Audio play failed:", e));
        }
    }

    function resizeGame() {
        const container = document.getElementById('game-canvas-container');
        if (!container) return;
        const mainLayout = document.getElementById('main-layout');
        if(mainLayout) mainLayout.style.height = window.innerHeight + 'px';
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const aspectRatio = GAME_WIDTH / GAME_HEIGHT;
        let newWidth = containerWidth;
        let newHeight = newWidth / aspectRatio;
        if (newHeight > containerHeight) {
            newHeight = containerHeight;
            newWidth = newHeight * aspectRatio;
        }
        const gameContainer = document.getElementById('game-container');
        gameContainer.style.width = newWidth + 'px';
        gameContainer.style.height = newHeight + 'px';
    }

    const levelLayouts = [
        () => [new Platform(0, 550, 250), new Platform(GAME_WIDTH - 250, 550, 250), new Platform(300, 400, 360), new Platform(0, 250, 350), new Platform(GAME_WIDTH - 350, 250, 350)],
        () => [new Platform(0, 580, 200), new Platform(GAME_WIDTH - 200, 580, 200), new Platform(250, 450, 150), new Platform(GAME_WIDTH - 400, 450, 150), new Platform(0, 300, 200), new Platform(GAME_WIDTH - 200, 300, 200), new Platform(300, 180, 360)],
        () => [new Platform(0, 550, 200), new Platform(GAME_WIDTH - 200, 550, 200), new Platform(380, 400, 200).makeMobile(1, 100), new Platform(0, 250, 300), new Platform(GAME_WIDTH - 300, 250, 300)],
        () => [new Platform(0, 580, 150).makeMobile(1.2, 80), new Platform(GAME_WIDTH - 150, 580, 150).makeMobile(-1.2, 80), new Platform(300, 420, 360), new Platform(0, 250, 350).makeMobile(1.5, 150), new Platform(GAME_WIDTH - 350, 250, 350).makeMobile(-1.5, 150)],
    ];

    function startGame(numPlayers) {
        level = 1;
        players = [];
        const p1Controls = { left: 'a', right: 'd', jump: 'w' };
        players.push(new Player(1, p1Controls, '🤖'));
        if (numPlayers === 2) {
            const p2Controls = { left: 'arrowleft', right: 'arrowright', jump: 'arrowup' };
            players.push(new Player(2, p2Controls, '🧑‍🚀'));
        }
        explosiveBlock = new ExplosiveBlock(GAME_WIDTH, GAME_HEIGHT, EXPLOSIVE_BLOCK_USES);
        setupLevel(level);
        gameState = 'playing';
    }

    function setupLevel(levelNum) {
        const layoutIndex = Math.floor((levelNum - 1) / 4) % levelLayouts.length;
        platforms = [new Platform(0, GAME_HEIGHT - 40, GAME_WIDTH, 40, true), ...levelLayouts[layoutIndex]()];
        platforms.forEach(p => { p.isFrozen = false; });
        players.forEach(p => {
            if (!p.isDead) {
                p.resetPosition(GAME_WIDTH, GAME_HEIGHT);
            }
        });
        enemies = [];
        explosiveBlock.reset(GAME_HEIGHT);
        const finalLevel = Math.min(levelNum, 50);
        const enemyCount = 2 + Math.floor(finalLevel / 2);
        for (let i = 0; i < enemyCount; i++) {
            const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
            const x = spawnPoint.x, y = spawnPoint.y;
            let enemyType = Math.random();
            if (finalLevel >= 25 && enemyType < 0.15) { enemies.push(new ToughEnemy(x, y, ENEMY_SPEED)); }
            else if (finalLevel >= 20 && enemyType < 0.3) {
                const validPlatforms = platforms.filter(p => !p.isFloor && p.vx === 0 && !enemies.some(e => e instanceof IceBomberEnemy && e.platform === p));
                if (validPlatforms.length > 0) {
                    const platformForBomber = validPlatforms[Math.floor(Math.random() * validPlatforms.length)];
                    enemies.push(new IceBomberEnemy(0, 0, platformForBomber, enemies, particles));
                } else { enemies.push(new BasicEnemy(x, y, ENEMY_SPEED)); }
            }
            else if (finalLevel >= 10 && enemyType < 0.5) { enemies.push(new JumpingEnemy(x, y, ENEMY_SPEED)); }
            else if (finalLevel >= 5 && enemyType < 0.75) { enemies.push(new FastEnemy(x, y, ENEMY_SPEED)); }
            else { enemies.push(new BasicEnemy(x, y, ENEMY_SPEED)); }
        }
    }

    function update() {
        if (gameState === 'playing') {
            players.forEach(p => p.update(keys, GAME_WIDTH, PLAYER_SPEED, GRAVITY, JUMP_HOLD_GRAVITY, playSound, soundJump));
            enemies.forEach(e => e.update(platforms, spawnPoints, GAME_WIDTH, GRAVITY));
            platforms.forEach(p => p.update());
            explosiveBlock.update();
            handleCollisions();
            if (enemies.length === 0 && players.some(p => !p.isDead)) {
                level++;
                gameState = 'levelTransition';
                levelTransitionTimer = LEVEL_TRANSITION_TIME;
            }
        } else if (gameState === 'levelTransition') {
            levelTransitionTimer -= 1000 / 60;
            if (levelTransitionTimer <= 0) {
                setupLevel(level);
                gameState = 'playing';
            }
        }
        particles.forEach(p => p.update(GRAVITY));
        particles = particles.filter(p => p.life > 0);
    }

    function handleCollisions() {
        players.forEach(player => {
            if (player.isDead) return;
            const block = explosiveBlock;
            if (block.usesLeft > 0 && player.x < block.x + block.width && player.x + player.width > block.x && player.y + player.height >= block.y && player.y + player.height <= block.y + 10 + player.vy && player.vy >= 0) {
                player.y = block.y - player.height;
                player.vy = 0;
                player.onGround = true;
            }
            let onAnyPlatform = player.onGround;
            let isCurrentlyOnFrozenPlatform = false;
            platforms.forEach(p => {
                if (player.x < p.x + p.width && player.x + player.width > p.x && player.y + player.height >= p.y && player.y + player.height <= p.y + p.height + player.vy && player.vy >= 0) {
                    player.y = p.y - player.height;
                    player.vy = 0;
                    player.onGround = true;
                    onAnyPlatform = true;
                    if (p.isFrozen) isCurrentlyOnFrozenPlatform = true;
                    player.x += p.vx;
                }
                if (player.x < p.x + p.width && player.x + player.width > p.x && player.y > p.y && player.y <= p.y + p.height && player.vy < 0) {
                    player.y = p.y + p.height;
                    player.vy = 0;
                    const hitCenterX = player.x + player.width / 2;
                    enemies.forEach(enemy => {
                        const onThisPlatform = Math.abs((enemy.y + enemy.height) - p.y) < 10;
                        const withinHitRange = enemy.x < hitCenterX + 20 && (enemy.x + enemy.width) > hitCenterX - 20;
                        if (!enemy.isFlipped && onThisPlatform && withinHitRange) {
                            enemy.flip();
                            player.addScore(50);
                        }
                    });
                }
            });
            player.onGround = onAnyPlatform;
            player.onFrozenPlatform = isCurrentlyOnFrozenPlatform;
            if (player.x < block.x + block.width && player.x + player.width > block.x && player.y > block.y && player.y <= block.y + block.height && player.vy < 0) {
                player.y = block.y + block.height;
                player.vy = 0;
                block.hit(enemies, particles, playSound, soundExplosion);
            }
            enemies.forEach((enemy, index) => {
                if (player.x < enemy.x + enemy.width && player.x + player.width > enemy.x && player.y < enemy.y + enemy.height && player.y + player.height > enemy.y) {
                    if (enemy.isFlipped) {
                        enemies.splice(index, 1);
                        for (let i = 0; i < 20; i++) particles.push(new Particle(enemy.x, enemy.y, enemy.sprite));
                        player.addScore(200);
                    } else {
                        player.die(enemy.damage, particles, checkGameOver, playSound, soundLoseLife);
                    }
                }
            });
        });
        for (let i = 0; i < enemies.length; i++) {
            for (let j = i + 1; j < enemies.length; j++) {
                const e1 = enemies[i];
                const e2 = enemies[j];
                if (e1.x < e2.x + e2.width && e1.x + e1.width > e2.x && e1.y < e2.y + e2.height && e1.y + e1.height > e2.y) {
                    if (!e1.isFlipped && !e2.isFlipped && e1.onGround && e2.onGround) {
                        const tempVx = e1.vx;
                        e1.vx = e2.vx;
                        e2.vx = tempVx;
                        if (e1.x < e2.x) { e1.x -= 1; e2.x += 1; } else { e1.x += 1; e2.x -= 1; }
                    }
                }
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        if (gameState === 'playerSelect') { drawPlayerSelect(); }
        else {
            platforms.forEach(p => p.draw(ctx));
            explosiveBlock.draw(ctx);
            enemies.forEach(e => e.draw(ctx));
            players.forEach(p => p.draw(ctx));
            drawUI();
            if (gameState === 'paused') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
                ctx.fillStyle = 'white';
                ctx.font = '50px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText('PAUSED', GAME_WIDTH / 2, GAME_HEIGHT / 2);
            } else if (gameState === 'levelTransition') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
                ctx.fillStyle = 'white';
                ctx.font = '50px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText(`LEVEL ${level}`, GAME_WIDTH / 2, GAME_HEIGHT / 2);
            } else if (gameState === 'gameOver') {
                drawGameOver();
            }
        }
        particles.forEach(p => p.draw(ctx));
    }

    function drawUI() {
        ctx.font = '20px "Press Start 2P", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ff4136';
        ctx.fillText('P1 SCORE', 40, 30);
        ctx.fillStyle = 'white';
        ctx.fillText((players[0]?.score || 0).toString().padStart(6, '0'), 40, 60);

        if (players[0]) {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ff4136';
            ctx.fillText('HP', 40, 92);
            const p1 = players[0];
            const barWidth = 180;
            const hpPercentage = p1.hp / p1.maxHp;
            ctx.fillStyle = '#555';
            ctx.fillRect(85, 80, barWidth, 20);
            ctx.fillStyle = '#01FF70';
            ctx.fillRect(85, 80, barWidth * hpPercentage, 20);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(85, 80, barWidth, 20);
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4136';
        ctx.fillText('DraicorCoins', GAME_WIDTH / 2, 30);
        ctx.fillStyle = 'white';
        const totalScore = players.reduce((sum, p) => sum + (p.score || 0), 0);
        const formattedScore = '🪙 ' + totalScore.toLocaleString('en-US');
        ctx.fillText(formattedScore, GAME_WIDTH / 2, 60);

        if (players.length > 1 && players[1]) {
            const p2 = players[1];
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ff4136';
            ctx.fillText('HP', GAME_WIDTH - 225, 92)
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ff4136';
            ctx.fillText('P2 SCORE', GAME_WIDTH - 40, 30);
            ctx.fillStyle = 'white';
            ctx.fillText(p2.score.toString().padStart(6, '0'), GAME_WIDTH - 40, 60);
            const barWidth = 180;
            const hpPercentage = p2.hp / p2.maxHp;
            ctx.fillStyle = '#555';
            ctx.fillRect(GAME_WIDTH - 40 - barWidth, 80, barWidth, 20);
            ctx.fillStyle = '#01FF70';
            ctx.fillRect(GAME_WIDTH - 40 - barWidth, 80, barWidth * hpPercentage, 20);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(GAME_WIDTH - 40 - barWidth, 80, barWidth, 20);
        }
    }

    function drawPlayerSelect() {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4136';
        ctx.font = '80px "Press Start 2P"';
        ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2 + 5, GAME_HEIGHT / 2 - 150 + 5);
        ctx.fillStyle = '#ffdc00';
        ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150);
        if (isMobile) {
            ctx.fillStyle = 'white';
            ctx.font = '30px "Press Start 2P"';
            ctx.fillText('PRESS START TO PLAY', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
            ctx.fillStyle = 'white';
            ctx.font = '16px "Press Start 2P"';
            ctx.textAlign = 'left';
            ctx.fillText('Player Controls:', 50, GAME_HEIGHT - 230);
            ctx.textAlign = 'left';
            ctx.fillText('(◀) Left  (▶) Right  (A) Jump (B) Potion (B+A) Bombs', 50, GAME_HEIGHT - 200);
            ctx.textAlign = 'left';
            ctx.fillText('Start/Pause: (Start)', 50, GAME_HEIGHT - 170);
        } else {
            ctx.fillStyle = 'white';
            ctx.font = '40px "Press Start 2P"';
            ctx.fillText('SELECT PLAYERS', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
            ctx.font = '30px "Press Start 2P"';
            ctx.fillStyle = playerSelectOption === 1 ? '#ffdc00' : 'white';
            ctx.fillText('1 PLAYER', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
            ctx.fillStyle = playerSelectOption === 2 ? '#ffdc00' : 'white';
            ctx.fillText('2 PLAYERS', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90);
            ctx.font = '16px "Press Start 2P", sans-serif';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            ctx.fillText('Use Arrow Keys (🠙🠛) to select and Enter (↵) to start', 50, GAME_HEIGHT - 200);
            ctx.textAlign = 'left';
            ctx.fillText('Player Controls:', 50, GAME_HEIGHT - 160);
            ctx.textAlign = 'left';
            ctx.fillText('P1: (A) Left  (D) Right  (w) Jump (S) Potion (W+S) Bombs', 50, GAME_HEIGHT - 130);
            ctx.textAlign = 'left';
            ctx.fillText('P2: (🠘) Left  (🠚) Right  (🠙) Jump (🠛) Potion (🠙🠛) Bombs', 50, GAME_HEIGHT - 110);
            ctx.textAlign = 'left';
            ctx.fillText('Start/Pause: (↵) Enter', 50, GAME_HEIGHT - 90);
            ctx.textAlign = 'left';
            ctx.fillText('Gamepad supported via JoyToKey (free): joytokey.net/en', 50, GAME_HEIGHT - 50);
        }
    }

    function drawGameOver() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#ff4136';
        ctx.font = '60px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
        ctx.fillStyle = 'white';
        ctx.font = '20px "Press Start 2P"';
        ctx.fillText('Press Start to return to menu', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
    }

    function checkGameOver() {
        if (players.every(p => p.isDead)) {
            gameState = 'gameOver';
            playSound(soundGameOver);
            if (bgMusic) bgMusic.pause();
        }
    }

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    function handleStartPress() {
        if (gameState === 'playing') {
            gameState = 'paused';
            playSound(soundPause);
            if (bgMusic) bgMusic.pause();
        } else if (gameState === 'paused') {
            gameState = 'playing';
            playSound(soundPause);
            if (bgMusic) bgMusic.play();
        } else if (gameState === 'playerSelect') {
            const playersToStart = isMobile ? 1 : playerSelectOption;
            startGame(playersToStart);
            if (bgMusic) {
                bgMusic.currentTime = 0;
                bgMusic.play();
                musicStarted = true;
            }
        } else if (gameState === 'gameOver') {
            gameState = 'playerSelect';
        }
    }

    window.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();
        keys[key] = true;
        if (gameState === 'playing') {
            if (key === 'enter') handleStartPress();
        } else if (gameState === 'paused' && key === 'enter') {
            handleStartPress();
        } else if (gameState === 'playerSelect') {
            if (!isMobile) {
                if (key === 'arrowdown') playerSelectOption = 2;
                if (key === 'arrowup') playerSelectOption = 1;
            }
            if (key === 'enter') handleStartPress();
        } else if (gameState === 'gameOver' && key === 'enter') {
            handleStartPress();
        }
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    if (isMobile) {
        const dpadLeft = document.querySelector('#dpad-container .left');
        const dpadRight = document.querySelector('#dpad-container .right');
        const buttonA = document.getElementById('button-a');
        const startButtonTouch = document.getElementById('button-start-touch');

        if (dpadLeft && dpadRight && buttonA && startButtonTouch) {
            const vibrate = (duration) => {
                if (window.navigator.vibrate) {
                    window.navigator.vibrate(duration);
                }
            };
            dpadLeft.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(30); keys['a'] = true; });
            dpadLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['a'] = false; });
            dpadRight.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(30); keys['d'] = true; });
            dpadRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['d'] = false; });
            buttonA.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(50); keys['w'] = true; });
            buttonA.addEventListener('touchend', (e) => { e.preventDefault(); keys['w'] = false; });
            startButtonTouch.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(50); handleStartPress(); });
        }
    }

    window.addEventListener('load', () => {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
        resizeGame();
        gameLoop();
    });
    window.addEventListener('resize', resizeGame);

} catch (e) {
    console.error("FATAL ERROR:", e);
    document.body.innerHTML = `<div style="color: red; font-family: monospace; padding: 20px;"><h1>Error</h1><p>${e.message}</p><pre>${e.stack}</pre></div>`;
}

