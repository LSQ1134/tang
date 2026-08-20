// main.js —— 入口：加载底图、状态机、游戏循环、波次/Boss/胜负/难度/模式/触控

import {
  CANVAS_W, CANVAS_H, TILE, COLS, ROWS, BG_IMAGE,
  DIR, DIR_VEC, TILE_TYPE, COLORS, TANK_SIZE, BULLET_SIZE, BALANCE,
  DIFFICULTY, DIFFICULTY_PARAMS, GAME_MODE, CAMPAIGN_TOTAL_LEVELS, TOUCH, SKINS, WEAPONS,
} from './config.js';
import { createInput } from './input.js';
import { createGrid } from './map.js';
import { Player, Bullet, Enemy, Boss, PowerUp, drawTank, drawBullet, drawPowerup, roundRect } from './entities.js';
import { canOccupy, overlapsOthers, moveWithCollision, tileAt, aabb } from './collision.js';
import { updateEnemyAI, updateBossAI } from './ai.js';
import { ParticleSystem } from './particles.js';
import { audio } from './audio.js';
import {
  updateHud, showBossBar, setBossBar, showBanner, hideBanner,
  showOverlay, showMenu, hideOverlay, setStartHandler, showPauseOverlay,
  showLevelIntro, hideLevelIntro, bindLobbyOptions, setLobbySelection,
  showTouchControls, isTouchDevice, bindGlobalControls, updateSoundButton,
  showConfirm, showWarehouse, hideWarehouse,
  updateLobbyCoins, showOrientationPrompt, bindOrientationRetry,
} from './ui.js';

const SPAWN_COLS = [3, 16, 31, 46, 59];
const POWERUP_TYPES = ['POWER', 'SPEED', 'SHIELD', 'LIFE', 'BOMB', 'PIERCE'];

class Game {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.input = createInput();
    this.particles = new ParticleSystem();

    this.bgImg = new Image();
    this.bgImg.src = BG_IMAGE;

    // 大厅默认值
    this.selectedMode = GAME_MODE.CAMPAIGN;
    this.selectedDiff = DIFFICULTY.NORMAL;
    this.diffParams = DIFFICULTY_PARAMS.normal;
    this.gameMode = GAME_MODE.CAMPAIGN;
    this.profile = this.loadProfile();
    this.lastUiClick = 0;

    this.state = 'menu';
    this.time = 0;
    this.shake = 0;
    this.bulletTrails = new Map();

    // 触控状态
    this.touchActive = isTouchDevice();
    this.touchDir = { x: 0, y: 0 };
    this.touchFire = false;

    this.reset();

    // 大厅按钮绑定
    bindLobbyOptions(
      (mode) => { this.selectedMode = mode; },
      (diff) => { this.selectedDiff = diff; this.diffParams = DIFFICULTY_PARAMS[diff]; }
    );
    setStartHandler(() => this.start());
    bindGlobalControls({
      onSound: () => { audio.setEnabled(!audio.enabled); updateSoundButton(audio.enabled); audio.click(); },
      onHome: () => this.confirmHome(),
      onPause: () => this.togglePause(),
      onWarehouse: () => this.openWarehouse(),
    });
    updateSoundButton(audio.enabled);

    // 暂停键
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
        this.togglePause();
      }
    });

    // 触控绑定
    if (this.touchActive) {
      this.bindTouch();
      showTouchControls(true);
      this.bindOrientationHandling();
    }

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  isPortraitMobile() {
    return this.touchActive && this.state !== 'menu' && window.matchMedia?.('(orientation: portrait)').matches;
  }

  async requestLandscape() {
    if (!this.touchActive) return;
    try {
      if (screen.orientation?.lock) await screen.orientation.lock('landscape');
    } catch (e) {
      // iOS/微信等环境可能只允许在全屏或用户手势中锁定，交给旋转提示降级。
    }
    showOrientationPrompt(this.isPortraitMobile());
  }

  bindOrientationHandling() {
    const refresh = () => showOrientationPrompt(this.isPortraitMobile());
    window.addEventListener('orientationchange', () => setTimeout(refresh, 120));
    window.addEventListener('resize', refresh, { passive: true });
    bindOrientationRetry(() => this.requestLandscape());
    refresh();
  }

  loadProfile() {
    const fallback = { coins: 0, ownedSkins: ['standard'], ownedWeapons: ['cannon'], skinId: 'standard', weaponId: 'cannon' };
    try { return { ...fallback, ...(JSON.parse(window.localStorage?.getItem('tank-profile') || '{}')) }; } catch { return fallback; }
  }
  saveProfile() { try { window.localStorage?.setItem('tank-profile', JSON.stringify(this.profile)); } catch (e) {} }
  getSkin() { return SKINS.find((s) => s.id === this.profile.skinId) || SKINS[0]; }
  getWeapon() { return WEAPONS.find((w) => w.id === this.profile.weaponId) || WEAPONS[0]; }
  openWarehouse(tab = 'skins') {
    const profile = this.profile;
    showWarehouse({
      coins: profile.coins,
      skinCatalog: SKINS.map((s) => ({ ...s, owned: profile.ownedSkins.includes(s.id), equipped: profile.skinId === s.id })),
      weaponCatalog: WEAPONS.map((w) => ({ ...w, owned: profile.ownedWeapons.includes(w.id), equipped: profile.weaponId === w.id })),
    }, tab, (kind, id) => this.warehouseAction(kind, id));
  }
  warehouseAction(kind, id) {
    const list = kind === 'skins' ? SKINS : WEAPONS;
    const item = list.find((x) => x.id === id);
    if (!item) return;
    const owned = kind === 'skins' ? this.profile.ownedSkins : this.profile.ownedWeapons;
    if (!owned.includes(id)) {
      if (this.profile.coins < item.price) { showBanner('金币不足', '完成关卡或击杀敌人获得金币', true); return; }
      this.profile.coins -= item.price; owned.push(id); audio.purchase();
    }
    if (kind === 'skins') this.profile.skinId = id;
    else this.profile.weaponId = id;
    this.saveProfile();
    this.openWarehouse(kind);
  }
  confirmHome() {
    if (this.state === 'menu') return;
    showConfirm(() => { audio.stopBGM(); audio.stopMove(); this.state = 'menu'; this.reset(); showMenu(); });
  }

  reset() {
    updateLobbyCoins(this.profile.coins);
    this.grid = createGrid();
    this.diffParams = DIFFICULTY_PARAMS[this.selectedDiff];
    this.gameMode = this.selectedMode;

    // 根据难度调整玩家血量
    const hp = Math.max(1, Math.round(BALANCE.playerHp * this.diffParams.playerHpMul));
    this.player = new Player(31 * TILE + (TILE - TANK_SIZE) / 2, 31 * TILE + (TILE - TANK_SIZE) / 2);
    this.player.skinId = this.profile.skinId;
    this.player.weaponId = this.profile.weaponId;
    this.player.maxHp = hp;
    this.player.hp = hp;

    this.enemies = [];
    this.boss = null;
    this.playerBullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles.clear();
    this.bulletTrails.clear();
    this.score = 0;
    this.kills = 0;
    this.wave = 0;
    this.level = 1;      // 通关模式关卡
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveClearStarted = false;
    this.waveClearTimer = 0;
    this.bossIntroTimer = 0;
    this.levelIntroPlaying = false;
    this.baseDestroyed = false;
    this.shake = 0;
    this.isMoving = false;
    showBossBar(false);
  }

  start() {
    audio.init();
    audio.resume();
    this.reset();
    this.state = 'level_intro';
    this.levelIntroPlaying = true;
    // 必须在状态切换后请求横屏，否则 isPortraitMobile() 会把大厅状态误判为无需提示。
    this.requestLandscape();
    hideOverlay();
    hideBanner();

    // 关卡开场动画
    const text = this.gameMode === 'campaign'
      ? 'LEVEL ' + String(this.level).padStart(2, '0')
      : 'ENDLESS';
    showLevelIntro(text, this.diffParams.label + ' 难度');

    // BGM 淡入
    audio.startBGM();

    // 2.3 秒后进入游戏
    setTimeout(() => {
      this.levelIntroPlaying = false;
      hideLevelIntro();
      this.state = 'playing';
      this.nextWave();
    }, 2300);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      audio.stopBGM();
      showPauseOverlay(true);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      audio.startBGM();
      showPauseOverlay(false);
      this.lastTime = performance.now();
    }
  }

  /* ---------- 波次（难度感知） ---------- */
  typePool(wave) {
    const dp = this.diffParams;
    const pool = ['scout', 'regular'];
    const delay = this.gameMode === GAME_MODE.CAMPAIGN ? 2 : 0;
    if (wave >= (dp.heavyAppearWave ?? 5) + delay) pool.push('heavy');
    if (wave >= (dp.eliteAppearWave ?? 8) + delay) pool.push('elite');
    // rapid 在第 3 波后出现
    if (wave >= 3) pool.push('rapid');
    return pool;
  }

  nextWave() {
    this.wave++;
    this.waveClearStarted = false;

    // 通关模式：检查是否打完所有关卡
    if (this.gameMode === 'campaign' && this.level > CAMPAIGN_TOTAL_LEVELS) {
      this.victory();
      return;
    }

    const isBossWave = this.wave % BALANCE.bossWaveEvery === 0;
    if (isBossWave) {
      this.spawnBoss();
    } else {
      const pool = this.typePool(this.wave);
      const baseCount = Math.min(3 + this.wave, 12);
      const campaignMul = this.gameMode === GAME_MODE.CAMPAIGN ? 0.8 : 1;
      const count = Math.max(2, Math.round(baseCount * campaignMul / (this.diffParams.spawnIntervalMul ?? 1)));
      this.spawnQueue = Array.from({ length: count }, () => pool[(Math.random() * pool.length) | 0]);
      this.spawnTimer = 0.5;
      showBanner('第 ' + this.wave + ' 波', '击退所有敌人');
    }
    updateHud(this);
  }

  spawnBoss() {
    const chapter = Math.floor((this.wave - 1) / BALANCE.bossWaveEvery);
    const hp = Math.round((BALANCE.bossHp + chapter * 50) * (this.diffParams.bossHpMul ?? 1));
    this.boss = new Boss(COLS / 2 * TILE - 30, 10, hp);
    this.state = 'boss_intro';
    this.bossIntroTimer = 2.2;
    showBossBar(true);
    setBossBar(1, this.boss.name);
    showBanner(this.boss.name, 'WARNING · 关底 BOSS', true);
    audio.boss();
    this.shake = 0.5;
    // 无尽模式每 5 波额外加入一组精英敌群，Boss 波仍保留。
    if (this.gameMode === GAME_MODE.ENDLESS) {
      for (let i = 0; i < 3; i++) {
        const col = SPAWN_COLS[(i + 1) % SPAWN_COLS.length];
        this.enemies.push(new Enemy('elite', col * TILE + (TILE - TANK_SIZE) / 2, 4 + i * 42, this.diffParams));
      }
    }
  }

  spawnOne() {
    const type = this.spawnQueue.shift();
    if (!type) return;
    // 同屏最大敌人数限制
    const maxOnScreen = this.diffParams.maxEnemyOnScreen ?? 6;
    if (this.enemies.filter((e) => e.alive).length >= maxOnScreen) {
      this.spawnQueue.unshift(type); // 放回队列
      return;
    }
    for (let i = 0; i < 12; i++) {
      const col = SPAWN_COLS[(Math.random() * SPAWN_COLS.length) | 0];
      const x = col * TILE + (TILE - TANK_SIZE) / 2;
      const y = 4;
      if (canOccupy(x, y, TANK_SIZE, this.grid) && !overlapsOthers(x, y, TANK_SIZE, null, this.getBlockers())) {
        this.enemies.push(new Enemy(type, x, y, this.diffParams));
        return;
      }
    }
    this.enemies.push(new Enemy(type, SPAWN_COLS[2] * TILE + (TILE - TANK_SIZE) / 2, 4, this.diffParams));
  }

  spawnElite() {
    if (!this.boss) return;
    const x = this.boss.x + (Math.random() < 0.5 ? -50 : 50);
    const y = this.boss.y + 60;
    this.enemies.push(new Enemy('elite', x, y, this.diffParams));
  }

  getBlockers() {
    const arr = [];
    if (this.player.alive) arr.push(this.player);
    arr.push(...this.enemies);
    if (this.boss && this.boss.alive) arr.push(this.boss);
    return arr;
  }

  /* ---------- 子弹发射 ---------- */
  spawnEnemyBullet(from, dir, opts = {}) {
    const cx = from.x + from.size / 2;
    const cy = from.y + from.size / 2;
    this.enemyBullets.push(new Bullet(cx - BULLET_SIZE / 2, cy - BULLET_SIZE / 2, dir, 'enemy', {
      kind: from.weaponKind || 'enemy',
      color: from.type === 'elite' ? '#d6b45a' : '#c98354',
      ...opts,
    }));
  }

  firePlayer() {
    const p = this.player;
    const weapon = this.getWeapon();
    const n = weapon.spread ? 3 : p.fireLevel;
    const cx = p.x + p.size / 2;
    const cy = p.y + p.size / 2;
    const perp = (p.dir === DIR.UP || p.dir === DIR.DOWN) ? 'x' : 'y';
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 14;
      const bx = cx + (perp === 'x' ? off : 0) - BULLET_SIZE / 2;
      const by = cy + (perp === 'y' ? off : 0) - BULLET_SIZE / 2;
      this.playerBullets.push(new Bullet(bx, by, p.dir, 'player', {
        pierce: p.pierceTimer > 0 || weapon.pierce,
        damage: Math.max(1, Math.round(weapon.damage * (this.diffParams.playerDmgMul ?? 1))),
        speed: weapon.speed,
        kind: weapon.kind,
        color: weapon.kind === 'laser' ? '#b7d78a' : weapon.kind === 'flame' ? '#d88c50' : '#f4e8b1',
      }));
    }
    p.fireCooldown = weapon.cooldown || BALANCE.playerFireCooldown;
    audio.shoot();
  }

  applyExplosion(x, y, radius, damage) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dist = Math.hypot(e.x + e.size / 2 - x, e.y + e.size / 2 - y);
      if (dist <= radius) {
        e.hp -= damage;
        if (e.hp <= 0) this.damageEnemy(e, { x, y, damage: 0, kind: 'flame' });
      }
    }
    this.spawnParticles(x, y, '#d88c50', 28);
    this.shake = Math.max(this.shake, 0.35);
  }

  fireBossAimedShot(boss) {
    const p = this.player;
    const a = Math.atan2(p.y + p.size / 2 - (boss.y + boss.size / 2), p.x + p.size / 2 - (boss.x + boss.size / 2));
    const cx = boss.x + boss.size / 2, cy = boss.y + boss.size / 2;
    this.enemyBullets.push(new Bullet(cx - BULLET_SIZE / 2, cy - BULLET_SIZE / 2, 0, 'enemy', { angle: a, speed: 260, color: '#c98354' }));
  }

  fireBossSpreadShot(boss, n, spread) {
    const p = this.player;
    const base = Math.atan2(p.y + p.size / 2 - (boss.y + boss.size / 2), p.x + p.size / 2 - (boss.x + boss.size / 2));
    const cx = boss.x + boss.size / 2, cy = boss.y + boss.size / 2;
    for (let i = 0; i < n; i++) {
      const a = base - spread / 2 + (spread / (n - 1)) * i;
      this.enemyBullets.push(new Bullet(cx - BULLET_SIZE / 2, cy - BULLET_SIZE / 2, 0, 'enemy', { angle: a, speed: 230, color: '#b27b56' }));
    }
  }

  fireBossRingShot(boss, n) {
    const cx = boss.x + boss.size / 2, cy = boss.y + boss.size / 2;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i;
      this.enemyBullets.push(new Bullet(cx - BULLET_SIZE / 2, cy - BULLET_SIZE / 2, 0, 'enemy', { angle: a, speed: 200, color: '#d6b45a' }));
    }
  }

  /* ---------- 触控 ---------- */
  bindTouch() {
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    const fireBtn = document.getElementById('fire-btn');
    const baseR = TOUCH.joystickRadius;
    const dead = TOUCH.joystickDead;

    let joyTouchId = null;
    let joyCenterX = 0, joyCenterY = 0;

    const beginJoy = (clientX, clientY, id) => {
      joyTouchId = id;
      const rect = joystick.getBoundingClientRect();
      joyCenterX = rect.left + rect.width / 2;
      joyCenterY = rect.top + rect.height / 2;
      updateJoy(clientX, clientY);
    };
    const updateJoy = (clientX, clientY) => {
      if (joyTouchId === null) return;
      let dx = clientX - joyCenterX;
      let dy = clientY - joyCenterY;
      const dist = Math.hypot(dx, dy);
      const maxR = Math.max(26, Math.min(baseR - 10, joystick.getBoundingClientRect().width / 2 - 10));
      if (dist > maxR && dist > 0) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.touchDir.x = dist > dead ? dx / maxR : 0;
      this.touchDir.y = dist > dead ? dy / maxR : 0;
    };
    const endJoy = () => {
      joyTouchId = null;
      knob.style.transform = 'translate(-50%, -50%)';
      this.touchDir.x = 0;
      this.touchDir.y = 0;
    };

    if (window.PointerEvent) {
      joystick.addEventListener('pointerdown', (e) => {
        e.preventDefault(); joystick.setPointerCapture?.(e.pointerId);
        beginJoy(e.clientX, e.clientY, e.pointerId);
      });
      joystick.addEventListener('pointermove', (e) => { e.preventDefault(); if (e.pointerId === joyTouchId) updateJoy(e.clientX, e.clientY); });
      joystick.addEventListener('pointerup', (e) => { if (e.pointerId === joyTouchId) endJoy(); });
      joystick.addEventListener('pointercancel', endJoy);
      fireBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); fireBtn.setPointerCapture?.(e.pointerId); this.touchFire = true; });
      fireBtn.addEventListener('pointerup', () => { this.touchFire = false; });
      fireBtn.addEventListener('pointercancel', () => { this.touchFire = false; });
      fireBtn.addEventListener('pointerleave', () => { this.touchFire = false; });
      return;
    }

    joystick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      beginJoy(touch.clientX, touch.clientY, touch.identifier);
    }, { passive: false });

    joystick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === joyTouchId) {
          updateJoy(touch.clientX, touch.clientY);
        }
      }
    }, { passive: false });

    const endTouchJoy = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === joyTouchId) {
          endJoy();
        }
      }
    };
    joystick.addEventListener('touchend', endTouchJoy);
    joystick.addEventListener('touchcancel', endTouchJoy);

    fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchFire = true; }, { passive: false });
    fireBtn.addEventListener('touchend', () => { this.touchFire = false; });
    fireBtn.addEventListener('touchcancel', () => { this.touchFire = false; });
  }

  /* ---------- 更新 ---------- */
  update(dt) {
    this.time += dt;
    if (this.shake > 0) this.shake -= dt;

    if (this.state === 'boss_intro') {
      this.bossIntroTimer -= dt;
      if (this.bossIntroTimer <= 0) {
        this.state = 'playing';
        hideBanner();
      }
      this.particles.update(dt);
      return;
    }

    if (this.state === 'level_intro' || this.state === 'paused') {
      this.particles.update(dt);
      return;
    }

    if (this.state !== 'playing') return;

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateBullets(dt);
    // 子弹命中后立即移除死亡敌机，避免下一帧仍参与碰撞/波次判断。
    this.enemies = this.enemies.filter((e) => e.alive);
    this.updatePowerups(dt);
    this.particles.update(dt);
    this.updateWave(dt);
    updateHud(this);
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) return;

    // 输入合并（键盘 + 触控）
    let dx = 0, dy = 0;
    const kb = this.input.getAxis();
    dx += kb.x + this.touchDir.x;
    dy += kb.y + this.touchDir.y;
    // 截断
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));

    const wasMoving = this.isMoving;
    this.isMoving = (dx !== 0 || dy !== 0);

    if (this.isMoving) {
      p.dir = Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? DIR.RIGHT : DIR.LEFT)
        : (dy > 0 ? DIR.DOWN : DIR.UP);
    }

    // 移动音效
    if (this.isMoving && !wasMoving) audio.startMove();
    if (!this.isMoving && wasMoving) audio.stopMove();

    const speed = p.speed * (p.speedTimer > 0 ? BALANCE.speedBoostFactor : 1);
    moveWithCollision(p, dx * speed * dt, dy * speed * dt, this.grid, this.getBlockers());

    if (p.shieldTimer > 0) p.shieldTimer -= dt;
    if (p.speedTimer > 0) p.speedTimer -= dt;
    if (p.pierceTimer > 0) p.pierceTimer -= dt;
    if (p.fireCooldown > 0) p.fireCooldown -= dt;

    const wantFire = this.input.isFire() || this.touchFire;
    if (wantFire && p.fireCooldown <= 0) {
      this.firePlayer();
    }
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.alive) updateEnemyAI(e, dt, this);
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  updateBoss(dt) {
    if (this.boss && this.boss.alive) {
      updateBossAI(this.boss, dt, this);
      setBossBar(this.boss.hp / this.boss.maxHp, this.boss.name);
    }
  }

  updateBullets(dt) {
    for (const b of this.playerBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (this.bulletHitTile(b, false)) { if (!b.alive) continue; }
      if (!b.alive) continue;
      for (const e of this.enemies) {
        if (e.alive && aabb(b, e, BULLET_SIZE, e.size)) {
          this.damageEnemy(e, b);
          if (!b.pierce) { b.alive = false; break; }
        }
      }
      if (!b.alive) continue;
      if (this.boss && this.boss.alive && aabb(b, this.boss, BULLET_SIZE, this.boss.size)) {
        this.damageBoss(b);
        if (!b.pierce) b.alive = false;
      }
    }

    for (const b of this.enemyBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (this.bulletHitTile(b, true)) { if (!b.alive) continue; }
      if (!b.alive) continue;
      const p = this.player;
      if (p.alive && aabb(b, p, BULLET_SIZE, p.size)) {
        b.alive = false;
        if (p.shieldTimer > 0) {
          audio.shield();
          this.spawnParticles(p.x + p.size / 2, p.y + p.size / 2, COLORS.primary, 8);
        } else {
          this.hurtPlayer(b);
        }
      }
    }

    for (const pb of this.playerBullets) {
      for (const eb of this.enemyBullets) {
        if (pb.alive && eb.alive && aabb(pb, eb, BULLET_SIZE, BULLET_SIZE)) {
          pb.alive = false; eb.alive = false;
          this.spawnParticles(pb.x + BULLET_SIZE / 2, pb.y + BULLET_SIZE / 2, '#ffffff', 6);
        }
      }
    }

    this.playerBullets = this.playerBullets.filter((b) => {
      if (!b.alive) this.bulletTrails.delete(b);
      return b.alive;
    });
    this.enemyBullets = this.enemyBullets.filter((b) => {
      if (!b.alive) this.bulletTrails.delete(b);
      return b.alive;
    });
  }

  bulletHitTile(b, isEnemy) {
    const t = tileAt(b.x + BULLET_SIZE / 2, b.y + BULLET_SIZE / 2, this.grid);
    if (!t) { b.alive = false; return true; }
    switch (t.tile) {
      case TILE_TYPE.BRICK:
        this.grid[t.r][t.c] = TILE_TYPE.EMPTY;
        this.spawnParticles(t.c * TILE + TILE / 2, t.r * TILE + TILE / 2, COLORS.brick, 8);
        audio.hit();
        if (!b.pierce) b.alive = false;
        return true;
      case TILE_TYPE.STEEL:
        if (b.pierce) {
          this.grid[t.r][t.c] = TILE_TYPE.EMPTY;
          this.spawnParticles(t.c * TILE + TILE / 2, t.r * TILE + TILE / 2, COLORS.steel, 8);
          audio.hit();
          return true;
        }
        this.spawnParticles(b.x + BULLET_SIZE / 2, b.y + BULLET_SIZE / 2, '#ffffff', 4);
        b.alive = false;
        return true;
      case TILE_TYPE.BASE:
        b.alive = false;
        if (isEnemy) this.destroyBase(t);
        return true;
      case TILE_TYPE.WATER:
      case TILE_TYPE.GRASS:
      case TILE_TYPE.EMPTY:
        return false;
    }
    return false;
  }

  damageEnemy(e, b) {
    e.hp -= b.damage;
    if (b.kind === 'ice') e.speed = Math.max(20, e.speed * 0.7);
    this.spawnParticles(b.x + BULLET_SIZE / 2, b.y + BULLET_SIZE / 2, e.color, 8);
    audio.hit();
    if (e.hp <= 0) {
      e.alive = false;
      audio.explodeEnemy(e.type);
      this.spawnParticles(e.x + e.size / 2, e.y + e.size / 2, e.color, 24);
      this.score += e.score;
      this.kills++;
      this.profile.coins += Math.max(5, Math.round(e.score / 20));
      this.saveProfile();
      this.shake = Math.max(this.shake, 0.10);
      if (Math.random() < (this.diffParams.powerupDropRate ?? 0.22)) {
        const type = POWERUP_TYPES[(Math.random() * POWERUP_TYPES.length) | 0];
        this.powerups.push(new PowerUp(type, e.x + (e.size - 20) / 2, e.y + (e.size - 20) / 2));
      }
    }
    if (b.kind === 'flame' && b.damage >= 3) {
      this.applyExplosion(e.x + e.size / 2, e.y + e.size / 2, 52, 1);
    }
  }

  damageBoss(b) {
    this.boss.hp -= b.damage;
    this.spawnParticles(b.x + BULLET_SIZE / 2, b.y + BULLET_SIZE / 2, this.boss.color, 10);
    audio.hit();
    if (this.boss.hp <= 0) {
      this.boss.alive = false;
      this.score += 1000;
      this.profile.coins += 50;
      this.saveProfile();
      this.shake = 1.0;
      audio.explode();
      this.spawnParticles(this.boss.x + this.boss.size / 2, this.boss.y + this.boss.size / 2, this.boss.color, 60);
      showBossBar(false);
      // 通关模式：Boss 击败后进入下一关
      if (this.gameMode === 'campaign') {
        this.level++;
        if (this.level > CAMPAIGN_TOTAL_LEVELS) {
          this.victory();
        } else {
          // 短暂胜利后进入下一关
          showBanner('关卡 ' + String(this.level - 1).padStart(2, '0') + ' 完成', '准备下一关');
          setTimeout(() => {
            this.state = 'level_intro';
            showLevelIntro('LEVEL ' + String(this.level).padStart(2, '0'), this.diffParams.label + ' 难度');
            setTimeout(() => {
              hideLevelIntro();
              this.state = 'playing';
              this.grid = createGrid();
              this.enemies = [];
              this.playerBullets = [];
              this.enemyBullets = [];
              this.powerups = [];
              this.boss = null;
              this.wave = 0;
              this.waveClearStarted = false;
              showBossBar(false);
              this.nextWave();
            }, 2300);
          }, 1500);
        }
      } else {
        // 无尽模式：Boss 击败后继续
        this.nextWave();
      }
    }
  }

  hurtPlayer(b) {
    const p = this.player;
    p.hp -= 1;
    this.shake = Math.max(this.shake, 0.4);
    this.spawnParticles(p.x + p.size / 2, p.y + p.size / 2, COLORS.danger, 16);
    audio.explodeEnemy('regular');
    if (p.hp <= 0) {
      p.alive = false;
      this.gameOver();
    }
  }

  destroyBase(t) {
    if (this.baseDestroyed) return;
    this.baseDestroyed = true;
    this.grid[t.r][t.c] = TILE_TYPE.EMPTY;
    this.shake = 1.2;
    audio.baseHit();
    this.spawnParticles(t.c * TILE + TILE / 2, t.r * TILE + TILE / 2, COLORS.base, 40);
    this.gameOver();
  }

  applyPowerup(p) {
    const pl = this.player;
    switch (p.type) {
      case 'POWER': pl.fireLevel = Math.min(3, pl.fireLevel + 1); break;
      case 'SPEED': pl.speedTimer = BALANCE.speedBoostDuration; break;
      case 'SHIELD': pl.shieldTimer = BALANCE.shieldDuration; break;
      case 'LIFE': pl.hp = Math.min(pl.maxHp, pl.hp + 1); break;
      case 'BOMB':
        for (const e of this.enemies) {
          if (e.alive) {
            e.alive = false;
            this.score += e.score;
            this.kills++;
            this.spawnParticles(e.x + e.size / 2, e.y + e.size / 2, '#ff9a3c', 24);
          }
        }
        this.enemies = this.enemies.filter((e) => e.alive);
        audio.explode();
        this.shake = 0.8;
        break;
      case 'PIERCE': pl.pierceTimer = BALANCE.pierceDuration; break;
    }
    audio.pickup();
    this.spawnParticles(p.x + p.size / 2, p.y + p.size / 2, p.color, 14);
  }

  updatePowerups(dt) {
    for (const p of this.powerups) p.t += dt;
    for (const p of this.powerups) {
      if (p.alive && this.player.alive && aabb(this.player, p, this.player.size, p.size)) {
        p.alive = false;
        this.applyPowerup(p);
      }
    }
    this.powerups = this.powerups.filter((p) => p.alive);
  }

  updateWave(dt) {
    if (this.boss && this.boss.alive) return;

    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnOne();
        this.spawnTimer = BALANCE.spawnInterval * (this.diffParams.spawnIntervalMul ?? 1);
      }
    } else if (this.enemies.length === 0) {
      if (!this.waveClearStarted) {
        this.waveClearStarted = true;
        this.waveClearTimer = 2.0;
        showBanner('第 ' + this.wave + ' 波 完成', '准备下一波');
      }
      this.waveClearTimer -= dt;
      if (this.waveClearTimer <= 0) {
        this.nextWave();
      }
    }
  }

  onBossPhaseChange(phase) {
    audio.phase();
    this.shake = Math.max(this.shake, 0.7);
    showBanner('BOSS 狂暴 · 阶段 ' + phase, '攻击模式升级', true);
  }

  gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    audio.stopBGM();
    audio.stopMove();
    audio.gameover();
    showBossBar(false);
    const extra = this.gameMode === 'endless'
      ? '生存 ' + this.wave + ' 波 · 击杀 ' + this.kills
      : '关卡 ' + this.level;
    showOverlay({
      title: '游戏结束',
      subtitle: 'GAME OVER',
      desc: extra + ' · 得分 ' + this.score,
      btnText: '再来一局',
      onBtn: () => this.start(),
      showLobby: true,
    });
  }

  victory() {
    if (this.state !== 'playing') return;
    this.state = 'victory';
    audio.stopBGM();
    audio.stopMove();
    audio.victory();
    showOverlay({
      title: '全部通关！',
      subtitle: 'VICTORY',
      desc: '得分 ' + this.score + ' · 击杀 ' + this.kills,
      btnText: '重新开始',
      onBtn: () => this.start(),
      showLobby: true,
    });
  }

  spawnParticles(x, y, color, count) {
    this.particles.spawn(x, y, color, Math.min(count, 18));
  }

  /* ---------- 渲染 ---------- */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 8;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // 1. 底图
    if (this.bgImg.complete && this.bgImg.naturalWidth > 0) {
      ctx.drawImage(this.bgImg, 0, 0, CANVAS_W, CANVAS_H);
    } else {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // 2. 霓虹网格
    this.drawGrid(ctx);

    // 3. 地形（非草丛）
    this.drawTiles(ctx, false);

    // 4. 道具
    for (const p of this.powerups) drawPowerup(ctx, p);

    // 5. 子弹（带拖尾）
    for (const b of this.playerBullets) drawBullet(ctx, b, this.bulletTrails);
    for (const b of this.enemyBullets) drawBullet(ctx, b, this.bulletTrails);

    // 6. 坦克与 Boss（增强绘制）
    if (this.player.alive) {
      drawTank(ctx, this.player.x, this.player.y, this.player.dir, COLORS.player, this.player.size, {
        flash: this.player.shieldTimer > 0,
        level: this.player.fireLevel,
        skin: this.getSkin(),
      });
      if (this.player.shieldTimer > 0) this.drawShield(ctx, this.player);
    }
    for (const e of this.enemies) {
      if (e.alive) drawTank(ctx, e.x, e.y, e.dir, e.color, e.size, {
        isEnemy: true,
        type: e.type,
        level: e.type === 'elite' ? 3 : e.type === 'heavy' ? 2 : 1,
        weaponKind: e.weaponKind,
      });
    }
    if (this.boss && this.boss.alive) {
      drawTank(ctx, this.boss.x, this.boss.y, this.boss.dir, this.boss.color, this.boss.size, {
        flash: true,
        level: 3,
        isEnemy: true,
        type: 'boss',
      });
    }

    // 7. 草丛遮挡
    this.drawTiles(ctx, true);

    // 8. 粒子
    this.particles.draw(ctx);

    // 9. LSQ 水印（右下角微透明）
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('LSQ', CANVAS_W - 8, CANVAS_H - 6);
    ctx.restore();

    ctx.restore();
  }

  drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const breathe = 0.5 + 0.5 * Math.sin(this.time * 0.6);
    ctx.globalAlpha = 0.03 + breathe * 0.04;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * TILE, 0); ctx.lineTo(c * TILE, CANVAS_H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * TILE); ctx.lineTo(CANVAS_W, r * TILE); ctx.stroke();
    }
    ctx.restore();
  }

  drawTiles(ctx, grassOnly) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.grid[r][c];
        const isGrass = t === TILE_TYPE.GRASS;
        if (grassOnly !== isGrass) continue;
        if (t === TILE_TYPE.EMPTY) continue;
        this.drawTile(ctx, r, c, t);
      }
    }
  }

  drawTile(ctx, r, c, t) {
    const x = c * TILE, y = r * TILE;
    switch (t) {
      case TILE_TYPE.BRICK:
        ctx.fillStyle = COLORS.brick;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        ctx.beginPath();
        ctx.moveTo(x, y + TILE / 2); ctx.lineTo(x + TILE, y + TILE / 2);
        ctx.moveTo(x + TILE / 2, y); ctx.lineTo(x + TILE / 2, y + TILE / 2);
        ctx.moveTo(x + TILE / 2, y + TILE / 2); ctx.lineTo(x + TILE / 2, y + TILE);
        ctx.stroke();
        break;
      case TILE_TYPE.STEEL:
        ctx.fillStyle = COLORS.steel;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
        break;
      case TILE_TYPE.WATER: {
        ctx.fillStyle = COLORS.water;
        ctx.fillRect(x, y, TILE, TILE);
        const off = (this.time * 10) % TILE;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        for (let lx = -TILE + off; lx < TILE; lx += 8) {
          ctx.beginPath(); ctx.moveTo(x + lx, y); ctx.lineTo(x + lx + 6, y + TILE); ctx.stroke();
        }
        break;
      }
      case TILE_TYPE.GRASS:
        ctx.fillStyle = COLORS.grass;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.globalAlpha = 1;
        break;
      case TILE_TYPE.BASE: {
        const cx = x + TILE / 2, cy = y + TILE / 2;
        ctx.save();
        ctx.shadowColor = COLORS.base;
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#0d1421';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.base;
        ctx.beginPath();
        ctx.moveTo(cx, y + 2); ctx.lineTo(x + TILE - 2, cy);
        ctx.lineTo(cx, y + TILE - 2); ctx.lineTo(x + 2, cy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
    }
  }

  drawShield(ctx, p) {
    const cx = p.x + p.size / 2, cy = p.y + p.size / 2;
    ctx.save();
    ctx.strokeStyle = COLORS.primary;
    ctx.shadowColor = COLORS.primary;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 6);
    ctx.beginPath();
    ctx.arc(cx, cy, p.size * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- 主循环 ---------- */
  loop(t) {
    const dt = Math.min(0.05, (t - this.lastTime) / 1000);
    this.lastTime = t;

    this.update(dt);
    this.render();

    requestAnimationFrame((tt) => this.loop(tt));
  }
}

// 启动：将启动异常显示出来，避免浏览器里只表现为“按钮没有反应”。
let game;
try {
  game = new Game();
  showMenu();
  setLobbySelection(game.selectedMode, game.selectedDiff);
} catch (error) {
  console.error('[Tank Battle] startup failed:', error);
  const panel = document.getElementById('panel');
  if (panel) {
    panel.innerHTML = '<h1 class="title">游戏初始化失败</h1><p class="desc">请刷新页面后重试；若直接打开本地 HTML，请使用本地服务器访问。</p><p class="ctrl">' + String(error?.message || error) + '</p>';
  }
}
