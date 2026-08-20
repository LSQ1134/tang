// config.js —— 常量 / 枚举 / 数值平衡 / 难度 / 模式

export const CANVAS_W = 1260;
export const CANVAS_H = 740;
export const TILE = 20;
export const COLS = CANVAS_W / TILE; // 63
export const ROWS = CANVAS_H / TILE; // 37
export const BG_IMAGE = '坦克大战的背景.jpg';

export const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
export const DIR_VEC = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export const TILE_TYPE = {
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  WATER: 3,
  GRASS: 4,
  BASE: 5,
};

export const COLORS = {
  bg: '#0b110d',
  grid: 'rgba(135, 196, 121, 0.08)',
  primary: '#93c47d',
  accent: '#d6b45a',
  danger: '#c98354',
  success: '#b7d78a',
  gold: '#ffd166',
  player: '#9fd48a',
  enemy: '#b86f52',
  boss: '#d6b45a',
  brick: '#8d6147',
  steel: '#8c958c',
  water: '#526b5a',
  grass: '#55734d',
  base: '#ffd166',
};

export const TANK_SIZE = 36;
export const BOSS_SIZE = 60;
export const BULLET_SIZE = 6;

/* ---------- 难度系统 ---------- */
export const DIFFICULTY = {
  EASY: 'easy',
  NORMAL: 'normal',
  HARD: 'hard',
};

// 每个难度的调节因子
export const DIFFICULTY_PARAMS = {
  easy: {
    playerHpMul: 1.5,        // 玩家血量倍率
    playerDmgMul: 1.2,       // 玩家伤害倍率
    spawnIntervalMul: 1.6,   // 刷怪间隔倍率（越大越慢刷）
    enemyHpMul: 0.7,         // 敌人血量倍率
    enemySpeedMul: 0.8,      // 敌人速度倍率
    enemyFireRateMul: 1.4,   // 敌人射击间隔倍率（越大射越慢）
    bossHpMul: 0.7,          // Boss 血量倍率
    powerupDropRate: 0.30,   // 道具掉率
    maxEnemyOnScreen: 4,     // 同屏最大敌人数
    eliteAppearWave: 12,     // 精英兵最早出现的波次
    heavyAppearWave: 8,      // 重装兵最早出现的波次
    label: '简单',
  },
  normal: {
    playerHpMul: 1.0,
    playerDmgMul: 1.0,
    spawnIntervalMul: 1.0,
    enemyHpMul: 1.0,
    enemySpeedMul: 1.0,
    enemyFireRateMul: 1.0,
    bossHpMul: 1.0,
    powerupDropRate: 0.22,
    maxEnemyOnScreen: 6,
    eliteAppearWave: 8,
    heavyAppearWave: 5,
    label: '普通',
  },
  hard: {
    playerHpMul: 0.8,
    playerDmgMul: 1.0,
    spawnIntervalMul: 0.7,
    enemyHpMul: 1.3,
    enemySpeedMul: 1.2,
    enemyFireRateMul: 0.7,
    bossHpMul: 1.5,
    powerupDropRate: 0.15,
    maxEnemyOnScreen: 10,
    eliteAppearWave: 4,
    heavyAppearWave: 3,
    label: '困难',
  },
};

/* ---------- 游戏模式 ---------- */
export const GAME_MODE = {
  CAMPAIGN: 'campaign',   // 通关模式：固定关卡，清敌过关
  ENDLESS: 'endless',     // 无尽模式：无限波次，记录生存波数+击杀
};

/* ---------- 基础数值（会被难度因子调节） ---------- */
export const BALANCE = {
  playerSpeed: 150,
  playerHp: 4,             // 基础生命值提升至 4
  playerFireCooldown: 0.30,
  bulletSpeed: 400,
  enemyBulletSpeed: 220,
  shieldDuration: 5,
  speedBoostDuration: 8,
  pierceDuration: 8,
  speedBoostFactor: 1.5,
  powerupDropRate: 0.22,
  bossHp: 150,
  bossWaveEvery: 5,
  spawnInterval: 1.6,      // 基础刷怪间隔稍拉长
};

export const ENEMY_STATS = {
  scout:   { speed: 90,  hp: 1, fireRate: 1.8, score: 100 },
  regular: { speed: 65,  hp: 1, fireRate: 1.4, score: 100 },
  rapid:   { speed: 60,  hp: 1, fireRate: 0.6, score: 150 },
  heavy:   { speed: 42,  hp: 3, fireRate: 1.6, score: 250 },
  elite:   { speed: 68,  hp: 2, fireRate: 1.0, score: 300 },
};

/* ---------- 移动端 / 触控 ---------- */
export const TOUCH = {
  joystickRadius: 55,     // 摇杆外圈半径（CSS px）
  joystickDead: 12,       // 死区半径
  fireBtnRadius: 36,      // 射击按钮半径
  minPinchScale: 0.4,
  maxPinchScale: 2.0,
};

/* ---------- 通关模式关卡数 ---------- */
export const CAMPAIGN_TOTAL_LEVELS = 50;

export const SKINS = [
  { id: 'standard', name: '军绿', price: 0, colors: ['#9fd48a', '#496b47'] },
  { id: 'gold', name: '黄金', price: 120, colors: ['#ffd166', '#8f6d25'] },
  { id: 'shadow', name: '暗影', price: 180, colors: ['#a69ca8', '#34303d'] },
  { id: 'camo', name: '迷彩', price: 220, colors: ['#b0b77c', '#4c5d43'] },
  { id: 'flame', name: '火焰', price: 260, colors: ['#e0a35d', '#8d4f3d'] },
  { id: 'ice', name: '冰雪', price: 300, colors: ['#c5d7bf', '#66877a'] },
];

export const WEAPONS = [
  { id: 'cannon', name: '标准炮', icon: '●', price: 0, desc: '均衡的基础弹种', speed: 400, damage: 1, kind: 'normal' },
  { id: 'rapid', name: '速射炮', icon: '»', price: 150, desc: '高射速，伤害略低', speed: 470, damage: 1, cooldown: 0.20, kind: 'normal' },
  { id: 'pierce', name: '穿甲弹', icon: '◆', price: 220, desc: '穿透敌人和钢墙', speed: 420, damage: 2, pierce: true, kind: 'laser' },
  { id: 'explosive', name: '爆炸弹', icon: '✹', price: 260, desc: '命中时产生范围冲击', speed: 330, damage: 3, kind: 'flame' },
  { id: 'freeze', name: '冰冻弹', icon: '❄', price: 240, desc: '减缓敌人移动速度', speed: 360, damage: 1, kind: 'ice' },
  { id: 'lightning', name: '闪电弹', icon: 'ϟ', price: 320, desc: '高速发光电弧弹', speed: 560, damage: 2, kind: 'laser' },
  { id: 'spread', name: '散弹', icon: '⁙', price: 280, desc: '一次发射三枚弹丸', speed: 360, damage: 1, spread: true, kind: 'flame' },
];
