import { Particle } from './particle.js';

export class Player {
    constructor(id, controls, sprite) {
        this.id = id;
        this.width = 40;
        this.height = 40;
        this.sprite = sprite;
        this.controls = controls;

        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.onFrozenPlatform = false;
        this.isDead = false;
        this.score = 0;
        this.hp = 1000;
        this.maxHp = 1000;

        // Position is set in resetPosition
        this.x = 0;
        this.y = 0;
    }

    resetPosition(GAME_WIDTH, GAME_HEIGHT) {
        this.x = GAME_WIDTH / 2 - this.width / 2 + (this.id === 1 ? -50 : 50);
        this.y = GAME_HEIGHT - this.height - 50;
        this.vx = 0;
        this.vy = 0;
        if(this.hp <= 0) {
            this.hp = this.maxHp;
            this.isDead = false;
        }
    }

    draw(ctx) {
        if (this.isDead) return;
        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.sprite, this.x + this.width / 2, this.y + this.height / 2);
    }

    update(keys, GAME_WIDTH, PLAYER_SPEED, GRAVITY, JUMP_HOLD_GRAVITY, playSound, soundJump) {
        if (this.isDead) return;

        if (keys[this.controls.jump] && this.onGround) {
            this.jump(playSound, soundJump);
        }

        if (this.onFrozenPlatform) {
            if (!keys[this.controls.left] && !keys[this.controls.right]) {
                this.vx *= 0.97;
                if (Math.abs(this.vx) < 0.1) this.vx = 0;
            } else {
                if (keys[this.controls.left]) this.vx = -PLAYER_SPEED;
                if (keys[this.controls.right]) this.vx = PLAYER_SPEED;
            }
        } else {
            this.vx = 0;
            if (keys[this.controls.left]) this.vx = -PLAYER_SPEED;
            if (keys[this.controls.right]) this.vx = PLAYER_SPEED;
        }
        this.x += this.vx;
        if (this.x < -this.width) this.x = GAME_WIDTH;
        if (this.x > GAME_WIDTH) this.x = -this.width;

        if (this.vy < 0 && keys[this.controls.jump]) {
            this.vy += JUMP_HOLD_GRAVITY;
        } else {
            this.vy += GRAVITY;
        }

        this.y += this.vy;
        this.onGround = false;
        this.onFrozenPlatform = false;
    }

    jump(playSound, soundJump) {
        const PLAYER_JUMP = -10;
        if (this.onGround && !this.isDead) {
            this.vy = PLAYER_JUMP;
            playSound(soundJump);
        }
    }

    die(damageAmount, particles, checkGameOver, playSound, soundLoseLife) {
        if (this.isDead) return;

        this.hp -= damageAmount;
        playSound(soundLoseLife);

        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
            for (let i = 0; i < 50; i++) {
                particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, this.sprite));
            }
            checkGameOver();
        }
    }

    addScore(points, HIGH_SCORE_KEY) {
        this.score += points;
        
        // This logic needs to be handled in main.js where highScore is a state
        // if (this.score > highScore) {
        //     highScore = this.score;
        //     localStorage.setItem(HIGH_SCORE_KEY, highScore.toString());
        // }
    }
}

