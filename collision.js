// collision.js —— 碰撞检测与移动（纯函数）

import { TILE, COLS, ROWS, TILE_TYPE } from './config.js';

// 坦克不可通行的地形
export function isSolidForTank(tile) {
  return tile === TILE_TYPE.BRICK ||
         tile === TILE_TYPE.STEEL ||
         tile === TILE_TYPE.WATER ||
         tile === TILE_TYPE.BASE;
}

/* 矩形碰撞检测（AABB） */
export function aabb(a, b, sizeA, sizeB) {
  return a.x < b.x + sizeB &&
         a.x + sizeA > b.x &&
         a.y < b.y + sizeB &&
         a.y + sizeA > b.y;
}

/* 判断以 (x, y) 为左上角、边长 size 的方块能否放置（不压到实体地形 / 不出界） */
export function canOccupy(x, y, size, grid) {
  const x0 = Math.floor(x / TILE);
  const y0 = Math.floor(y / TILE);
  const x1 = Math.floor((x + size - 1) / TILE);
  const y1 = Math.floor((y + size - 1) / TILE);
  for (let r = y0; r <= y1; r++) {
    for (let c = x0; c <= x1; c++) {
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return false; // 出界视为不可通过
      if (isSolidForTank(grid[r][c])) return false;
    }
  }
  return true;
}

/* 是否与任意其它坦克（blockers）发生重叠 */
export function overlapsOthers(x, y, size, self, blockers) {
  for (const b of blockers) {
    if (b === self || !b.alive) continue;
    if (aabb({ x, y }, b, size, b.size)) return true;
  }
  return false;
}

/*
 * 轴向分离移动：先 X 后 Y，遇到障碍只在该轴停止，可沿墙滑动。
 * 返回是否在任一轴被阻挡。
 */
export function moveWithCollision(entity, dx, dy, grid, blockers) {
  let blocked = false;

  let nx = entity.x + dx;
  if (canOccupy(nx, entity.y, entity.size, grid) &&
      !overlapsOthers(nx, entity.y, entity.size, entity, blockers)) {
    entity.x = nx;
  } else if (dx !== 0) {
    blocked = true;
  }

  let ny = entity.y + dy;
  if (canOccupy(entity.x, ny, entity.size, grid) &&
      !overlapsOthers(entity.x, ny, entity.size, entity, blockers)) {
    entity.y = ny;
  } else if (dy !== 0) {
    blocked = true;
  }

  return blocked;
}

/* 获取 (px, py) 所在的格子，越界返回 null */
export function tileAt(px, py, grid) {
  const c = Math.floor(px / TILE);
  const r = Math.floor(py / TILE);
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
  return { r, c, tile: grid[r][c] };
}