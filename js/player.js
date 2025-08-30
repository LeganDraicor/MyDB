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
        
        // Estos valores se inicializarán con datos del servidor
        this.score = 0;
        this.draicorCoins = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.attack = 1;
        this.defense = 1;
        this.username = "Player";

        this.x = 0;
        this.y = 0;
    }

    // ¡NUEVO! Método para poblar al jugador con datos del backend
    initializeWithData(playerData) {
        this.score = playerData.GameplayScore || 0;
        this.draicorCoins = playerData.DraicorCoins || 0;
        this.maxHp = playerData.HP_Max || 100;
        this.hp = this.maxHp; // Empieza con la vida al máximo
        this.attack = playerData.Attack || 1;
        this.defense = playerData.Defense || 1;
        this.username = playerData.Username || "Player";
    }

    resetPosition(GAME_WIDTH, GAME_HEIGHT) {
        this.x = GAME_WIDTH / 2 - this.width / 2;
        this.y = GAME_HEIGHT - this.height - 50;
        this.vx = 0;
        this.vy = 0;
        if (this.hp <= 0) {
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

        // Simple cálculo de daño con defensa
        const damageTaken = Math.max(1, damageAmount - this.defense);
        this.hp -= damageTaken;
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

    addScore(points) {
        this.score += points;
        // La puntuación ahora se guarda en el servidor al final del juego
    }
}

