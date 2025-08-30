import { Particle } from './particle.js';

export class Platform {
    constructor(x, y, width, height = 20, isFloor = false) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = '#0074D9';
        this.isFloor = isFloor;
        this.isFrozen = false;
        this.frozenTimer = 0;
        this.vx = 0;
        this.startX = x;
        this.range = 0;
    }

    draw(ctx) {
        ctx.fillStyle = this.isFrozen ? '#7FDBFF' : this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        if (this.isFrozen) {
            this.frozenTimer -= 1000 / 60;
            if (this.frozenTimer <= 0) this.isFrozen = false;
        }
        if (this.vx !== 0) {
            this.x += this.vx;
            if (this.x <= this.startX || this.x >= this.startX + this.range) {
                this.vx *= -1;
            }
        }
    }

    freeze() {
        this.isFrozen = true;
        this.frozenTimer = 7000;
    }

    makeMobile(speed, range) {
        this.vx = speed;
        this.range = range;
        if (speed < 0) {
            this.startX = this.x - range;
        }
        return this;
    }
}

export class ExplosiveBlock {
    constructor(GAME_WIDTH, GAME_HEIGHT, EXPLOSIVE_BLOCK_USES) {
        this.width = 50;
        this.initialHeight = 50;
        this.height = this.initialHeight;
        this.x = GAME_WIDTH / 2 - this.width / 2;
        this.y = GAME_HEIGHT - 180;
        this.usesLeft = EXPLOSIVE_BLOCK_USES;
        this.cooldown = 0;
        this.EXPLOSIVE_BLOCK_USES = EXPLOSIVE_BLOCK_USES;
    }

    draw(ctx) {
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

        if (this.usesLeft === this.EXPLOSIVE_BLOCK_USES) {
            finalVerticalScale *= 2.0;
        }

        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(1, finalVerticalScale);
        ctx.fillText('POW', 0, 1);

        ctx.restore();
        ctx.restore();
    }

    update() {
        if (this.cooldown > 0) this.cooldown -= 1000 / 60;
    }

    hit(enemies, particles, playSound, soundExplosion) {
        if (this.usesLeft > 0 && this.cooldown <= 0) {
            this.usesLeft--;
            this.cooldown = 500;
            playSound(soundExplosion);
            enemies.forEach(e => e.flip());
            for (let i = 0; i < 50; i++) {
                particles.push(new Particle(this.x + this.width / 2, this.y, '💥'));
            }
            const flattenAmount = this.initialHeight / this.EXPLOSIVE_BLOCK_USES;
            this.height -= flattenAmount;
            this.y += flattenAmount;
        }
    }

    reset(GAME_HEIGHT) {
        this.usesLeft = this.EXPLOSIVE_BLOCK_USES;
        this.height = this.initialHeight;
        this.y = GAME_HEIGHT - 180;
    }
}

