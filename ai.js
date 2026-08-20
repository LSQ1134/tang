// ai.js —— 敌方坦克 AI 与 Boss 行为

import { DIR, DIR_VEC } from './config.js';
import { moveWithCollision } from './collision.js';

/* 将朝向玩家的方向吸附到最近的 4 方向 */
function dirToward(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? DIR.RIGHT : DIR.LEFT;
  }
  return dy >= 0 ? DIR.DOWN : DIR.UP;
}

/* ---------- 普通/精英敌人 ---------- */
export function updateEnemyAI(enemy, dt, game) {
  const player = game.player;
  const v = DIR_VEC[enemy.dir];

  enemy.aiTimer -= dt;
  if (enemy.aiTimer <= 0) {
    // 一半概率朝玩家，一半随机
    if (Math.random() < 0.5 && player.alive) {
      enemy.dir = dirToward(enemy, player);
    } else {
      enemy.dir = Math.floor(Math.random() * 4);
    }
    enemy.aiTimer = 0.9 + Math.random() * 1.4;
  }

  const blocked = moveWithCollision(
    enemy,
    v.x * enemy.speed * dt,
    v.y * enemy.speed * dt,
    game.grid,
    game.getBlockers()
  );
  if (blocked && Math.random() < 0.4) {
    enemy.dir = Math.floor(Math.random() * 4);
  }

  // 射击：朝向玩家方向发射
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0 && player.alive) {
    const d = dirToward(enemy, player);
    game.spawnEnemyBullet(enemy, d);
    if (enemy.type === 'elite') {
      // 精英三连弹
      game.spawnEnemyBullet(enemy, (d + 3) % 4);
      game.spawnEnemyBullet(enemy, (d + 1) % 4);
    }
    enemy.fireTimer = enemy.fireRate;
  }
}

/* ---------- Boss ---------- */
export function updateBossAI(boss, dt, game) {
  const player = game.player;
  const ratio = boss.hp / boss.maxHp;

  // 阶段判定
  const newPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
  if (newPhase !== boss.phase) {
    boss.phase = newPhase;
    boss.speed = boss.phase === 3 ? 55 : 30;
    game.onBossPhaseChange(boss.phase);
  }

  // 移动：与玩家保持距离
  boss.moveTimer -= dt;
  if (boss.moveTimer <= 0) {
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy);
    let dir;
    if (dist < 160) {
      dir = dirToward({ x: boss.x, y: boss.y }, { x: player.x - dx * 2, y: player.y - dy * 2 });
    } else {
      dir = dirToward(boss, player);
    }
    boss.dir = dir;
    boss.moveTimer = boss.phase === 3 ? 0.5 : 1.0;
  }

  const v = DIR_VEC[boss.dir];
  moveWithCollision(boss, v.x * boss.speed * dt, v.y * boss.speed * dt, game.grid, game.getBlockers());

  // 攻击
  boss.attackTimer -= dt;
  boss.spawnTimer -= dt;

  if (boss.phase === 1) {
    if (boss.attackTimer <= 0) {
      game.fireBossAimedShot(boss);
      boss.attackTimer = 1.5;
    }
  } else if (boss.phase === 2) {
    if (boss.attackTimer <= 0) {
      game.fireBossSpreadShot(boss, 5, Math.PI / 5);
      boss.attackTimer = 2.2;
    }
    if (boss.spawnTimer <= 0) {
      game.spawnElite();
      game.spawnElite();
      boss.spawnTimer = 8;
    }
  } else {
    if (boss.attackTimer <= 0) {
      game.fireBossRingShot(boss, 24);
      boss.attackTimer = 2.6;
    }
    if (boss.spawnTimer <= 0) {
      game.fireBossSpreadShot(boss, 7, Math.PI / 4);
      boss.spawnTimer = 3.5;
    }
  }
}