// entities.js —— 实体类（玩家/子弹/敌人/道具/Boss）与增强像素风绘制

import { DIR, DIR_VEC, TILE_TYPE, ENEMY_STATS, TANK_SIZE, BOSS_SIZE, BULLET_SIZE } from './config.js';

/* ========== 绘制辅助 ========== */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* 绘制像素风坦克（增强版：层次感/光效/等级区分） */
export function drawTank(ctx, x, y, dir, color, size, opts = {}) {
  const { flash = false, level = 1, isEnemy = false, type = '', skin = null } = opts;
  if (skin && skin.colors) color = skin.colors[0];
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);

  const glow = flash ? 22 : 12;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;

  const half = size / 2;

  // --- 履带（像素风纹理） ---
  ctx.fillStyle = '#0a0f18';
  ctx.fillRect(-half, -half, size, 5);
  ctx.fillRect(-half, half - 5, size, 5);
  // 履带纹理点
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = -half + 2; i < half; i += 6) {
    ctx.fillRect(i, -half + 1, 3, 3);
    ctx.fillRect(i, half - 4, 3, 3);
  }

  // --- 车身 ---
  const bodyGrad = ctx.createLinearGradient(-half, -half, half, half);
  bodyGrad.addColorStop(0, skin?.colors?.[1] || '#17231a');
  bodyGrad.addColorStop(1, skin?.colors?.[0] || '#29372a');
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, -half + 3, -half + 3, size - 6, size - 6, 4);
  ctx.fill();
  // 像素纹理线
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-half + 5, 0); ctx.lineTo(half - 5, 0);
  ctx.stroke();

  // 车身描边（等级越高越亮）
  ctx.strokeStyle = color;
  ctx.lineWidth = level >= 3 ? 2.5 : level >= 2 ? 2 : 1.5;
  ctx.stroke();

  // 迷彩/高等级像素装甲片
  ctx.fillStyle = skin?.colors?.[0] || color;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(-half + 7, -half + 8, Math.max(4, level * 3), 3);
  ctx.fillRect(half - 12, half - 11, Math.max(4, level * 3), 3);
  ctx.globalAlpha = 1;

  // --- 炮管（等级区分） ---
  const barrelW = level >= 3 ? 5 : level >= 2 ? 4 : 3;
  const barrelL = half + (level >= 3 ? 10 : level >= 2 ? 8 : 6);
  const barrelGrad = ctx.createLinearGradient(0, -half - barrelL, 0, -half);
  barrelGrad.addColorStop(0, color);
  barrelGrad.addColorStop(1, '#0d1421');
  ctx.fillStyle = barrelGrad;
  ctx.fillRect(-barrelW / 2, -half - barrelL + half, barrelW, barrelL);
  // 炮口发光
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillRect(-barrelW / 2 - 1, -half - 2, barrelW + 2, 3);
  ctx.shadowBlur = glow;

  // --- 炮塔 ---
  ctx.beginPath();
  ctx.arc(0, 0, size * (level >= 3 ? 0.24 : 0.2), 0, Math.PI * 2);
  const turretGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.24);
  turretGrad.addColorStop(0, color);
  turretGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = turretGrad;
  ctx.fill();

  // --- 敌人等级标记 ---
  if (isEnemy && (type === 'heavy' || type === 'elite')) {
    ctx.fillStyle = type === 'elite' ? '#ffd166' : '#ff9a3c';
    ctx.fillRect(-3, half - 9, 6, 4);
  }

  ctx.restore();
}

/* 绘制子弹（增强：拖尾+发光） */
export function drawBullet(ctx, b, trails) {
  const cx = b.x + b.size / 2, cy = b.y + b.size / 2;

  // 拖尾
  if (trails) {
    const key = b;
    if (!trails.has(b)) trails.set(b, []);
    const arr = trails.get(b);
    arr.push({ x: cx, y: cy, life: 0.15 });
    if (arr.length > 6) arr.shift();
    ctx.save();
    for (const t of arr) {
      t.life -= 0.016;
      if (t.life <= 0) continue;
      ctx.globalAlpha = t.life / 0.15 * 0.5;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, b.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 主体：不同弹种使用像素化的形状和颜色
  ctx.save();
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = b.color;
  if (b.kind === 'laser') {
    ctx.fillRect(cx - b.size * 0.35, cy - b.size * 1.5, b.size * 0.7, b.size * 3);
  } else if (b.kind === 'flame') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - b.size); ctx.lineTo(cx + b.size * .75, cy);
    ctx.lineTo(cx, cy + b.size); ctx.lineTo(cx - b.size * .75, cy); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(cx - b.size / 2, cy - b.size / 2, b.size, b.size);
  }
  // 内核高光
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, b.size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const POWERUP_SHAPES = {
  POWER:  '#ffd166',
  SPEED:  '#39ff88',
  SHIELD: '#93c47d',
  LIFE:   '#c98354',
  BOMB:   '#ff9a3c',
  PIERCE: '#bf7bff',
};

/* ========== 玩家 ========== */
export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.size = TANK_SIZE;
    this.dir = DIR.UP;
    this.speed = 150;
    this.maxHp = 4;
    this.hp = this.maxHp;
    this.fireLevel = 1;
    this.fireCooldown = 0;
    this.shieldTimer = 3;
    this.speedTimer = 0;
    this.pierceTimer = 0;
    this.alive = true;
    this.skinId = 'standard';
    this.weaponId = 'cannon';
  }
}

/* ========== 子弹 ========== */
export class Bullet {
  constructor(x, y, dir, owner, opts = {}) {
    this.x = x; this.y = y;
    this.size = BULLET_SIZE;
    this.owner = owner;
    this.speed = opts.speed ?? (owner === 'player' ? 400 : 220);
    this.damage = opts.damage ?? 1;
    this.pierce = opts.pierce ?? false;
    this.kind = opts.kind ?? (owner === 'player' ? 'normal' : 'enemy');
    this.color = opts.color ?? (owner === 'player' ? '#f4e8b1' : '#c98354');
    this.alive = true;
    if (opts.angle !== undefined) {
      this.vx = Math.cos(opts.angle) * this.speed;
      this.vy = Math.sin(opts.angle) * this.speed;
    } else {
      const v = DIR_VEC[dir];
      this.vx = v.x * this.speed;
      this.vy = v.y * this.speed;
    }
  }
}

/* ========== 敌人 ========== */
export class Enemy {
  constructor(type, x, y, diffParams = {}) {
    const s = ENEMY_STATS[type];
    this.type = type;
    this.x = x; this.y = y;
    this.size = TANK_SIZE;
    this.dir = DIR.DOWN;
    this.speed = s.speed * (diffParams.enemySpeedMul ?? 1);
    this.maxHp = Math.max(1, Math.round(s.hp * (diffParams.enemyHpMul ?? 1)));
    this.hp = this.maxHp;
    this.score = s.score;
    this.fireRate = s.fireRate * (diffParams.enemyFireRateMul ?? 1);
    this.fireTimer = 0.6 + Math.random() * 0.8;
    this.aiTimer = 0.5 + Math.random();
    this.alive = true;
    this.color = type === 'elite' ? '#ffd166' : type === 'heavy' ? '#ff9a3c' : '#ff6b35';
    this.weaponKind = type === 'elite' ? 'laser' : type === 'heavy' ? 'flame' : 'normal';
  }
}

/* ========== Boss ========== */
export class Boss {
  constructor(x, y, maxHp) {
    this.x = x; this.y = y;
    this.size = BOSS_SIZE;
    this.dir = DIR.DOWN;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.phase = 1;
    this.speed = 30;
    this.attackTimer = 1.2;
    this.spawnTimer = 8;
    this.moveTimer = 1.2;
    this.alive = true;
    this.name = '毁灭者 D-9';
    this.color = '#d6b45a';
  }
}

/* ========== 道具 ========== */
export const POWERUP_TYPES = ['POWER', 'SPEED', 'SHIELD', 'LIFE', 'BOMB', 'PIERCE'];

export class PowerUp {
  constructor(type, x, y) {
    this.type = type;
    this.x = x; this.y = y;
    this.size = 20;
    this.t = Math.random() * Math.PI * 2;
    this.alive = true;
    this.color = POWERUP_SHAPES[type];
  }
}

/* 绘制道具 */
export function drawPowerup(ctx, p) {
  const cx = p.x + p.size / 2;
  const cy = p.y + p.size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(p.t) * 0.3);
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(0, -p.size * 0.5);
  ctx.lineTo(p.size * 0.5, 0);
  ctx.lineTo(0, p.size * 0.5);
  ctx.lineTo(-p.size * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 内部图标文字
  ctx.fillStyle = '#0a0e17';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const icons = { POWER: 'P', SPEED: 'S', SHIELD: 'D', LIFE: '+', BOMB: 'B', PIERCE: 'R' };
  ctx.fillText(icons[p.type] || '?', 0, 0);
  ctx.restore();
}
