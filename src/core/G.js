// Global game context (one per page).
export const G = {
  canvas: null,
  ctx: null,
  W: 468, // internal (pixel-art) resolution
  H: 216,
  scale: 1,
  dpr: 1,
  safeL: 0, // safe-area insets in internal pixels (camera cut-out etc.)
  safeR: 0,
  time: 0,
  dt: 0,
  frame: 0,
  portrait: false,
  scene: null,
  input: null,
  audio: null,
  debug: false,
  setScene(s) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = s;
    if (this.input) this.input.resetPointers();
    if (s.enter) s.enter();
  },
};
