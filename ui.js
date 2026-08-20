// ui.js —— HUD / 覆盖层 / 横幅 / Boss 血条 / 大厅 / 关卡动画 的 DOM 操作

const q = (s) => document.querySelector(s);

const el = {
  score: q('#hud-score'),
  wave: q('#hud-wave'),
  level: q('#hud-level'),
  mode: q('#hud-mode'),
  diff: q('#hud-diff'),
  fire: q('#hud-fire'),
  shield: q('#hud-shield'),
  hp: q('#hud-hp'),
  enemies: q('#hud-enemies'),
  bossWrap: q('#boss-bar-wrap'),
  bossName: q('#boss-name'),
  bossFill: q('#boss-bar-fill'),
  overlay: q('#overlay'),
  panelTitle: q('#panel-title'),
  panelSubtitle: q('#panel-subtitle'),
  panelDesc: q('#panel-desc'),
  panelAuthor: q('.author'),
  lobbyOpts: q('#lobby-options'),
  btn: q('#btn-main'),
  banner: q('#banner'),
  bannerMain: q('#banner-main'),
  bannerSub: q('#banner-sub'),
  levelIntro: q('#level-intro'),
  levelIntroText: q('#level-intro-text'),
  levelIntroSub: q('#level-intro-sub'),
  touchControls: q('#touch-controls'),
  modeBtns: q('#mode-btns'),
  diffBtns: q('#diff-btns'),
  topControls: q('#top-controls'),
  sound: q('#btn-sound'),
  home: q('#btn-home'),
  pause: q('#btn-pause'),
  warehouse: q('#warehouse'),
  warehouseEntry: q('#btn-warehouse'),
  warehouseList: q('#warehouse-list'),
  warehouseCoins: q('#warehouse-coins'),
  lobbyCoins: q('#lobby-coins'),
  warehouseClose: q('#warehouse-close'),
  confirm: q('#confirm-dialog'),
  confirmOk: q('#confirm-ok'),
  confirmCancel: q('#confirm-cancel'),
  orientationLock: q('#orientation-lock'),
  orientationRetry: q('#orientation-retry'),
};

let bannerTimer = null;

export function updateHud(game) {
  el.score.textContent = '得分 ' + game.score;
  el.wave.textContent = '波次 ' + game.wave;

  // 关卡显示（通关模式）
  if (game.gameMode === 'campaign') {
    el.level.classList.remove('hidden');
    el.level.textContent = '关卡 ' + String(game.level).padStart(2, '0');
  } else {
    el.level.classList.add('hidden');
  }

  // 模式 & 难度
  el.mode.textContent = game.gameMode === 'endless' ? '无尽' : '通关';
  el.diff.textContent = game.diffParams.label || '普通';

  el.fire.textContent = '火力 Lv' + game.player.fireLevel;

  const st = Math.max(0, game.player.shieldTimer);
  if (st > 0) {
    el.shield.classList.remove('hidden');
    el.shield.textContent = '护盾 ' + st.toFixed(0) + 's';
  } else {
    el.shield.classList.add('hidden');
  }

  let hearts = '';
  for (let i = 0; i < game.player.maxHp; i++) {
    hearts += i < game.player.hp ? '♥ ' : '♡ ';
  }
  el.hp.textContent = hearts.trim();

  // 敌人数
  const enemyCount = game.enemies.filter((e) => e.alive).length + game.spawnQueue.length;
  el.enemies.textContent = '敌 ' + enemyCount;
}

export function updateSoundButton(enabled) {
  if (!el.sound) return;
  el.sound.textContent = enabled ? '◖)))' : '◖×××';
  el.sound.classList.toggle('muted', !enabled);
}
export function updateLobbyCoins(coins) { if (el.lobbyCoins) el.lobbyCoins.textContent = '金币 ' + coins; }

export function showTopControls(visible) { el.topControls.classList.toggle('hidden', !visible); }

export function bindGlobalControls({ onSound, onHome, onPause, onWarehouse }) {
  el.sound.onclick = () => onSound && onSound();
  el.home.onclick = () => onHome && onHome();
  el.pause.onclick = () => onPause && onPause();
  el.warehouseEntry.onclick = () => onWarehouse && onWarehouse();
  el.warehouseClose.onclick = () => hideWarehouse();
  el.confirmCancel.onclick = () => hideConfirm();
}

export function showConfirm(onConfirm) {
  el.confirm.classList.remove('hidden');
  el.confirm.setAttribute('aria-hidden', 'false');
  el.confirmOk.onclick = () => { hideConfirm(); onConfirm && onConfirm(); };
}
export function hideConfirm() {
  el.confirm.classList.add('hidden');
  el.confirm.setAttribute('aria-hidden', 'true');
}

export function showWarehouse(profile, tab, onAction) {
  el.warehouse.classList.remove('hidden');
  el.warehouse.setAttribute('aria-hidden', 'false');
  const activeTab = tab || 'skins';
  el.warehouse.querySelectorAll('.warehouse-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === activeTab);
    b.onclick = () => showWarehouse(profile, b.dataset.tab, onAction);
  });
  el.warehouseCoins.textContent = profile.coins;
  el.lobbyCoins.textContent = '金币 ' + profile.coins;
  const items = activeTab === 'skins' ? profile.skinCatalog : profile.weaponCatalog;
  el.warehouseList.innerHTML = items.map((item) => {
    const owned = item.owned;
    const equipped = item.equipped;
    return `<div class="warehouse-card ${equipped ? 'equipped' : ''}">
      <div class="item-icon">${item.icon || '▣'}</div>
      <div class="item-info"><strong>${item.name}</strong><small>${item.desc || '改变坦克外观'}</small></div>
      <button class="item-action ${owned ? 'owned' : ''}" data-id="${item.id}" type="button">${equipped ? '已装备' : owned ? '装备' : item.price + ' 金币'}</button>
    </div>`;
  }).join('');
  el.warehouseList.querySelectorAll('.item-action').forEach((btn) => {
    btn.onclick = () => onAction && onAction(activeTab, btn.dataset.id);
  });
}
export function hideWarehouse() {
  el.warehouse.classList.add('hidden');
  el.warehouse.setAttribute('aria-hidden', 'true');
}

export function showBossBar(visible) {
  el.bossWrap.classList.toggle('hidden', !visible);
}

export function setBossBar(ratio, name) {
  el.bossFill.style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%';
  el.bossName.textContent = name;
}

export function showBanner(main, sub = '', warn = false) {
  el.banner.classList.remove('hidden');
  el.bannerMain.textContent = main;
  el.bannerMain.classList.toggle('warn', warn);
  el.bannerSub.textContent = sub;
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.banner.classList.add('hidden'), 1800);
}

export function hideBanner() {
  el.banner.classList.add('hidden');
}

/* 关卡开场动画 */
export function showLevelIntro(text, sub = '') {
  el.levelIntroText.textContent = text;
  el.levelIntroSub.textContent = sub;
  el.levelIntro.classList.remove('hidden');
  // 重触发动画：移除再添加元素
  el.levelIntroText.style.animation = 'none';
  el.levelIntroSub.style.animation = 'none';
  void el.levelIntroText.offsetWidth;
  el.levelIntroText.style.animation = '';
  el.levelIntroSub.style.animation = '';
  setTimeout(() => el.levelIntro.classList.add('hidden'), 2300);
}

export function hideLevelIntro() {
  el.levelIntro.classList.add('hidden');
}

/* 覆盖层 */
export function showOverlay({ title, subtitle, desc, btnText, onBtn, showLobby = false }) {
  el.panelTitle.textContent = title;
  el.panelSubtitle.textContent = subtitle;
  el.panelDesc.textContent = desc;
  el.btn.textContent = btnText;
  el.btn.style.display = 'block';
  el.btn.onclick = () => onBtn && onBtn();
  el.lobbyOpts.classList.toggle('hidden', !showLobby);
  el.overlay.classList.remove('hidden');
  if (!showLobby) el.panelAuthor.classList.add('hidden');
}

export function showMenu() {
  el.panelTitle.textContent = '坦克大战 · 科技纪元';
  el.panelSubtitle.textContent = 'TECH TANK BATTLE';
  el.panelDesc.textContent = '抵御波次进攻，保护基地，击败关底 Boss。';
  el.panelAuthor.classList.remove('hidden');
  el.lobbyOpts.classList.remove('hidden');
  el.btn.textContent = '开始游戏';
  el.btn.style.display = 'block';
  el.overlay.classList.remove('hidden');
  showOrientationPrompt(false);
  showTopControls(false);
}

export function hideOverlay() {
  el.overlay.classList.add('hidden');
  showTopControls(true);
}

export function setStartHandler(fn) {
  el.btn.onclick = fn;
}

export function showPauseOverlay(visible) {
  if (visible) {
    el.panelTitle.textContent = '已暂停';
    el.panelSubtitle.textContent = 'PAUSED';
    el.panelDesc.textContent = '按 P / Esc 继续游戏';
    el.btn.style.display = 'none';
    el.lobbyOpts.classList.add('hidden');
    el.panelAuthor.classList.add('hidden');
    el.overlay.classList.remove('hidden');
    showTopControls(true);
  } else {
    el.overlay.classList.add('hidden');
  }
}

/* 大厅选项按钮绑定 */
export function bindLobbyOptions(onModeChange, onDiffChange) {
  if (!el.modeBtns || !el.diffBtns) return;
  el.modeBtns.querySelectorAll('.opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.modeBtns.querySelectorAll('.opt-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onModeChange(btn.dataset.val);
    });
  });
  el.diffBtns.querySelectorAll('.opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.diffBtns.querySelectorAll('.opt-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onDiffChange(btn.dataset.val);
    });
  });
}

/* 设置选中的按钮状态 */
export function setLobbySelection(mode, diff) {
  if (!el.modeBtns || !el.diffBtns) return;
  el.modeBtns.querySelectorAll('.opt-btn').forEach((b) => b.classList.toggle('active', b.dataset.val === mode));
  el.diffBtns.querySelectorAll('.opt-btn').forEach((b) => b.classList.toggle('active', b.dataset.val === diff));
}

/* 触控显示 */
export function showTouchControls(visible) {
  el.touchControls.classList.toggle('hidden', !visible);
  el.touchControls.classList.toggle('touch-ready', !!visible);
  el.touchControls.style.display = visible ? 'flex' : 'none';
  el.touchControls.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

export function showOrientationPrompt(visible) {
  if (!el.orientationLock) return;
  el.orientationLock.classList.toggle('hidden', !visible);
  el.orientationLock.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

export function bindOrientationRetry(fn) {
  if (el.orientationRetry) el.orientationRetry.onclick = () => fn && fn();
}

/* 检测是否触屏设备 */
export function isTouchDevice() {
  const coarse = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
  const mobile = /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  return !!(coarse || (navigator.maxTouchPoints > 0 && mobile));
}
