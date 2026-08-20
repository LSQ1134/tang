// map.js —— 地图生成（含中央 LSQ 姓名缩写布局）

import { COLS, ROWS, TILE_TYPE } from './config.js';

// 5x7 像素字模：1 = 砖墙
const LETTERS = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  Q: ['01110', '10001', '10001', '10001', '10011', '01101', '00001'],
};

export function createGrid() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push(new Array(COLS).fill(TILE_TYPE.EMPTY));
  }

  stampLSQ(grid, 18, 31); // 地图正中央拼出 LSQ
  buildBaseNest(grid);    // 底部中央基地鹰巢
  addScenery(grid);       // 钢墙 / 水域 / 草丛点缀

  return grid;
}

function stampLSQ(grid, centerRow, centerCol) {
  const word = ['L', 'S', 'Q'];
  const spacing = 2;
  const letterW = 5, letterH = 7;
  const totalW = word.length * letterW + (word.length - 1) * spacing;
  let col = centerCol - Math.floor(totalW / 2);

  for (const ch of word) {
    const px = LETTERS[ch];
    for (let r = 0; r < letterH; r++) {
      for (let c = 0; c < letterW; c++) {
        if (px[r][c] === '1') {
          const gr = centerRow - 3 + r;
          const gc = col + c;
          if (gr >= 0 && gr < ROWS && gc >= 0 && gc < COLS) {
            grid[gr][gc] = TILE_TYPE.BRICK;
          }
        }
      }
    }
    col += letterW + spacing;
  }
}

function buildBaseNest(grid) {
  const br = ROWS - 4; // 基地所在行（上方开口）
  const bc = 31;       // 基地所在列
  // 基地本体
  grid[br + 1][bc] = TILE_TYPE.BASE;
  // 左右两翼
  grid[br][bc - 1] = TILE_TYPE.BRICK;
  grid[br][bc + 1] = TILE_TYPE.BRICK;
  grid[br + 1][bc - 1] = TILE_TYPE.BRICK;
  grid[br + 1][bc + 1] = TILE_TYPE.BRICK;
  // 底部
  grid[br + 2][bc - 1] = TILE_TYPE.BRICK;
  grid[br + 2][bc] = TILE_TYPE.BRICK;
  grid[br + 2][bc + 1] = TILE_TYPE.BRICK;
}

function setRect(grid, r0, c0, h, w, tile) {
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        grid[r][c] = tile;
      }
    }
  }
}

function addScenery(grid) {
  // 钢墙：靠近中心两侧，增强策略性
  setRect(grid, 9, 12, 1, 4, TILE_TYPE.STEEL);
  setRect(grid, 9, 47, 1, 4, TILE_TYPE.STEEL);
  setRect(grid, 27, 12, 1, 4, TILE_TYPE.STEEL);
  setRect(grid, 27, 47, 1, 4, TILE_TYPE.STEEL);

  // 水域：左右两侧中部
  setRect(grid, 15, 3, 5, 2, TILE_TYPE.WATER);
  setRect(grid, 15, 58, 5, 2, TILE_TYPE.WATER);

  // 草丛：顶部与底部若干
  setRect(grid, 3, 20, 2, 4, TILE_TYPE.GRASS);
  setRect(grid, 3, 39, 2, 4, TILE_TYPE.GRASS);
  setRect(grid, 29, 20, 2, 4, TILE_TYPE.GRASS);
  setRect(grid, 29, 39, 2, 4, TILE_TYPE.GRASS);

  // 零散砖墙掩体（避开中央 LSQ、基地与出生点）
  setRect(grid, 7, 26, 2, 2, TILE_TYPE.BRICK);
  setRect(grid, 7, 35, 2, 2, TILE_TYPE.BRICK);
  setRect(grid, 24, 5, 2, 2, TILE_TYPE.BRICK);
  setRect(grid, 24, 56, 2, 2, TILE_TYPE.BRICK);
  setRect(grid, 25, 14, 2, 2, TILE_TYPE.BRICK);
  setRect(grid, 25, 47, 2, 2, TILE_TYPE.BRICK);
}