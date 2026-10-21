interface Palette {
  c0: string;
  c1: string;
  c2: string;
  c3: string;
}

const PALETTES = {
  CYAN: { c0: '#ffffff', c1: '#67e8f9', c2: '#0284c7', c3: '#0f172a' },
  VIOLET: { c0: '#ffffff', c1: '#f472b6', c2: '#a855f7', c3: '#3b0764' },
  GOLD: { c0: '#ffffff', c1: '#fef08a', c2: '#f59e0b', c3: '#451a03' },
} satisfies Record<string, Palette>;

function interpolateColor(from: string, to: string, amount: number): string {
  const first = Number.parseInt(from.slice(1), 16);
  const second = Number.parseInt(to.slice(1), 16);
  const red = Math.round(((first >> 16) & 255) + (((second >> 16) & 255) - ((first >> 16) & 255)) * amount);
  const green = Math.round(((first >> 8) & 255) + (((second >> 8) & 255) - ((first >> 8) & 255)) * amount);
  const blue = Math.round((first & 255) + ((second & 255) - (first & 255)) * amount);
  return `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`;
}

class PixelSpark {
  private size = Math.random() > 0.5 ? 2 : 3;
  private decay = Math.random() * 0.05 + 0.025;
  private x: number;
  private y: number;
  private vx: number;
  private vy: number;
  life = 1;

  constructor(x: number, y: number, vx: number, vy: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }

  update(): void {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }

  draw(context: CanvasRenderingContext2D, palette: Palette): void {
    if (this.life <= 0) return;
    context.fillStyle = this.life > 0.5 ? palette.c0 : palette.c1;
    context.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size);
  }
}

function drawPixelCircle(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  dither = false,
): void {
  context.fillStyle = color;
  for (let y = -radius; y <= radius; y += 2) {
    for (let x = -radius; x <= radius; x += 2) {
      if (x * x + y * y > radius * radius) continue;
      if (dither && (Math.floor((centerX + x) / 2) + Math.floor((centerY + y) / 2)) % 2 !== 0) continue;
      context.fillRect(Math.floor(centerX + x), Math.floor(centerY + y), 2, 2);
    }
  }
}

interface OrbRendererOptions {
  canvas: HTMLCanvasElement;
  container: HTMLButtonElement;
  reducedMotion: boolean;
  onProximityChange: (near: boolean) => void;
}

export interface OrbRenderer {
  activate: () => void;
  destroy: () => void;
}

/** Owns canvas animation and listeners; callers own the React interface and its state. */
export function startOrbRenderer({ canvas, container, reducedMotion, onProximityChange }: OrbRendererOptions): OrbRenderer {
  const context = canvas.getContext('2d');
  if (!context) return { activate() {}, destroy() {} };
  context.imageSmoothingEnabled = false;

  let targetPaletteKey: keyof typeof PALETTES = 'CYAN';
  const currentPalette: Palette = { ...PALETTES.CYAN };
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let lastMouseX = mouseX;
  let lastMouseY = mouseY;
  let isHovered = false;
  let isFocused = false;
  let isClicking = false;
  let isNear = false;
  let coreX = 80;
  let coreY = 80;
  let pulsePhase = 0;
  let clickFlareRadius = 0;
  let frameId = 0;
  let destroyed = false;
  let idleTimer: number | undefined;
  let clickTimer: number | undefined;
  const particles: PixelSpark[] = [];

  function updateProximity(): void {
    const rect = container.getBoundingClientRect();
    const distance = Math.hypot(mouseX - (rect.left + rect.width / 2), mouseY - (rect.top + rect.height / 2));
    const near = distance < 220 || isHovered || isFocused;
    if (near !== isNear) {
      isNear = near;
      onProximityChange(near);
    }
  }

  function resetIdleTimer(): void {
    window.clearTimeout(idleTimer);
    container.classList.remove('opacity-40');
    if (!reducedMotion) container.classList.add('gbc-idle-float');
    idleTimer = window.setTimeout(() => {
      if (!isHovered && !isFocused) {
        container.classList.add('opacity-40');
        container.classList.remove('gbc-idle-float');
      }
    }, 3200);
  }

  function draw(): void {
    if (!context || destroyed) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const target = PALETTES[targetPaletteKey];
    const colorSpeed = reducedMotion ? 1 : targetPaletteKey === 'GOLD' ? 0.8 : 0.05;
    for (const channel of ['c0', 'c1', 'c2', 'c3'] as const) {
      currentPalette[channel] = interpolateColor(currentPalette[channel], target[channel], colorSpeed);
    }

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(mouseX - centerX, mouseY - centerY);
    const proximity = reducedMotion ? 0 : Math.max(0, 1 - Math.min(distance / 320, 1));
    if (!reducedMotion) {
      pulsePhase += 0.05 + proximity * 0.015;
      const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
      const targetDistance = Math.min(distance / 20, 16);
      coreX += (80 + Math.cos(angle) * targetDistance - coreX) * 0.08;
      coreY += (80 + Math.sin(angle) * targetDistance - coreY) * 0.08;
    }
    const pulse = reducedMotion ? 0 : Math.sin(pulsePhase);
    drawPixelCircle(context, 80, 80, Math.floor(42 + pulse * (3 + proximity * 1.5)), currentPalette.c2, true);
    drawPixelCircle(context, 80, 80, 32, currentPalette.c3);
    drawPixelCircle(context, 80, 80, 28, currentPalette.c2, true);
    const pixelCoreX = Math.floor(coreX);
    const pixelCoreY = Math.floor(coreY);
    drawPixelCircle(context, pixelCoreX, pixelCoreY, 14, currentPalette.c2);
    drawPixelCircle(context, pixelCoreX, pixelCoreY, Math.floor(9 + pulse * (1 + proximity * 1.5)), currentPalette.c1);
    drawPixelCircle(context, pixelCoreX - 2, pixelCoreY - 2, 4, currentPalette.c0);

    if (!reducedMotion) {
      if (clickFlareRadius > 0) {
        drawPixelCircle(context, 80, 80, Math.floor(clickFlareRadius), currentPalette.c0, true);
        clickFlareRadius += 2.5;
        if (clickFlareRadius > 26) clickFlareRadius = 0;
      }
      for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index];
        if (!particle) continue;
        particle.update();
        particle.draw(context, currentPalette);
        if (particle.life <= 0) particles.splice(index, 1);
      }
      frameId = window.requestAnimationFrame(draw);
    }
  }

  function handleMouseMove(event: MouseEvent): void {
    mouseX = event.clientX;
    mouseY = event.clientY;
    const deltaX = mouseX - lastMouseX;
    const deltaY = mouseY - lastMouseY;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    resetIdleTimer();
    updateProximity();
    if (reducedMotion) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(mouseX - centerX, mouseY - centerY);
    if (Math.hypot(deltaX, deltaY) > 3 && distance < 260) {
      const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
      particles.push(new PixelSpark(
        80 + Math.cos(angle) * 32,
        80 + Math.sin(angle) * 32,
        (Math.random() - 0.5) * 1.5 + deltaX * 0.05,
        (Math.random() - 0.5) * 1.5 + deltaY * 0.05,
      ));
    }
  }

  function updateInteraction(): void {
    if (!isClicking) targetPaletteKey = isHovered || isFocused ? 'VIOLET' : 'CYAN';
    updateProximity();
    resetIdleTimer();
    if (reducedMotion) draw();
  }

  const handleMouseEnter = () => { isHovered = true; updateInteraction(); };
  const handleMouseLeave = () => { isHovered = false; updateInteraction(); };
  const handleFocus = () => { isFocused = true; updateInteraction(); };
  const handleBlur = () => { isFocused = false; updateInteraction(); };
  const handleViewportChange = () => updateProximity();

  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  window.addEventListener('resize', handleViewportChange, { passive: true });
  window.addEventListener('scroll', handleViewportChange, { passive: true });
  container.addEventListener('mouseenter', handleMouseEnter);
  container.addEventListener('mouseleave', handleMouseLeave);
  container.addEventListener('focus', handleFocus);
  container.addEventListener('blur', handleBlur);
  resetIdleTimer();
  draw();

  return {
    activate() {
      isClicking = true;
      targetPaletteKey = 'GOLD';
      window.clearTimeout(clickTimer);
      if (reducedMotion) {
        draw();
      } else {
        clickFlareRadius = 4;
        container.classList.remove('gbc-shake');
        void container.offsetWidth;
        container.classList.add('gbc-shake');
        for (let index = 0; index < 12; index++) {
          const angle = Math.PI * 2 / 12 * index;
          const speed = Math.random() * 2 + 1;
          particles.push(new PixelSpark(80, 80, Math.cos(angle) * speed, Math.sin(angle) * speed));
        }
      }
      clickTimer = window.setTimeout(() => {
        isClicking = false;
        container.classList.remove('gbc-shake');
        updateInteraction();
      }, 350);
    },
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(idleTimer);
      window.clearTimeout(clickTimer);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('focus', handleFocus);
      container.removeEventListener('blur', handleBlur);
      container.classList.remove('gbc-shake', 'gbc-idle-float', 'opacity-40');
      particles.length = 0;
    },
  };
}
