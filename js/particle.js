export class Particle {
    constructor(x, y, sprite) {
        this.x = x;
        this.y = y;
        this.sprite = sprite;
        this.isEmoji = /\p{Emoji}/u.test(sprite);
        this.size = this.isEmoji ? 20 : Math.random() * 5 + 2;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 100;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life / 100;
        if (this.isEmoji) {
            ctx.font = `${this.size}px sans-serif`;
            ctx.fillText(this.sprite, this.x, this.y);
        } else {
            ctx.fillStyle = this.sprite;
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        ctx.globalAlpha = 1.0;
    }

    update(GRAVITY) {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += GRAVITY * 0.1;
        this.life--;
        if (this.isEmoji && this.size > 0.2) this.size -= 0.2;
    }
}

