// particles.js —— 粒子 / 爆炸 / 光效系统

export class ParticleSystem {
  constructor() {
    this.list = [];
    this.maxParticles = 260;
  }

  spawn(x, y, color, count = 18) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 160;
      this.list.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
    if (this.list.length > this.maxParticles) {
      this.list.splice(0, this.list.length - this.maxParticles);
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = Math.max(2, Math.ceil(p.size));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.restore();
  }

  clear() {
    this.list = [];
  }
}
