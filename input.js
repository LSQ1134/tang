// input.js —— 键盘输入管理

export function createInput() {
  const keys = new Set();

  function onKeyDown(e) {
    // 阻止方向键/空格滚动页面
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    isDown(...codes) {
      return codes.some((c) => keys.has(c));
    },
    getAxis() {
      let x = 0, y = 0;
      if (this.isDown('ArrowUp', 'KeyW')) y -= 1;
      if (this.isDown('ArrowDown', 'KeyS')) y += 1;
      if (this.isDown('ArrowLeft', 'KeyA')) x -= 1;
      if (this.isDown('ArrowRight', 'KeyD')) x += 1;
      return { x, y };
    },
    isFire() {
      return this.isDown('Space', 'KeyJ');
    },
    isPause() {
      return this.isDown('KeyP', 'Escape');
    },
    clear() {
      keys.clear();
    },
  };
}