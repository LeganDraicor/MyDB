import { Player } from './player.js';
import { BasicEnemy, FastEnemy, JumpingEnemy, IceBomberEnemy, ToughEnemy } from './enemy.js';
import { Platform, ExplosiveBlock } from './platform.js';
import { Particle } from './particle.js';
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
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email-input');
    const codeInput = document.getElementById('code-input');
    const requestLoginCodeBtn = document.getElementById('request-code-btn');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');

    // Audio Elements
    const bgMusic = document.getElementById('bg-music');
    const soundJump = document.getElementById('sound-jump');
    const soundExplosion = document.getElementById('sound-explosion');
    const soundLoseLife = document.getElementById('sound-lose-life');
    const soundGameOver = document.getElementById('sound-game-over');
    const soundPause = document.getElementById('sound-pause');

    // Game Constants
    const GAME_WIDTH = 960;
    const GAME_HEIGHT = 720;
    // ... (other constants)

    // Game State
    let level = 1, players = [], enemies = [], platforms = [], particles = [], explosiveBlock;
    let keys = {}, gameState = 'login', loggedInPlayer = null;

    // --- Sound Controller ---
    function playSound(sound) {
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log("Audio play failed:", e));
        }
    }

    // --- Game Resize ---
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

    // --- Game Logic ---
    function startGame() {
        level = 1;
        players = [];
        const p1Controls = { left: 'a', right: 'd', jump: 'w' };
        // Create player with data from the server
        players.push(new Player(1, p1Controls, '🤖', loggedInPlayer.playerData));

        explosiveBlock = new ExplosiveBlock();
        setupLevel(level);
        gameState = 'playing';
        if (bgMusic) {
            bgMusic.currentTime = 0;
            bgMusic.play();
        }
    }

    function setupLevel(levelNum) {
       // ... (setupLevel code remains the same)
    }

    function update() {
        if (gameState === 'login') {
            // Logic is handled by UI events, nothing to update here
            return;
        }
        if (gameState === 'playing') {
            players.forEach(p => p.update());
            enemies.forEach(e => e.update());
            platforms.forEach(p => p.update());
            explosiveBlock.update();
            handleCollisions();
            if (enemies.length === 0 && players.some(p => !p.isDead)) {
                level++;
                gameState = 'levelTransition';
                // ...
            }
        }
        // ... (other game states update)
        particles.forEach(p => p.update());
        particles = particles.filter(p => p.life > 0);
    }
    
    function handleCollisions() {
        // ... (handleCollisions code remains the same)
    }

    // --- Drawing Functions ---
    function draw() {
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // ¡CAMBIO! Si estamos en login, solo dibuja un fondo negro y no hagas nada más.
        if (gameState === 'login') {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            return; 
        }

        platforms.forEach(p => p.draw());
        explosiveBlock.draw();
        enemies.forEach(e => e.draw());
        players.forEach(p => p.draw());
        drawUI();

        if (gameState === 'paused' || gameState === 'levelTransition' || gameState === 'gameOver') {
            // ... (drawing for these states remains the same)
        }
        particles.forEach(p => p.draw());
    }

    function drawUI() {
        //... (drawUI code remains the same, but now uses loggedInPlayer data)
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ff4136';
        ctx.fillText(loggedInPlayer.playerData.Username || 'PLAYER 1', 40, 30);
        // ... (rest of the UI drawing)
    }
    
    async function checkGameOver() {
        if (players.every(p => p.isDead)) {
            gameState = 'gameOver';
            playSound(soundGameOver);
            if (bgMusic) bgMusic.pause();

            // Guardar el puntaje
            await updatePlayerScore(loggedInPlayer.playerData.Email, players[0].score);

            setTimeout(() => {
                loggedInPlayer = null;
                players = [];
                messageOverlay.style.display = 'flex';
                loginForm.style.display = 'flex';
                gameState = 'login';
            }, 5000);
        }
    }

    // --- Login Handlers ---
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
            requestLoginCodeBtn.style.display = 'none';
        }
    }

    async function handleLogin() {
        const email = emailInput.value;
        const code = codeInput.value;
        if (!code) {
            loginMessage.textContent = "Please enter the code.";
            return;
        }
        loginMessage.textContent = "Logging in...";
        const result = await loginWithCode(email, code);

        if (result.success) {
            loggedInPlayer = result;
            loginMessage.textContent = "Login successful! Starting game...";
            messageOverlay.style.display = 'none';
            startGame();
        } else {
            loginMessage.textContent = `Login failed: ${result.message}`;
        }
    }

    // --- Event Listeners ---
    requestLoginCodeBtn.addEventListener('click', handleRequestCode);
    loginBtn.addEventListener('click', handleLogin);
    // ... (rest of event listeners)

    // --- Game Initialization ---
    window.addEventListener('load', () => {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
        resizeGame();
        
        messageOverlay.style.display = 'flex';
        loginForm.style.display = 'flex';
        
        gameLoop();
    });

    window.addEventListener('resize', resizeGame);

} catch (e) {
    console.error("FATAL ERROR:", e);
    document.body.innerHTML = `<div style="color: red; font-family: monospace; padding: 20px;"><h1>Error</h1><p>${e.message}</p><pre>${e.stack}</pre></div>`;
}

