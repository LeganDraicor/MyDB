import { playSound } from './main.js'; // Importaremos playSound si la movemos a main

const GRAVITY = 0.6;
const PLAYER_JUMP = -10;
const JUMP_HOLD_GRAVITY = GRAVITY * 0.5;
const PLAYER_SPEED = 5;
const GAME_WIDTH = 960;

// Necesitaremos una referencia al sonido de salto
let soundJump; 
export function setPlayerDependencies(jumpSound) {
    soundJump = jumpSound;
}

export class Player {
    constructor(id, controls, sprite, playerData) {
        this.id = id;
        this.width = 40;
        this.height = 40;
        this.controls = controls;
        this.sprite = sprite;
        
        // Datos del servidor
        this.username = playerData.Username;
        this.maxHp = playerData.HP_Max || 1000;
        this.hp = this.maxHp;
        this.attack = playerData.Attack || 1;
        this.defense = playerData.Defense || 1;

        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.onFrozenPlatform = false;
        this.isDead = false;
        this.score = 0;
        
        this.resetPosition();
    }
    
    resetPosition() {
        this.x = GAME_WIDTH / 2 - this.width / 2 + (this.id === 1 ? -50 : 50);
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
    
    update(keys, particles, Particle) { // Pasamos dependencias
        if (this.isDead) return;

        if (keys[this.controls.jump] && this.onGround) {
            this.jump();
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
    
    jump() {
        if (this.onGround && !this.isDead) {
            this.vy = PLAYER_JUMP;
            // playSound(soundJump); // La lógica de sonido se manejará en main.js
        }
    }
    
    die(damageAmount, particles, Particle, checkGameOver, soundLoseLife) {
        if (this.isDead) return;
        
        this.hp -= damageAmount;
        // playSound(soundLoseLife);

        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
            for (let i = 0; i < 50; i++) {
                particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, this.sprite));
            }
            checkGameOver();
        }
    }
    
    addScore(points, updateHighScore) {
        this.score += points;
        updateHighScore(this.score);
    }
}

