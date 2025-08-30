const GRAVITY = 0.6;
const ENEMY_SPEED = 1.0;
const FLIP_DURATION = 5000;
const GAME_WIDTH = 960;
const spawnPoints = [{ x: 150, y: 60 },{ x: GAME_WIDTH - 150, y: 60 }];

class Enemy {
    constructor(x, y, width, height, sprite) {
        this.width = width; this.height = height; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.sprite = sprite; this.isFlipped = false; this.flipTimer = 0; this.onGround = false; this.hitAnimationTimer = 0;
        this.damage = 10;
    }
    draw(ctx) {
        ctx.save(); if (this.hitAnimationTimer > 0 && Math.floor(this.hitAnimationTimer / 50) % 2 === 0) { ctx.restore(); return; }
        if (this.isFlipped) { ctx.translate(this.x + this.width / 2, this.y + this.height / 2); ctx.rotate(Math.PI); ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2)); }
        ctx.font = '36px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.sprite, this.x + this.width / 2, this.y + this.height / 2); ctx.restore();
    }
    update(platforms, particles, Particle) {
        if (this.hitAnimationTimer > 0) this.hitAnimationTimer -= 1000 / 60;
        if (this.isFlipped) { this.flipTimer -= 1000 / 60; if (this.flipTimer <= 0) { this.isFlipped = false; this.y -= 5; } }
        if (this.x + this.width < 0 || this.x > GAME_WIDTH) { const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)]; this.x = spawnPoint.x; this.y = spawnPoint.y; this.vy = 0; }
        this.vy += GRAVITY; this.y += this.vy; this.onGround = false;
        platforms.forEach(p => { if (this.x < p.x + p.width && this.x + this.width > p.x && this.y + this.height >= p.y && this.y + this.height <= p.y + p.height + 10 && this.vy >= 0) { this.y = p.y - this.height; this.vy = 0; this.onGround = true; if (!p.isFloor) { this.x += p.vx; } } });
    }
    flip() { if (!this.isFlipped) { this.isFlipped = true; this.flipTimer = FLIP_DURATION; this.vy = -5; } }
}

export class BasicEnemy extends Enemy { constructor(x, y) { super(x, y, 36, 36, '👾'); this.vx = (Math.random() < 0.5 ? 1 : -1) * ENEMY_SPEED; this.damage = 100; } update(platforms) { super.update(platforms); if (!this.isFlipped) this.x += this.vx; } }
export class FastEnemy extends Enemy { constructor(x, y) { super(x, y, 36, 36, '👻'); this.vx = (Math.random() < 0.5 ? 1 : -1) * ENEMY_SPEED * 1.8; this.damage = 75; } update(platforms) { super.update(platforms); if (!this.isFlipped) this.x += this.vx; } }
export class JumpingEnemy extends Enemy { constructor(x, y) { super(x, y, 36, 36, '👽'); this.vx = (Math.random() < 0.5 ? 1 : -1) * ENEMY_SPEED * 0.8; this.jumpCooldown = Math.floor(Math.random() * 121) + 80; this.damage = 125; } update(platforms) { super.update(platforms); this.jumpCooldown--; if (this.onGround && this.jumpCooldown <= 0 && !this.isFlipped) { this.vy = -8; this.onGround = false; this.jumpCooldown = Math.floor(Math.random() * 201) + 100; } if (!this.isFlipped) this.x += this.vx; } }
export class IceBomberEnemy extends Enemy { constructor(x, y, platform) { super(x, y, 36, 36, '💣'); this.vx = 0; this.timer = Math.floor(Math.random() * 2001) + 3000; this.platform = platform; this.y = platform.y - this.height; this.x = platform.x + (platform.width / 2) - (this.width / 2); this.damage = 0; } update(platforms, particles, Particle, enemies) { super.update(platforms); this.timer -= 1000 / 60; if (this.timer <= 0 && !this.isFlipped) { this.explode(particles, Particle, enemies); } if (this.platform) { this.x = this.platform.x + (this.platform.width / 2) - (this.width / 2); } } explode(particles, Particle, enemies) { const index = enemies.indexOf(this); if (index > -1) enemies.splice(index, 1); for (let i = 0; i < 40; i++) particles.push(new Particle(this.x, this.y, this.sprite)); if (this.platform) this.platform.freeze(); } flip() { this.timer = Math.min(this.timer, 100); } }
export class ToughEnemy extends Enemy { constructor(x, y) { super(x, y, 40, 40, '👹'); this.vx = (Math.random() < 0.5 ? 1 : -1) * ENEMY_SPEED * 0.7; this.hitsLeft = 2; this.damage = 200; } flip() { if (this.isFlipped) return; this.hitsLeft--; this.vy = -3; if (this.hitsLeft <= 0) { super.flip(); } else { this.hitAnimationTimer = 300; this.sprite = '👺'; } } update(platforms) { super.update(platforms); if (!this.isFlipped) this.x += this.vx; } }

