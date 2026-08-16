import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

/** A serializable, presentation-only reel grid. Rows are top-to-bottom. */
export type ReelGrid = readonly (readonly string[])[];

export interface ReelCanvasProps {
  /** The complete grid selected by the engine. This component never changes it. */
  grid: ReelGrid;
  /** Drives visual motion only; it never selects or modifies a stop. */
  phase: 'ready' | 'spinning' | 'result' | 'bonus-choice' | 'bonus';
  reducedMotion?: boolean;
  className?: string;
}

const PALETTE = {
  mist: 0xd7e0dc,
  graphite: 0x202a2d,
  slate: 0x40545a,
  amber: 0xe89b2c,
  cyan: 0x47b9c5,
  gold: 0xf3c65a,
  red: 0xc84d3c,
  deep: 0x101518,
};

const SYMBOLS: Record<string, { label: string; accent: number; shape: 'circle' | 'case' | 'diamond' | 'arc' | 'valve' }> = {
  CORE: { label: 'CORE', accent: PALETTE.cyan, shape: 'circle' },
  WILD: { label: 'WILD', accent: PALETTE.gold, shape: 'diamond' },
  RECOVERY: { label: 'RCV', accent: PALETTE.gold, shape: 'case' },
  ARMOR: { label: 'ARM', accent: PALETTE.gold, shape: 'case' },
  OPTIC: { label: 'OPT', accent: PALETTE.cyan, shape: 'circle' },
  RADIO: { label: 'COM', accent: PALETTE.amber, shape: 'arc' },
  SIDEARM: { label: 'SID', accent: PALETTE.amber, shape: 'diamond' },
  KNIFE: { label: 'KNF', accent: PALETTE.slate, shape: 'diamond' },
  CARBINE: { label: 'CRB', accent: PALETTE.cyan, shape: 'arc' },
  PRECISION: { label: 'PRS', accent: PALETTE.gold, shape: 'arc' },
  KEYCARD: { label: 'KEY', accent: PALETTE.slate, shape: 'case' },
  // Backward-compatible visual fallbacks for early prototype grids.
  CASE: { label: 'CASE', accent: PALETTE.gold, shape: 'case' },
  DRONE: { label: 'DRN', accent: PALETTE.cyan, shape: 'arc' },
  GLOVE: { label: 'GLV', accent: PALETTE.amber, shape: 'diamond' },
  BEACON: { label: 'BCN', accent: PALETTE.cyan, shape: 'arc' },
  CABLE: { label: 'CBL', accent: PALETTE.slate, shape: 'circle' },
  VALVE: { label: 'VLV', accent: PALETTE.amber, shape: 'valve' },
  PATCH: { label: 'PTC', accent: PALETTE.slate, shape: 'diamond' },
};

function resolveSymbol(id: string) {
  return SYMBOLS[id.toUpperCase()] ?? { label: id.slice(0, 4).toUpperCase(), accent: PALETTE.slate, shape: 'diamond' as const };
}

function drawSymbol(target: Container, id: string, x: number, y: number, size: number, scanOffset: number) {
  const symbol = resolveSymbol(id);
  const frame = new Graphics()
    .roundRect(x + 3, y + 3, size - 6, size - 6, 6)
    .fill({ color: 0x1a2326 })
    .stroke({ color: symbol.accent, width: id === 'CORE' || id === 'WILD' ? 2.5 : 1.2, alpha: 0.8 });
  target.addChild(frame);

  const art = new Graphics();
  const centerX = x + size / 2;
  const centerY = y + size / 2 - 8;
  const radius = size * 0.22;
  if (symbol.shape === 'circle') {
    art.circle(centerX, centerY, radius).stroke({ color: symbol.accent, width: 3 });
    art.circle(centerX, centerY, radius * 0.47).fill({ color: symbol.accent, alpha: 0.45 });
    art.moveTo(centerX - radius * 1.25, centerY).lineTo(centerX + radius * 1.25, centerY).stroke({ color: PALETTE.mist, width: 1, alpha: 0.5 });
  } else if (symbol.shape === 'case') {
    art.roundRect(centerX - radius * 1.25, centerY - radius * 0.7, radius * 2.5, radius * 1.45, 3).stroke({ color: symbol.accent, width: 3 });
    art.moveTo(centerX - radius * 1.4, centerY - radius).lineTo(centerX - radius * 0.55, centerY - radius).stroke({ color: symbol.accent, width: 2 });
    art.moveTo(centerX, centerY - radius * 0.7).lineTo(centerX, centerY + radius * 0.7).stroke({ color: symbol.accent, width: 2 });
  } else if (symbol.shape === 'valve') {
    art.circle(centerX, centerY, radius).stroke({ color: symbol.accent, width: 3 });
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6;
      art.moveTo(centerX, centerY).lineTo(centerX + Math.cos(angle) * radius * 1.35, centerY + Math.sin(angle) * radius * 1.35).stroke({ color: symbol.accent, width: 2 });
    }
  } else if (symbol.shape === 'arc') {
    art.arc(centerX, centerY, radius, Math.PI * 1.08, Math.PI * 1.92).stroke({ color: symbol.accent, width: 3 });
    art.arc(centerX, centerY, radius * 1.5, Math.PI * 1.15, Math.PI * 1.85).stroke({ color: symbol.accent, width: 2, alpha: 0.7 });
    art.circle(centerX, centerY + radius * 0.7, 3).fill({ color: symbol.accent });
  } else {
    art.poly([centerX, centerY - radius * 1.25, centerX + radius, centerY, centerX, centerY + radius * 1.25, centerX - radius, centerY]).stroke({ color: symbol.accent, width: 3 });
    art.circle(centerX, centerY, 3).fill({ color: symbol.accent });
  }
  target.addChild(art);

  const label = new Text({ text: symbol.label, style: new TextStyle({ fill: PALETTE.mist, fontFamily: 'Arial, sans-serif', fontSize: Math.max(10, size * 0.13), fontWeight: '700', letterSpacing: 1.4 }) });
  label.anchor.set(0.5, 0.5);
  label.position.set(centerX, y + size * 0.8);
  target.addChild(label);

  if (scanOffset > 0) {
    const scan = new Graphics().rect(x + 5, y + ((scanOffset + x * 0.15) % size), size - 10, 2).fill({ color: PALETTE.cyan, alpha: 0.25 });
    target.addChild(scan);
  }
}

/**
 * A tiny original PixiJS v8 reel renderer. It only draws a grid received from
 * React; the engine remains the exclusive owner of stops, wins, and randomness.
 */
export function ReelCanvas({ grid, phase, reducedMotion = false, className }: ReelCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const latestRef = useRef({ grid, phase, reducedMotion });
  latestRef.current = { grid, phase, reducedMotion };

  useEffect(() => {
    // A result can arrive without a resize or a motion frame. Refreshing here
    // keeps the canvas an exact view of the already committed engine result.
    renderRef.current?.();
  }, [grid, phase, reducedMotion]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const app = new Application();
    let disposed = false;
    let initialized = false;
    let resizeObserver: ResizeObserver | undefined;

    const start = async () => {
      await app.init({ backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
      initialized = true;
      if (disposed) {
        app.destroy(true);
        return;
      }
      host.replaceChildren(app.canvas);
      const render = (scanOffset = 0) => {
        const { grid: currentGrid, phase: currentPhase } = latestRef.current;
        const width = Math.max(host.clientWidth, 240);
        const height = Math.max(host.clientHeight, 250);
        app.renderer.resize(width, height);
        app.stage.removeChildren();
        const rows = Math.max(currentGrid.length, 3);
        const columns = Math.max(...currentGrid.map((row) => row.length), 5);
        const gap = Math.max(4, width * 0.009);
        const cell = Math.min((width - gap * (columns + 1)) / columns, (height - gap * (rows + 1)) / rows);
        const boardWidth = cell * columns + gap * (columns + 1);
        const boardHeight = cell * rows + gap * (rows + 1);
        const startX = (width - boardWidth) / 2;
        const startY = (height - boardHeight) / 2;
        const board = new Graphics().roundRect(startX - 5, startY - 5, boardWidth + 10, boardHeight + 10, 9).fill({ color: PALETTE.deep, alpha: 0.92 }).stroke({ color: currentPhase === 'bonus' ? PALETTE.gold : PALETTE.slate, width: 2 });
        app.stage.addChild(board);
        const content = new Container();
        currentGrid.forEach((row, rowIndex) => row.forEach((symbol, columnIndex) => drawSymbol(content, symbol, startX + gap + columnIndex * (cell + gap), startY + gap + rowIndex * (cell + gap), cell, currentPhase === 'spinning' ? scanOffset : 0)));
        app.stage.addChild(content);
        if (currentPhase === 'spinning') {
          const shutter = new Graphics().rect(startX, startY + boardHeight * 0.48, boardWidth, 3).fill({ color: PALETTE.cyan, alpha: 0.45 });
          app.stage.addChild(shutter);
        }
      };
      renderRef.current = render;
      render();
      resizeObserver = new ResizeObserver(() => render());
      resizeObserver.observe(host);
      app.ticker.add((ticker) => {
        const state = latestRef.current;
        if (state.phase === 'spinning' && !state.reducedMotion) render((ticker.lastTime * 0.22) % 400);
      });
    };
    void start().catch((error: unknown) => {
      if (disposed) return;
      console.error('PixiJS reel renderer failed to initialize.', error);
      const fallback = document.createElement('p');
      fallback.className = 'dp-renderer-fallback';
      fallback.textContent = 'Reel renderer unavailable. Game controls and mathematics remain active.';
      host.replaceChildren(fallback);
    });
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      renderRef.current = null;
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
