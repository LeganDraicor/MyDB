import { requestLoginCode, loginWithCode } from './api.js';
import { Player } from './player.js';
import { BasicEnemy, FastEnemy, JumpingEnemy, IceBomberEnemy, ToughEnemy } from './enemy.js';
import { Platform } from './platform.js';
import { Particle } from './particle.js';

try {
    // --- STATE & DOM ELEMENTS ---
    let gameState = 'login';
    let playerData = null;
    
    const loginView = document.getElementById('login-view');
    const gameView = document.getElementById('game-view');
    const emailInput = document.getElementById('email-input');
    const codeInput = document.getElementById('code-input');
    const requestLoginCodeBtn = document.getElementById('request-code-btn');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    
    // --- LOGIN LOGIC ---
    function showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
        const viewToShow = document.getElementById(viewId);
        if (viewToShow) {
            viewToShow.style.display = 'flex';
        }
    }

    async function handleRequestCode() {
        const email = emailInput.value;
        if (!email) {
            loginMessage.textContent = "Please enter an email.";
            return;
        }

        const recaptchaToken = grecaptcha.getResponse();
        if (!recaptchaToken) {
            loginMessage.textContent = "Please complete the reCAPTCHA.";
            return;
        }

        loginMessage.textContent = "Requesting code...";
        requestLoginCodeBtn.disabled = true;
        
        const result = await requestLoginCode(email, recaptchaToken);
        
        loginMessage.textContent = result.message;
        
        if (result.success) {
            codeInput.style.display = 'block';
            loginBtn.style.display = 'block';
            requestLoginCodeBtn.style.display = 'none';
        } else {
             requestLoginCodeBtn.disabled = false;
             grecaptcha.reset();
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
        loginBtn.disabled = true;
        
        const result = await loginWithCode(email, code);

        if (result.success) {
            loginMessage.textContent = "Success! Loading game...";
            playerData = result.playerData;
            sessionStorage.setItem('draicor_bros_token', result.token);
            
            setTimeout(() => {
                showView('game-view');
                initializeGameAndStart();
            }, 1000);

        } else {
            loginMessage.textContent = `Login failed: ${result.message}`;
            loginBtn.disabled = false;
            grecaptcha.reset();
        }
    }
    
    // --- GAME LOGIC ---
    let canvas, ctx, players, enemies, platforms, particles, explosiveBlock, keys;
    let level, highScore, musicStarted, playerSelectOption, levelTransitionTimer;

    const GAME_WIDTH = 960, GAME_HEIGHT = 720, GRAVITY = 0.6, PLAYER_SPEED = 5;
    const PLAYER_JUMP = -10, JUMP_HOLD_GRAVITY = GRAVITY * 0.5, ENEMY_SPEED = 1.0;
    const FLIP_DURATION = 5000, LEVEL_TRANSITION_TIME = 1500, EXPLOSIVE_BLOCK_USES = 3;
    const HIGH_SCORE_KEY = 'retroArcadeHighScore_local';
    const spawnPoints = [{ x: 150, y: 60 },{ x: GAME_WIDTH - 150, y: 60 }];

    let bgMusic, soundJump, soundExplosion, soundLoseLife, soundGameOver, soundPause;

    function initializeGameAndStart() {
        canvas = document.getElementById('game-canvas');
        if (!canvas) throw new Error("Canvas element not found!");
        ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context could not be created!");

        bgMusic = document.getElementById('bg-music');
        soundJump = document.getElementById('sound-jump');
        soundExplosion = document.getElementById('sound-explosion');
        soundLoseLife = document.getElementById('sound-lose-life');
        soundGameOver = document.getElementById('sound-game-over');
        soundPause = document.getElementById('sound-pause');
        musicStarted = false;

        keys = {};
        players = [];
        enemies = [];
        platforms = [];
        particles = [];
        level = 1;
        playerSelectOption = 1; 
        highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0');
        
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (isMobile) {
            document.body.classList.add('mobile');
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        if (isMobile) setupTouchControls();

        resizeGame();
        window.addEventListener('resize', resizeGame);
        
        gameState = 'playerSelect'; 
        
        gameLoop();
    }
    
    function playSound(sound) {
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log("Audio play failed:", e));
        }
    }
    
    function resizeGame() {
        if (!canvas) return;
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
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

    class ExplosiveBlock {
        constructor() { this.width = 50; this.initialHeight = 50; this.height = this.initialHeight; this.x = GAME_WIDTH / 2 - this.width / 2; this.y = GAME_HEIGHT - 180; this.usesLeft = EXPLOSIVE_BLOCK_USES; this.cooldown = 0; }
        draw() {
            if (this.usesLeft <= 0) return;
            ctx.save();
            if (this.cooldown > 0) ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#ff4136';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.globalAlpha = 1.0;
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = '15px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const baseVerticalScale = this.height / this.initialHeight;
            let finalVerticalScale = baseVerticalScale;
            if (this.usesLeft === EXPLOSIVE_BLOCK_USES) {
                finalVerticalScale *= 2.0;
            }
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.scale(1, finalVerticalScale);
            ctx.fillText('POW', 0, 1);
            ctx.restore();
            ctx.restore();
        }
        update() { if (this.cooldown > 0) this.cooldown -= 1000 / 60; }
        hit() { if (this.usesLeft > 0 && this.cooldown <= 0) { this.usesLeft--; this.cooldown = 500; playSound(soundExplosion); enemies.forEach(e => e.flip()); for (let i = 0; i < 50; i++) { particles.push(new Particle(this.x + this.width / 2, this.y, '💥')); } const flattenAmount = this.initialHeight / EXPLOSIVE_BLOCK_USES; this.height -= flattenAmount; this.y += flattenAmount; } }
        reset() { this.usesLeft = EXPLOSIVE_BLOCK_USES; this.height = this.initialHeight; this.y = GAME_HEIGHT - 180; }
    }

    const levelLayouts = [
        () => [new Platform(0, 550, 250), new Platform(GAME_WIDTH - 250, 550, 250), new Platform(300, 400, 360), new Platform(0, 250, 350), new Platform(GAME_WIDTH - 350, 250, 350),],
        () => [new Platform(0, 580, 200), new Platform(GAME_WIDTH - 200, 580, 200), new Platform(250, 450, 150), new Platform(GAME_WIDTH - 400, 450, 150), new Platform(0, 300, 200), new Platform(GAME_WIDTH - 200, 300, 200), new Platform(300, 180, 360),],
        () => [new Platform(0, 550, 200), new Platform(GAME_WIDTH - 200, 550, 200), new Platform(380, 400, 200).makeMobile(1, 100), new Platform(0, 250, 300), new Platform(GAME_WIDTH - 300, 250, 300),],
        () => [new Platform(0, 580, 150).makeMobile(1.2, 80), new Platform(GAME_WIDTH - 150, 580, 150).makeMobile(-1.2, 80), new Platform(300, 420, 360), new Platform(0, 250, 350).makeMobile(1.5, 150), new Platform(GAME_WIDTH - 350, 250, 350).makeMobile(-1.5, 150),],
    ];

    function startGame(numPlayers) {
        level = 1; 
        players = []; 
        const p1Controls = { left: 'a', right: 'd', jump: 'w' }; 
        players.push(new Player(1, p1Controls, '🤖', playerData));
        if (numPlayers === 2) { 
            const p2Controls = { left: 'arrowleft', right: 'arrowright', jump: 'arrowup' }; 
            const p2Data = { Username: "Player 2", HP_Max: 1000, Attack: 1, Defense: 1, DraicorCoins: 0 };
            players.push(new Player(2, p2Controls, '🧑‍🚀', p2Data)); 
        }
        explosiveBlock = new ExplosiveBlock(); 
        setupLevel(level); 
        gameState = 'playing';
        if (bgMusic && !musicStarted) {
            bgMusic.currentTime = 0;
            bgMusic.play();
            musicStarted = true;
        }
    }

    function setupLevel(levelNum) {
        const layoutIndex = Math.floor((levelNum - 1) / 4) % levelLayouts.length;
        platforms = [new Platform(0, GAME_HEIGHT - 40, GAME_WIDTH, 40, true), ...levelLayouts[layoutIndex](),];
        platforms.forEach(p => { p.isFrozen = false; });
        players.forEach(p => { if (!p.isDead) { p.resetPosition(); } });
        enemies = []; 
        if (explosiveBlock) explosiveBlock.reset();
        const finalLevel = Math.min(levelNum, 50); 
        const enemyCount = 2 + Math.floor(finalLevel / 2);
        for (let i = 0; i < enemyCount; i++) {
            const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)]; const x = spawnPoint.x; const y = spawnPoint.y; let enemyType = Math.random();
            if (finalLevel >= 25 && enemyType < 0.15) { enemies.push(new ToughEnemy(x, y)); }
            else if (finalLevel >= 20 && enemyType < 0.3) {
                const validPlatforms = platforms.filter(p => !p.isFloor && p.vx === 0 && !enemies.some(e => e instanceof IceBomberEnemy && e.platform === p));
                if (validPlatforms.length > 0) { const platformForBomber = validPlatforms[Math.floor(Math.random() * validPlatforms.length)]; enemies.push(new IceBomberEnemy(0, 0, platformForBomber)); } else { enemies.push(new BasicEnemy(x, y)); }
            } else if (finalLevel >= 10 && enemyType < 0.5) { enemies.push(new JumpingEnemy(x, y)); }
            else if (finalLevel >= 5 && enemyType < 0.75) { enemies.push(new FastEnemy(x, y)); }
            else { enemies.push(new BasicEnemy(x, y)); }
        }
    }

    function update() {
        if (gameState === 'playing') {
            players.forEach(p => p.update(keys)); 
            enemies.forEach(e => e.update(platforms)); 
            platforms.forEach(p => p.update()); 
            if (explosiveBlock) explosiveBlock.update(); 
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
        particles.forEach(p => p.update()); 
        particles = particles.filter(p => p.life > 0);
    }

    function handleCollisions() {
        players.forEach(player => {
            if (player.isDead) return;
            const block = explosiveBlock; 
            if (block && block.usesLeft > 0 && player.x < block.x + block.width && player.x + player.width > block.x && player.y + player.height >= block.y && player.y + player.height <= block.y + 10 + player.vy && player.vy >= 0) { player.y = block.y - player.height; player.vy = 0; player.onGround = true; }
            let onAnyPlatform = false; 
            let isCurrentlyOnFrozenPlatform = false;
            platforms.forEach(p => {
                if (player.x < p.x + p.width && player.x + player.width > p.x && player.y + player.height >= p.y && player.y + player.height <= p.y + p.height + (player.vy > 0 ? player.vy : 2) && player.vy >= 0) { player.y = p.y - player.height; player.vy = 0; onAnyPlatform = true; if (p.isFrozen) isCurrentlyOnFrozenPlatform = true; player.x += p.vx; }
                if (player.x < p.x + p.width && player.x + player.width > p.x && player.y > p.y && player.y <= p.y + p.height && player.vy < 0) { player.y = p.y + p.height; player.vy = 0; const hitCenterX = player.x + player.width / 2; enemies.forEach(enemy => { const onThisPlatform = Math.abs((enemy.y + enemy.height) - p.y) < 10; const withinHitRange = enemy.x < hitCenterX + 20 && (enemy.x + enemy.width) > hitCenterX - 20; if (!enemy.isFlipped && onThisPlatform && withinHitRange) { enemy.flip(); player.addScore(50, updateHighScore); } }); }
            });
            player.onGround = onAnyPlatform; 
            player.onFrozenPlatform = isCurrentlyOnFrozenPlatform;
            if (block && player.x < block.x + block.width && player.x + player.width > block.x && player.y > block.y && player.y <= block.y + block.height && player.vy < 0) { player.y = block.y + block.height; player.vy = 0; block.hit(); }
            enemies.forEach((enemy, index) => { 
                if (player.x < enemy.x + enemy.width && player.x + player.width > enemy.x && player.y < enemy.y + enemy.height && player.y + player.height > enemy.y) { 
                    if (enemy.isFlipped) { 
                        enemies.splice(index, 1); 
                        for (let i = 0; i < 20; i++) particles.push(new Particle(enemy.x, enemy.y, enemy.sprite)); 
                        player.addScore(200, updateHighScore); 
                    } else { 
                        player.die(enemy.damage, particles, Particle, checkGameOver, playSound, soundLoseLife); 
                    } 
                } 
            });
        });
        for (let i = 0; i < enemies.length; i++) { for (let j = i + 1; j < enemies.length; j++) { const e1 = enemies[i]; const e2 = enemies[j]; if (e1.x < e2.x + e2.width && e1.x + e1.width > e2.x && e1.y < e2.y + e2.height && e1.y + e1.height > e2.y) { if (!e1.isFlipped && !e2.isFlipped && e1.onGround && e2.onGround) { const tempVx = e1.vx; e1.vx = e2.vx; e2.vx = tempVx; if (e1.x < e2.x) { e1.x -= 1; e2.x += 1; } else { e1.x += 1; e2.x -= 1; } } } } }
    }
    
    function updateHighScore(score) {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem(HIGH_SCORE_KEY, highScore.toString());
        }
    }

    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        if (gameState === 'playerSelect') { 
            drawPlayerSelect(); 
        } else if (gameState === 'playing' || gameState === 'paused' || gameState === 'levelTransition' || gameState === 'gameOver') {
            platforms.forEach(p => p.draw(ctx)); 
            if (explosiveBlock) explosiveBlock.draw(); 
            enemies.forEach(e => e.draw(ctx)); 
            players.forEach(p => p.draw(ctx));
            drawUI();
            if (gameState === 'paused') { ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); ctx.fillStyle = 'white'; ctx.font = '50px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', GAME_WIDTH / 2, GAME_HEIGHT / 2); }
            else if (gameState === 'levelTransition') { ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); ctx.fillStyle = 'white'; ctx.font = '50px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText(`LEVEL ${level}`, GAME_WIDTH / 2, GAME_HEIGHT / 2); }
            else if (gameState === 'gameOver') { drawGameOver(); }
        }
        particles.forEach(p => p.draw(ctx));
    }

    function drawUI() {
        ctx.font = '20px "Press Start 2P", sans-serif';
        if (players[0]) {
            const p1 = players[0];
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ff4136';
            ctx.fillText(p1.username, 40, 30);
            ctx.fillStyle = 'white';
            ctx.fillText((p1.score || 0).toString().padStart(6, '0'), 40, 60);
            ctx.fillStyle = '#ff4136';
            ctx.fillText('HP', 40, 92);
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
        ctx.fillText('HI-SCORE', GAME_WIDTH / 2, 30);
        ctx.fillStyle = 'white';
        ctx.fillText(highScore.toString().padStart(6, '0'), GAME_WIDTH / 2, 60);

        if (players.length > 1 && players[1]) {
            const p2 = players[1];
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ff4136';
            ctx.fillText('P2 SCORE', GAME_WIDTH - 40, 30);
            ctx.fillStyle = 'white';
            ctx.fillText(p2.score.toString().padStart(6, '0'), GAME_WIDTH - 40, 60);
            ctx.fillStyle = '#ff4136';
            ctx.fillText('HP', GAME_WIDTH - 225, 92)
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
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        ctx.textAlign = 'center'; ctx.fillStyle = '#ff4136'; ctx.font = '80px "Press Start 2P"'; ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2 + 5, GAME_HEIGHT / 2 - 150 + 5);
        ctx.fillStyle = '#ffdc00'; ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150);
        if (isMobile) {
            ctx.fillStyle = 'white'; ctx.font = '30px "Press Start 2P"';
            ctx.fillText('PRESS START TO PLAY', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
        } else {
            ctx.fillStyle = 'white'; ctx.font = '40px "Press Start 2P"'; ctx.fillText('SELECT PLAYERS', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
            ctx.font = '30px "Press Start 2P"'; ctx.fillStyle = playerSelectOption === 1 ? '#ffdc00' : 'white'; ctx.fillText('1 PLAYER', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
            ctx.fillStyle = playerSelectOption === 2 ? '#ffdc00' : 'white'; ctx.fillText('2 PLAYERS', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90);
        }
    }

    function drawGameOver() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#ff4136'; ctx.font = '60px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
        ctx.fillStyle = 'white'; ctx.font = '20px "Press Start 2P"'; ctx.fillText('Press Start to return to menu', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
    }
    
    function checkGameOver() { 
        if (players.every(p => p.isDead)) { 
            gameState = 'gameOver'; 
            playSound(soundGameOver);
            if(bgMusic) bgMusic.pause();
        } 
    }
    
    function handleStartPress() {
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (gameState === 'playing') { 
            gameState = 'paused'; 
            playSound(soundPause);
            if(bgMusic) bgMusic.pause();
        }
        else if (gameState === 'paused') { 
            gameState = 'playing'; 
            playSound(soundPause);
            if(bgMusic) bgMusic.play();
        }
        else if (gameState === 'playerSelect') { 
            const playersToStart = isMobile ? 1 : playerSelectOption;
            startGame(playersToStart);
        }
        else if (gameState === 'gameOver') { 
            gameState = 'playerSelect'; 
            players.forEach(p => { p.isDead = false; p.hp = p.maxHp; p.score = 0; });
            musicStarted = false;
        }
    }
    
    function handleKeyDown(e) {
        const key = e.key.toLowerCase();
        keys[key] = true;
        if (gameState === 'playing') {
            if (key === 'enter') handleStartPress();
        } else if (gameState === 'paused' && key === 'enter') {
            handleStartPress();
        } else if (gameState === 'playerSelect') {
            const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            if (!isMobile) {
                if (key === 'arrowdown') playerSelectOption = 2;
                if (key === 'arrowup') playerSelectOption = 1;
            }
            if (key === 'enter') handleStartPress();
        } else if (gameState === 'gameOver' && key === 'enter') {
            handleStartPress();
        }
    }
    
    function handleKeyUp(e) { keys[e.key.toLowerCase()] = false; }
    
    function setupTouchControls() {
        const dpadLeft = document.querySelector('#dpad-container .left');
        const dpadRight = document.querySelector('#dpad-container .right');
        const buttonA = document.getElementById('button-a');
        const startButtonTouch = document.getElementById('button-start-touch');

        if (dpadLeft && dpadRight && buttonA && startButtonTouch) {
            const vibrate = (duration) => { if (window.navigator.vibrate) { window.navigator.vibrate(duration); } };
            dpadLeft.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(30); keys['a'] = true; });
            dpadLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['a'] = false; });
            dpadRight.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(30); keys['d'] = true; });
            dpadRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['d'] = false; });
            buttonA.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(50); keys['w'] = true; });
            buttonA.addEventListener('touchend', (e) => { e.preventDefault(); keys['w'] = false; });
            startButtonTouch.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(50); handleStartPress(); });
        }
    }

    let animationFrameId;
    function gameLoop() {
        update();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- MAIN INITIALIZATION (Login first) ---
    window.addEventListener('load', () => {
        showView('login-view');
        requestLoginCodeBtn.addEventListener('click', handleRequestCode);
        loginBtn.addEventListener('click', handleLogin);
    });

} catch (e) {
    console.error("FATAL ERROR:", e);
    document.body.innerHTML = `<div style="color: red; font-family: monospace; padding: 20px;"><h1>Error</h1><p>${e.message}</p><pre>${e.stack}</pre></div>`;
}

