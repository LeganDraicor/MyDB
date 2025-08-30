// --- Game Constants ---
const GAME_WIDTH = 960;
const GAME_HEIGHT = 720;
const GRAVITY = 0.6;
const PLAYER_SPEED = 5;
const PLAYER_JUMP = -10;
const ENEMY_SPEED = 1.0;
const FLIP_DURATION = 5000;
const LEVEL_TRANSITION_TIME = 1500;
const EXPLOSIVE_BLOCK_USES = 3;
const JUMP_HOLD_GRAVITY = GRAVITY * 0.5;
const spawnPoints = [{ x: 150, y: 60 }, { x: GAME_WIDTH - 150, y: 60 }];

// --- DOM & State ---
let canvas, ctx, bgMusic, soundJump, soundExplosion, soundLoseLife, soundGameOver, soundPause;
let level, players, enemies, platforms, particles, explosiveBlock;
let keys = {}, gameState, levelTransitionTimer, playerSelectOption = 1;
let gameAnimationId = null;
let onGameOverCallback = () => {};
let isMobile = false;

// --- Helper Functions ---
function playSound(sound) {
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Audio play failed:", e));
    }
}

function resizeGame() {
    const container = document.getElementById('game-canvas-container');
    if (!container) return;
    const mainLayoutElem = document.getElementById('main-layout');
    if (mainLayoutElem) mainLayoutElem.style.height = window.innerHeight + 'px';
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const aspectRatio = GAME_WIDTH / GAME_HEIGHT;
    let newWidth = containerWidth;
    let newHeight = newWidth / aspectRatio;
    if (newHeight > containerHeight) { newHeight = containerHeight; newWidth = newHeight * aspectRatio; }
    const gameContainer = document.getElementById('game-container');
    gameContainer.style.width = newWidth + 'px';
    gameContainer.style.height = newHeight + 'px';
}

// --- Game Classes ---
class Player {
    constructor(id, controls, sprite) {
        this.id = id; this.width = 40; this.height = 40;
        this.x = GAME_WIDTH / 2 - this.width / 2 + (id === 1 ? -50 : 50);
        this.y = GAME_HEIGHT - this.height - 50;
        this.vx = 0; this.vy = 0;
        this.onGround = false; this.onFrozenPlatform = false;
        this.isDead = false;
        this.sprite = sprite;
        this.controls = controls;
        this.score = 0;
        this.hp = 1000; this.maxHp = 1000;
    }
    resetPosition() {
        this.x = GAME_WIDTH / 2 - this.width / 2 + (this.id === 1 ? -50 : 50);
        this.y = GAME_HEIGHT - this.height - 50;
        this.vx = 0; this.vy = 0;
        if (this.hp <= 0) this.hp = this.maxHp;
    }
    draw() { if (this.isDead) return; ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.sprite, this.x + this.width / 2, this.y + this.height / 2); }
    update() {
        if (this.isDead) return;
        if (keys[this.controls.jump] && this.onGround) this.jump();

        if (this.onFrozenPlatform) {
            if (!keys[this.controls.left] && !keys[this.controls.right]) { this.vx *= 0.97; if (Math.abs(this.vx) < 0.1) this.vx = 0; }
            else { if (keys[this.controls.left]) this.vx = -PLAYER_SPEED; if (keys[this.controls.right]) this.vx = PLAYER_SPEED; }
        } else {
            this.vx = 0;
            if (keys[this.controls.left]) this.vx = -PLAYER_SPEED;
            if (keys[this.controls.right]) this.vx = PLAYER_SPEED;
        }
        this.x += this.vx;
        if (this.x < -this.width) this.x = GAME_WIDTH;
        if (this.x > GAME_WIDTH) this.x = -this.width;

        if (this.vy < 0 && keys[this.controls.jump]) this.vy += JUMP_HOLD_GRAVITY;
        else this.vy += GRAVITY;

        this.y += this.vy;
        this.onGround = false; this.onFrozenPlatform = false;
    }
    jump() { if (this.onGround && !this.isDead) { this.vy = PLAYER_JUMP; playSound(soundJump); } }
    die(damageAmount) {
        if (this.isDead) return;
        this.hp -= damageAmount;
        playSound(soundLoseLife);
        if (this.hp <= 0) {
            this.hp = 0; this.isDead = true;
            for (let i = 0; i < 50; i++) particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, this.sprite));
            checkGameOver();
        }
    }
    addScore(points) { this.score += points; }
}
class Enemy {
    constructor(x, y, width, height, sprite) {
        this.width = width; this.height = height; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.sprite = sprite; this.isFlipped = false; this.flipTimer = 0; this.onGround = false; this.hitAnimationTimer = 0;
        this.damage = 10;
    }
    draw() {
        ctx.save();
        if (this.hitAnimationTimer > 0 && Math.floor(this.hitAnimationTimer / 50) % 2 === 0) { ctx.restore(); return; }
        if (this.isFlipped) { ctx.translate(this.x + this.width / 2, this.y + this.height / 2); ctx.rotate(Math.PI); ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2)); }
        ctx.font = '36px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.sprite, this.x + this.width / 2, this.y + this.height / 2);
        ctx.restore();
    }
    update() {
        if (this.hitAnimationTimer > 0) this.hitAnimationTimer -= 1000 / 60;
        if (this.isFlipped) {
            this.flipTimer -= 1000 / 60;
            if (this.flipTimer <= 0) { this.isFlipped = false; this.y -= 5; }
        }
        if (this.x + this.width < 0 || this.x > GAME_WIDTH) {
            const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
            this.x = spawnPoint.x; this.y = spawnPoint.y; this.vy = 0;
        }
        this.vy += GRAVITY; this.y += this.vy; this.onGround = false;
        platforms.forEach(p => { if (this.x < p.x + p.width && this.x + this.width > p.x && this.y + this.height >= p.y && this.y + this.height <= p.y + p.height + 10 && this.vy >= 0) { this.y = p.y - this.height; this.vy = 0; this.onGround = true; if (!p.isFloor) { this.x += p.vx; } } });
    }
    flip() { if (!this.isFlipped) { this.isFlipped = true; this.flipTimer = FLIP_DURATION; this.vy = -5; } }
}
class BasicEnemy extends Enemy { constructor(x, y) { super(x, y, 36, 36, '👾'); this.vx = (Math.random() < 0.5 ? 1 : -1) * ENEMY_SPEED; this.damage = 100; } update() { super.update(); if (!this.isFlipped) this.x += this.vx; } }
class FastEnemy extends Enemy { constructor(x, y) { super(x, y, 36, 36, '👻'); this.vx = (Math.random() < 0.5 ? 1 : -1) * ENEMY_SPEED * 1.8; this.damage = 75; } update() { super.update(); if (!this.isFlipped) this.x += this.vx; } }
class JumpingEnemy extends Enemy { constructor(x, y) { super(x, y, 36, 36, '👽'); this.vx = (Math.random() < 0.5 ? 1 : -1) * ENEMY_SPEED * 0.8; this.jumpCooldown = Math.floor(Math.random() * 121) + 80; this.damage = 125; } update() { super.update(); this.jumpCooldown--; if (this.onGround && this.jumpCooldown <= 0 && !this.isFlipped) { this.vy = -8; this.onGround = false; this.jumpCooldown = Math.floor(Math.random() * 201) + 100; } if (!this.isFlipped) this.x += this.vx; } }
class IceBomberEnemy extends Enemy { constructor(x, y, platform) { super(x, y, 36, 36, '💣'); this.vx = 0; this.timer = Math.floor(Math.random() * 2001) + 3000; this.platform = platform; this.y = platform.y - this.height; this.x = platform.x + (platform.width / 2) - (this.width / 2); this.damage = 0; } update() { super.update(); this.timer -= 1000 / 60; if (this.timer <= 0 && !this.isFlipped) { this.explode(); } if (this.platform) { this.x = this.platform.x + (this.platform.width / 2) - (this.width / 2); } } explode() { const index = enemies.indexOf(this); if (index > -1) enemies.splice(index, 1); for (let i = 0; i < 40; i++) particles.push(new Particle(this.x, this.y, this.sprite)); if (this.platform) this.platform.freeze(); } flip() { this.timer = Math.min(this.timer, 100); } }
class ToughEnemy extends Enemy { constructor(x, y) { super(x, y, 40, 40, '👹'); this.vx = (Math.random() < 0.5 ? 1 : -1) * ENEMY_SPEED * 0.7; this.hitsLeft = 2; this.damage = 200; } flip() { if (this.isFlipped) return; this.hitsLeft--; this.vy = -3; if (this.hitsLeft <= 0) { super.flip(); } else { this.hitAnimationTimer = 300; this.sprite = '👺'; } } update() { super.update(); if (!this.isFlipped) this.x += this.vx; } }
class Platform { constructor(x, y, width, height = 20, isFloor = false) { this.x = x; this.y = y; this.width = width; this.height = height; this.color = '#0074D9'; this.isFloor = isFloor; this.isFrozen = false; this.frozenTimer = 0; this.vx = 0; this.startX = x; this.range = 0; } draw() { ctx.fillStyle = this.isFrozen ? '#7FDBFF' : this.color; ctx.fillRect(this.x, this.y, this.width, this.height); } update() { if (this.isFrozen) { this.frozenTimer -= 1000 / 60; if (this.frozenTimer <= 0) this.isFrozen = false; } if (this.vx !== 0) { this.x += this.vx; if (this.x <= this.startX || this.x >= this.startX + this.range) { this.vx *= -1; } } } freeze() { this.isFrozen = true; this.frozenTimer = 7000; } makeMobile(speed, range) { this.vx = speed; this.range = range; if (speed < 0) { this.startX = this.x - range; } return this; } }
class ExplosiveBlock { constructor() { this.width = 50; this.initialHeight = 50; this.height = this.initialHeight; this.x = GAME_WIDTH / 2 - this.width / 2; this.y = GAME_HEIGHT - 180; this.usesLeft = EXPLOSIVE_BLOCK_USES; this.cooldown = 0; } draw() { if (this.usesLeft <= 0) return; ctx.save(); if (this.cooldown > 0) ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff4136'; ctx.fillRect(this.x, this.y, this.width, this.height); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(this.x, this.y, this.width, this.height); ctx.globalAlpha = 1.0; ctx.save(); ctx.fillStyle = '#fff'; ctx.font = '15px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const baseVerticalScale = this.height / this.initialHeight; let finalVerticalScale = baseVerticalScale; if (this.usesLeft === EXPLOSIVE_BLOCK_USES) { finalVerticalScale *= 2.0; } ctx.translate(this.x + this.width / 2, this.y + this.height / 2); ctx.scale(1, finalVerticalScale); ctx.fillText('POW', 0, 1); ctx.restore(); ctx.restore(); } update() { if (this.cooldown > 0) this.cooldown -= 1000 / 60; } hit() { if (this.usesLeft > 0 && this.cooldown <= 0) { this.usesLeft--; this.cooldown = 500; playSound(soundExplosion); enemies.forEach(e => e.flip()); for (let i = 0; i < 50; i++) { particles.push(new Particle(this.x + this.width / 2, this.y, '💥')); } const flattenAmount = this.initialHeight / EXPLOSIVE_BLOCK_USES; this.height -= flattenAmount; this.y += flattenAmount; } } reset() { this.usesLeft = EXPLOSIVE_BLOCK_USES; this.height = this.initialHeight; this.y = GAME_HEIGHT - 180; } }
class Particle { constructor(x, y, sprite) { this.x = x; this.y = y; this.sprite = sprite; this.isEmoji = /\p{Emoji}/u.test(sprite); this.size = this.isEmoji ? 20 : Math.random() * 5 + 2; this.vx = (Math.random() - 0.5) * 8; this.vy = (Math.random() - 0.5) * 8; this.life = 100; } draw() { ctx.globalAlpha = this.life / 100; if (this.isEmoji) { ctx.font = `${this.size}px sans-serif`; ctx.fillText(this.sprite, this.x, this.y); } else { ctx.fillStyle = this.sprite; ctx.fillRect(this.x, this.y, this.size, this.size); } ctx.globalAlpha = 1.0; } update() { this.x += this.vx; this.y += this.vy; this.vy += GRAVITY * 0.1; this.life--; if (this.isEmoji && this.size > 0.2) this.size -= 0.2; } }
const levelLayouts = [ () => [new Platform(0, 550, 250), new Platform(GAME_WIDTH - 250, 550, 250), new Platform(300, 400, 360), new Platform(0, 250, 350), new Platform(GAME_WIDTH - 350, 250, 350),], () => [new Platform(0, 580, 200), new Platform(GAME_WIDTH - 200, 580, 200), new Platform(250, 450, 150), new Platform(GAME_WIDTH - 400, 450, 150), new Platform(0, 300, 200), new Platform(GAME_WIDTH - 200, 300, 200), new Platform(300, 180, 360),], () => [new Platform(0, 550, 200), new Platform(GAME_WIDTH - 200, 550, 200), new Platform(380, 400, 200).makeMobile(1, 100), new Platform(0, 250, 300), new Platform(GAME_WIDTH - 300, 250, 300),], () => [new Platform(0, 580, 150).makeMobile(1.2, 80), new Platform(GAME_WIDTH - 150, 580, 150).makeMobile(-1.2, 80), new Platform(300, 420, 360), new Platform(0, 250, 350).makeMobile(1.5, 150), new Platform(GAME_WIDTH - 350, 250, 350).makeMobile(-1.5, 150),], ];

// --- Core Game Functions ---
function startGame(numPlayers, playerData) {
    level = 1; players = []; const p1Controls = { left: 'a', right: 'd', jump: 'w' };
    const p1 = new Player(1, p1Controls, '🤖');
    if (playerData && playerData.stats) {
        p1.maxHp = playerData.stats.hpMax;
        p1.hp = playerData.stats.hpMax;
        p1.score = playerData.draicorCoins;
    }
    players.push(p1);
    if (numPlayers === 2) { const p2Controls = { left: 'arrowleft', right: 'arrowright', jump: 'arrowup' }; players.push(new Player(2, p2Controls, '🧑‍🚀')); }
    explosiveBlock = new ExplosiveBlock();
    setupLevel(level);
    gameState = 'playing';
}
function setupLevel(levelNum) { const layoutIndex = Math.floor((levelNum - 1) / 4) % levelLayouts.length; platforms = [new Platform(0, GAME_HEIGHT - 40, GAME_WIDTH, 40, true), ...levelLayouts[layoutIndex](),]; platforms.forEach(p => { p.isFrozen = false; }); players.forEach(p => { if (!p.isDead) { p.resetPosition(); } }); enemies = []; explosiveBlock.reset(); const finalLevel = Math.min(levelNum, 50); const enemyCount = 2 + Math.floor(finalLevel / 2); for (let i = 0; i < enemyCount; i++) { const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)]; const x = spawnPoint.x; const y = spawnPoint.y; let enemyType = Math.random(); if (finalLevel >= 25 && enemyType < 0.15) { enemies.push(new ToughEnemy(x, y)); } else if (finalLevel >= 20 && enemyType < 0.3) { const validPlatforms = platforms.filter(p => !p.isFloor && p.vx === 0 && !enemies.some(e => e instanceof IceBomberEnemy && e.platform === p)); if (validPlatforms.length > 0) { const platformForBomber = validPlatforms[Math.floor(Math.random() * validPlatforms.length)]; enemies.push(new IceBomberEnemy(0, 0, platformForBomber)); } else { enemies.push(new BasicEnemy(x, y)); } } else if (finalLevel >= 10 && enemyType < 0.5) { enemies.push(new JumpingEnemy(x, y)); } else if (finalLevel >= 5 && enemyType < 0.75) { enemies.push(new FastEnemy(x, y)); } else { enemies.push(new BasicEnemy(x, y)); } } }
function update() { if (gameState === 'playing') { players.forEach(p => p.update()); enemies.forEach(e => e.update()); platforms.forEach(p => p.update()); explosiveBlock.update(); handleCollisions(); if (enemies.length === 0 && players.some(p => !p.isDead)) { level++; gameState = 'levelTransition'; levelTransitionTimer = LEVEL_TRANSITION_TIME; } } else if (gameState === 'levelTransition') { levelTransitionTimer -= 1000 / 60; if (levelTransitionTimer <= 0) { setupLevel(level); gameState = 'playing'; } } particles.forEach(p => p.update()); particles = particles.filter(p => p.life > 0); }
function handleCollisions() { players.forEach(player => { if (player.isDead) return; const block = explosiveBlock; if (block.usesLeft > 0 && player.x < block.x + block.width && player.x + player.width > block.x && player.y + player.height >= block.y && player.y + player.height <= block.y + 10 + player.vy && player.vy >= 0) { player.y = block.y - player.height; player.vy = 0; player.onGround = true; } let onAnyPlatform = player.onGround; let isCurrentlyOnFrozenPlatform = false; platforms.forEach(p => { if (player.x < p.x + p.width && player.x + player.width > p.x && player.y + player.height >= p.y && player.y + player.height <= p.y + p.height + player.vy && player.vy >= 0) { player.y = p.y - player.height; player.vy = 0; player.onGround = true; onAnyPlatform = true; if (p.isFrozen) isCurrentlyOnFrozenPlatform = true; player.x += p.vx; } if (player.x < p.x + p.width && player.x + player.width > p.x && player.y > p.y && player.y <= p.y + p.height && player.vy < 0) { player.y = p.y + p.height; player.vy = 0; const hitCenterX = player.x + player.width / 2; enemies.forEach(enemy => { const onThisPlatform = Math.abs((enemy.y + enemy.height) - p.y) < 10; const withinHitRange = enemy.x < hitCenterX + 20 && (enemy.x + enemy.width) > hitCenterX - 20; if (!enemy.isFlipped && onThisPlatform && withinHitRange) { enemy.flip(); player.addScore(50); } }); } }); player.onGround = onAnyPlatform; player.onFrozenPlatform = isCurrentlyOnFrozenPlatform; if (player.x < block.x + block.width && player.x + player.width > block.x && player.y > block.y && player.y <= block.y + block.height && player.vy < 0) { player.y = block.y + block.height; player.vy = 0; block.hit(); } enemies.forEach((enemy, index) => { if (player.x < enemy.x + enemy.width && player.x + player.width > enemy.x && player.y < enemy.y + enemy.height && player.y + player.height > enemy.y) { if (enemy.isFlipped) { enemies.splice(index, 1); for (let i = 0; i < 20; i++) particles.push(new Particle(enemy.x, enemy.y, enemy.sprite)); player.addScore(200); } else { player.die(enemy.damage); } } }); }); for (let i = 0; i < enemies.length; i++) { for (let j = i + 1; j < enemies.length; j++) { const e1 = enemies[i]; const e2 = enemies[j]; if (e1.x < e2.x + e2.width && e1.x + e1.width > e2.x && e1.y < e2.y + e2.height && e1.y + e1.height > e2.y) { if (!e1.isFlipped && !e2.isFlipped && e1.onGround && e2.onGround) { const tempVx = e1.vx; e1.vx = e2.vx; e2.vx = tempVx; if (e1.x < e2.x) { e1.x -= 1; e2.x += 1; } else { e1.x += 1; e2.x -= 1; } } } } } }
function draw() { ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT); if (gameState === 'playerSelect') { drawPlayerSelect(); } else { platforms.forEach(p => p.draw()); explosiveBlock.draw(); enemies.forEach(e => e.draw()); players.forEach(p => p.draw()); drawGameUI(); if (gameState === 'paused') { ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); ctx.fillStyle = 'white'; ctx.font = '50px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', GAME_WIDTH / 2, GAME_HEIGHT / 2); } else if (gameState === 'levelTransition') { ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); ctx.fillStyle = 'white'; ctx.font = '50px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText(`LEVEL ${level}`, GAME_WIDTH / 2, GAME_HEIGHT / 2); } else if (gameState === 'gameOver') { drawGameOver(); } } particles.forEach(p => p.draw()); }
function drawGameUI() { ctx.font = '20px "Press Start 2P", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ff4136'; ctx.fillText('P1 SCORE', 40, 30); ctx.fillStyle = 'white'; ctx.fillText((players[0]?.score || 0).toString().padStart(6, '0'), 40, 60); if (players[0]) { ctx.textAlign = 'left'; ctx.fillStyle = '#ff4136'; ctx.fillText('HP', 40, 92); const p1 = players[0]; const barWidth = 180; const hpPercentage = p1.hp / p1.maxHp; ctx.fillStyle = '#555'; ctx.fillRect(85, 80, barWidth, 20); ctx.fillStyle = '#01FF70'; ctx.fillRect(85, 80, barWidth * hpPercentage, 20); ctx.strokeStyle = '#fff'; ctx.strokeRect(85, 80, barWidth, 20); } ctx.textAlign = 'center'; ctx.fillStyle = '#ff4136'; ctx.fillText('DraicorCoins', GAME_WIDTH / 2, 30); ctx.fillStyle = 'white'; const totalScore = players.reduce((sum, p) => sum + (p.score || 0), 0); const formattedScore = '🪙 ' + totalScore.toLocaleString('en-US'); ctx.fillText(formattedScore, GAME_WIDTH / 2, 60); if (players.length > 1 && players[1]) { const p2 = players[1]; ctx.textAlign = 'right'; ctx.fillStyle = '#ff4136'; ctx.fillText('HP', GAME_WIDTH - 225, 92); ctx.textAlign = 'right'; ctx.fillStyle = '#ff4136'; ctx.fillText('P2 SCORE', GAME_WIDTH - 40, 30); ctx.fillStyle = 'white'; ctx.fillText(p2.score.toString().padStart(6, '0'), GAME_WIDTH - 40, 60); const barWidth = 180; const hpPercentage = p2.hp / p2.maxHp; ctx.fillStyle = '#555'; ctx.fillRect(GAME_WIDTH - 40 - barWidth, 80, barWidth, 20); ctx.fillStyle = '#01FF70'; ctx.fillRect(GAME_WIDTH - 40 - barWidth, 80, barWidth * hpPercentage, 20); ctx.strokeStyle = '#fff'; ctx.strokeRect(GAME_WIDTH - 40 - barWidth, 80, barWidth, 20); } }
function drawPlayerSelect() { ctx.textAlign = 'center'; ctx.fillStyle = '#ff4136'; ctx.font = '80px "Press Start 2P"'; ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2 + 5, GAME_HEIGHT / 2 - 150 + 5); ctx.fillStyle = '#ffdc00'; ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150); if (isMobile) { ctx.fillStyle = 'white'; ctx.font = '30px "Press Start 2P"'; ctx.fillText('PRESS START TO PLAY', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50); ctx.fillStyle = 'white'; ctx.font = '16px "Press Start 2P"'; ctx.textAlign = 'left'; ctx.fillText('Player Controls:', 50, GAME_HEIGHT - 230); ctx.textAlign = 'left'; ctx.fillText('(◀) Left  (▶) Right  (A) Jump (B) Potion (B+A) Bombs', 50, GAME_HEIGHT - 200); ctx.textAlign = 'left'; ctx.fillText('Start/Pause: (Start)', 50, GAME_HEIGHT - 170); } else { ctx.fillStyle = 'white'; ctx.font = '40px "Press Start 2P"'; ctx.fillText('SELECT PLAYERS', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50); ctx.font = '30px "Press Start 2P"'; ctx.fillStyle = playerSelectOption === 1 ? '#ffdc00' : 'white'; ctx.fillText('1 PLAYER', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30); ctx.fillStyle = playerSelectOption === 2 ? '#ffdc00' : 'white'; ctx.fillText('2 PLAYERS', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90); ctx.font = '16px "Press Start 2P", sans-serif'; ctx.fillStyle = 'white'; ctx.textAlign = 'left'; ctx.fillText('Use Arrow Keys (🠙🠛) to select and Enter (↵) to start', 50, GAME_HEIGHT - 200); ctx.textAlign = 'left'; ctx.fillText('Player Controls:', 50, GAME_HEIGHT - 160); ctx.textAlign = 'left'; ctx.fillText('P1: (A) Left  (D) Right  (w) Jump (S) Potion (W+S) Bombs', 50, GAME_HEIGHT - 130); ctx.textAlign = 'left'; ctx.fillText('P2: (🠘) Left  (🠚) Right  (🠙) Jump (🠛) Potion (🠙🠛) Bombs', 50, GAME_HEIGHT - 110); ctx.textAlign = 'left'; ctx.fillText('Start/Pause: (↵) Enter', 50, GAME_HEIGHT - 90); ctx.textAlign = 'left'; ctx.fillText('Gamepad supported via JoyToKey (free): joytokey.net/en', 50, GAME_HEIGHT - 50); } }
function drawGameOver() { ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); ctx.fillStyle = '#ff4136'; ctx.font = '60px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50); ctx.fillStyle = 'white'; ctx.font = '20px "Press Start 2P"'; ctx.fillText('Press Start to return to menu', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50); }
function checkGameOver() { if (players.every(p => p.isDead)) { gameState = 'gameOver'; playSound(soundGameOver); if(bgMusic) bgMusic.pause(); } }
function gameLoop() { update(); draw(); gameAnimationId = requestAnimationFrame(gameLoop); }

function handleStartPress(initialPlayerData) {
    if (gameState === 'playing') { gameState = 'paused'; playSound(soundPause); if (bgMusic) bgMusic.pause(); }
    else if (gameState === 'paused') { gameState = 'playing'; playSound(soundPause); if (bgMusic) bgMusic.play(); }
    else if (gameState === 'playerSelect') {
        const playersToStart = isMobile ? 1 : playerSelectOption;
        startGame(playersToStart, initialPlayerData);
        if (bgMusic) { bgMusic.currentTime = 0; bgMusic.play(); }
    }
    else if (gameState === 'gameOver') {
        const finalScore = players && players[0] ? players[0].score : 0;
        onGameOverCallback(finalScore);
    }
}

// --- Public Interface ---
export function initializeAndStartGame(playerData, gameOverCallback) {
    onGameOverCallback = gameOverCallback;
    isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    if (!canvas) {
        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');
        bgMusic = document.getElementById('bg-music');
        soundJump = document.getElementById('sound-jump');
        soundExplosion = document.getElementById('sound-explosion');
        soundLoseLife = document.getElementById('sound-lose-life');
        soundGameOver = document.getElementById('sound-game-over');
        soundPause = document.getElementById('sound-pause');

        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
        resizeGame();
        
        window.addEventListener('resize', resizeGame);
        window.addEventListener('keydown', e => { 
            const key = e.key.toLowerCase(); 
            keys[key] = true; 
            if (gameState === 'playing' || gameState === 'paused' || gameState === 'playerSelect' || gameState === 'gameOver') { 
                if (key === 'enter') handleStartPress(playerData); 
            } 
            if(gameState === 'playerSelect' && !isMobile){ 
                if (key === 'arrowdown') playerSelectOption = 2; 
                if (key === 'arrowup') playerSelectOption = 1; 
            } 
        });
        window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

        if(isMobile){
            const dpadLeft = document.querySelector('#dpad-container .left'); const dpadRight = document.querySelector('#dpad-container .right'); const buttonA = document.getElementById('button-a'); const startButtonTouch = document.getElementById('button-start-touch');
            if (dpadLeft && dpadRight && buttonA && startButtonTouch) {
                const vibrate = (duration) => { if (window.navigator.vibrate) { window.navigator.vibrate(duration); } };
                dpadLeft.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(30); keys['a'] = true; }, { passive: false });
                dpadLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['a'] = false; }, { passive: false });
                dpadRight.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(30); keys['d'] = true; }, { passive: false });
                dpadRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['d'] = false; }, { passive: false });
                buttonA.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(50); keys['w'] = true; }, { passive: false });
                buttonA.addEventListener('touchend', (e) => { e.preventDefault(); keys['w'] = false; }, { passive: false });
                startButtonTouch.addEventListener('touchstart', (e) => { e.preventDefault(); vibrate(50); handleStartPress(playerData); }, { passive: false });
            }
        }
    }
    
    gameState = 'playerSelect';
    if (!gameAnimationId) gameLoop();
}

export function stopGame() {
    if (gameAnimationId) {
        cancelAnimationFrame(gameAnimationId);
        gameAnimationId = null;
    }
    if(bgMusic) bgMusic.pause();
    gameState = 'inactive';
}
