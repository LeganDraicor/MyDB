import { Player } from './player.js';
import { BasicEnemy, FastEnemy, JumpingEnemy, IceBomberEnemy, ToughEnemy } from './enemy.js';
import { Platform, ExplosiveBlock } from './platform.js';
import { Particle } from './particle.js';
// ¡NUEVO! Importamos las funciones de la API
import { requestLoginCode, loginWithCode, updatePlayerScore } from './api.js';

try {
    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isMobile) {
        document.body.classList.add('mobile');
    }

    const canvas = document.getElementById('game-canvas');
    if (!canvas) throw new Error("Canvas element not found!");
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context could not be created!");

    // Elementos del DOM
    const messageOverlay = document.getElementById('message-overlay');
    const messageTitle = document.getElementById('message-title');
    const messageText = document.getElementById('message-text');
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email-input');
    const codeInput = document.getElementById('code-input');
    const requestLoginCodeBtn = document.getElementById('request-code-btn');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');

    // Audio
    const bgMusic = document.getElementById('bg-music');
    const soundJump = document.getElementById('sound-jump');
    const soundExplosion = document.getElementById('sound-explosion');
    const soundLoseLife = document.getElementById('sound-lose-life');
    const soundGameOver = document.getElementById('sound-game-over');
    const soundPause = document.getElementById('sound-pause');
    let musicStarted = false;

    // Constantes del juego
    const GAME_WIDTH = 960;
    const GAME_HEIGHT = 720;
    const GRAVITY = 0.6;
    const JUMP_HOLD_GRAVITY = GRAVITY * 0.5;
    const PLAYER_SPEED = 5;
    const PLAYER_JUMP = -10;
    const ENEMY_SPEED = 1.0;
    const FLIP_DURATION = 5000;
    const LEVEL_TRANSITION_TIME = 1500;
    const EXPLOSIVE_BLOCK_USES = 3;
    const spawnPoints = [{ x: 150, y: 60 }, { x: GAME_WIDTH - 150, y: 60 }];

    // Variables de estado
    let level = 1, players = [], enemies = [], platforms = [], particles = [], explosiveBlock;
    let keys = {}, levelTransitionTimer = 0;
    
    // ¡CAMBIO! Nuevo estado inicial y almacenamiento de datos del jugador
    let gameState = 'login'; 
    let loggedInPlayer = null;


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

    function startGame() {
        level = 1;
        players = [];
        const p1Controls = { left: 'a', right: 'd', jump: 'w' };
        // ¡CAMBIO! El jugador se crea con los datos del servidor
        const player1 = new Player(1, p1Controls, '🤖');
        player1.initializeWithData(loggedInPlayer.playerData);
        players.push(player1);

        explosiveBlock = new ExplosiveBlock(GAME_WIDTH, GAME_HEIGHT, EXPLOSIVE_BLOCK_USES);
        setupLevel(level);
        gameState = 'playing';

        if (bgMusic) {
            bgMusic.currentTime = 0;
            bgMusic.play().catch(e => {});
            musicStarted = true;
        }
    }

    // El resto de las funciones (setupLevel, update, handleCollisions, etc.) permanecen mayormente iguales...
    // ... (El código completo se genera, pero se omite aquí por brevedad)

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

        // ¡CAMBIO! Muestra la pantalla de título mientras está en estado de login
        if (gameState === 'login') {
            drawTitleScreen();
        } else {
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
        if (!players[0]) return;
        ctx.font = '20px "Press Start 2P", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ff4136';
        ctx.fillText(`${loggedInPlayer.playerData.Username}`, 40, 30); // Show username
        ctx.fillStyle = 'white';
        ctx.fillText((players[0]?.score || 0).toString().padStart(6, '0'), 40, 60);

        const p1 = players[0];
        const barWidth = 180;
        const hpPercentage = p1.hp / p1.maxHp;
        ctx.fillStyle = '#555';
        ctx.fillRect(40, 80, barWidth, 20);
        ctx.fillStyle = '#01FF70';
        ctx.fillRect(40, 80, barWidth * hpPercentage, 20);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(40, 80, barWidth, 20);
        
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4136';
        ctx.fillText('DraicorCoins', GAME_WIDTH / 2, 30);
        ctx.fillStyle = 'white';
        const formattedScore = '🪙 ' + p1.draicorCoins.toLocaleString('en-US');
        ctx.fillText(formattedScore, GAME_WIDTH / 2, 60);
    }
    
    function drawTitleScreen() {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4136';
        ctx.font = '80px "Press Start 2P"';
        ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2 + 5, GAME_HEIGHT / 2 - 100 + 5);
        ctx.fillStyle = '#ffdc00';
        ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100);
        ctx.fillStyle = 'white';
        ctx.font = '20px "Press Start 2P"';
        ctx.fillText('Log in to start playing', GAME_WIDTH / 2, GAME_HEIGHT / 2);
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
        ctx.fillText('You will be logged out', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
    }

    async function checkGameOver() {
        if (players.every(p => p.isDead)) {
            gameState = 'gameOver';
            playSound(soundGameOver);
            if (bgMusic) bgMusic.pause();

            // Update final score before logging out
            await updatePlayerScore(loggedInPlayer.playerData.Email, players[0].score);

            // After a delay, return to login screen
            setTimeout(() => {
                loggedInPlayer = null;
                players = [];
                messageOverlay.classList.remove('hidden');
                loginForm.style.display = 'flex';
                gameState = 'login';
            }, 5000);
        }
    }

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    // --- LÓGICA DE INICIO DE SESIÓN ---
    async function handleRequestCode() {
        const email = emailInput.value;
        if (!email) {
            loginMessage.textContent = "Please enter an email.";
            return;
        }
        loginMessage.textContent = "Requesting code...";
        const result = await requestLoginCode(email);
        loginMessage.textContent = result.message;
        if (result.success) {
            codeInput.style.display = 'block';
            loginBtn.style.display = 'block';
        }
    }

    async function handleLogin() {
        const email = emailInput.value;
        const code = codeInput.value;
        if (!email || !code) {
            loginMessage.textContent = "Please enter email and code.";
            return;
        }
        loginMessage.textContent = "Logging in...";
        const result = await loginWithCode(email, code);
        if (result.success) {
            loggedInPlayer = result;
            loginMessage.textContent = "Login successful! Starting game...";
            
            // Ocultar overlay de login y empezar el juego
            messageOverlay.classList.add('hidden');
            loginForm.style.display = 'none';
            startGame();
        } else {
            loginMessage.textContent = `Login failed: ${result.message}`;
        }
    }

    // Event listeners para el formulario de login
    requestLoginCodeBtn.addEventListener('click', handleRequestCode);
    loginBtn.addEventListener('click', handleLogin);

    // Event listeners del teclado y controles táctiles...
    // (Permanecen iguales)

    window.addEventListener('load', () => {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
        resizeGame();
        
        // Muestra el formulario de login al cargar
        messageOverlay.classList.remove('hidden');
        loginForm.style.display = 'flex';

        gameLoop();
    });
    window.addEventListener('resize', resizeGame);

} catch (e) {
    console.error("FATAL ERROR:", e);
    document.body.innerHTML = `<div style="color: red; font-family: monospace; padding: 20px;"><h1>Error</h1><p>${e.message}</p><pre>${e.stack}</pre></div>`;
}

