// audio.js —— Web Audio 程序化音效（增强版：区分爆炸、移动、基地受击、BGM）

class AudioMgr {
  constructor() {
    this.ctx = null;
    // file://、隐私模式或受限 WebView 可能禁止 localStorage，不能让它阻断大厅初始化。
    let savedEnabled = null;
    try { savedEnabled = window.localStorage?.getItem('tank-audio-enabled'); } catch (e) {}
    this.enabled = savedEnabled !== '0';
    this.bgmGain = null;
    this.bgmOscs = [];
    this.bgmPlaying = false;
    this.moveOsc = null;
    this.moveGain = null;
    this.noiseBuffers = new Map();
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(value) {
    this.enabled = !!value;
    try { window.localStorage?.setItem('tank-audio-enabled', this.enabled ? '1' : '0'); } catch (e) {}
    if (!this.enabled) { this.stopBGM(); this.stopMove(); }
  }

  click() { this._tone('square', 520, 0.06, 0.08, 720); }
  purchase() { this._tone('triangle', 420, 0.12, 0.12, 740); this._tone('triangle', 740, 0.18, 0.10, 1040); }

  _tone(type, freq, dur, vol = 0.12, slideTo = null) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  _noise(dur = 0.3, vol = 0.2) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const key = `${this.ctx.sampleRate}:${dur}`;
    let buf = this.noiseBuffers.get(key);
    if (!buf) {
      const len = Math.floor(this.ctx.sampleRate * dur);
      buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      this.noiseBuffers.set(key, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1200;
    src.connect(f);
    f.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
  }

  /* --- 射击 --- */
  shoot() { this._tone('square', 340, 0.08, 0.07, 160); }

  /* --- 命中（小爆炸） --- */
  hit() { this._tone('square', 180, 0.06, 0.05, 90); }

  /* --- 敌人爆炸（区分类型） --- */
  explodeEnemy(type) {
    if (type === 'elite') {
      this._noise(0.4, 0.3);
      this._tone('sine', 70, 0.4, 0.25, 35);
      this._tone('square', 120, 0.15, 0.12, 60);
    } else if (type === 'heavy') {
      this._noise(0.5, 0.35);
      this._tone('sine', 50, 0.5, 0.3, 25);
    } else {
      this._noise(0.25, 0.2);
      this._tone('sine', 80, 0.25, 0.18, 40);
    }
  }

  /* --- Boss 爆炸 --- */
  explode() { this._noise(0.6, 0.35); this._tone('sine', 60, 0.5, 0.25, 25); }

  /* --- 拾取道具 --- */
  pickup() { this._tone('triangle', 520, 0.1, 0.12, 880); }

  /* --- 护盾 --- */
  shield() { this._tone('sine', 900, 0.25, 0.1, 1400); }

  /* --- Boss 出场 --- */
  boss() { this._tone('sawtooth', 80, 0.8, 0.2, 220); this._noise(0.5, 0.15); }

  /* --- Boss 阶段切换 --- */
  phase() { this._tone('sawtooth', 120, 0.5, 0.18, 60); this._noise(0.4, 0.18); }

  /* --- 游戏结束 --- */
  gameover() { this._tone('sawtooth', 300, 1.0, 0.15, 60); }

  /* --- 胜利 --- */
  victory() { this._tone('triangle', 400, 0.15, 0.12, 800); this._tone('triangle', 600, 0.2, 0.12, 1000); }

  /* --- 基地受击 --- */
  baseHit() { this._tone('sawtooth', 200, 0.4, 0.2, 80); this._noise(0.2, 0.15); }

  /* --- 坦克移动（持续低频，开始/停止） --- */
  startMove() {
    if (!this.enabled || !this.ctx || this.moveOsc) return;
    const t = this.ctx.currentTime;
    this.moveOsc = this.ctx.createOscillator();
    this.moveGain = this.ctx.createGain();
    this.moveOsc.type = 'triangle';
    this.moveOsc.frequency.setValueAtTime(55, t);
    this.moveGain.gain.setValueAtTime(0.03, t);
    this.moveOsc.connect(this.moveGain);
    this.moveGain.connect(this.ctx.destination);
    this.moveOsc.start(t);
  }
  stopMove() {
    if (!this.moveOsc) return;
    try {
      this.moveGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
      this.moveOsc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {}
    this.moveOsc = null;
    this.moveGain = null;
  }

  /* --- BGM（简单循环低频垫底） --- */
  startBGM() {
    if (!this.enabled || !this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    const t = this.ctx.currentTime;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0, t);
    this.bgmGain.gain.linearRampToValueAtTime(0.04, t + 2);

    const notes = [110, 130.81, 146.83, 130.81]; // A2 C3 D3 C3 循环
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i], t);
      osc.connect(this.bgmGain);
      osc.start(t);
      // 循环切换频率
      const schedNote = (idx, time) => {
        osc.frequency.setValueAtTime(notes[idx % notes.length], time);
      };
      for (let beat = 0; beat < 200; beat++) {
        schedNote(beat, t + beat * 1.2);
      }
      this.bgmOscs.push(osc);
    }
    this.bgmGain.connect(this.ctx.destination);
  }

  stopBGM() {
    if (!this.bgmPlaying) return;
    this.bgmPlaying = false;
    try {
      if (this.bgmGain) this.bgmGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
      for (const osc of this.bgmOscs) osc.stop(this.ctx.currentTime + 0.6);
    } catch (e) {}
    this.bgmOscs = [];
    this.bgmGain = null;
  }
}

export const audio = new AudioMgr();
