// Keyboard and mouse input, kept as plain state the simulation reads each step.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };
    this.anyKey = false;
    // Edge queue: a tap shorter than one frame (a quick Playwright press, or
    // a fast human tap) must still register. Held keys live in `keys`; taps
    // live here until the frame consumes them.
    this.queue = new Set();
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
      this.keys.add(event.key.toLowerCase());
      this.queue.add(event.key.toLowerCase());
      this.anyKey = true;
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.queue.clear(); });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = event.clientX - rect.left;
      this.mouse.y = event.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.clicked = true;
      this.mouse.clickX = event.clientX - rect.left;
      this.mouse.clickY = event.clientY - rect.top;
    });
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  pressed(key) {
    return this.keys.has(key);
  }

  // True once for a tap of `key`, then consumed: single-press actions
  // (pause, mute, draft picks, restart) read this, never the held set.
  consumePress(key) {
    if (!this.queue.has(key)) return false;
    this.queue.delete(key);
    return true;
  }

  consumeClick() {
    if (!this.mouse.clicked) return null;
    this.mouse.clicked = false;
    return { x: this.mouse.clickX, y: this.mouse.clickY };
  }

  consumeAnyKey() {
    const hit = this.anyKey;
    this.anyKey = false;
    return hit;
  }
}
