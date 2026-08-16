import { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { recordDiagnostic, recordDiagnosticRateLimited } from '../diagnostics/diagnostic-log';
import type { WinTier } from '../presentation/win-tier';
import recoveryCaseUrl from '../assets/symbols/symbol-recovery-case-base-01.webp';
import containmentSpecialistUrl from '../assets/symbols/symbol-containment-specialist-wild-01.webp';
import signalCoreUrl from '../assets/symbols/symbol-signal-core-base-01.webp';
import precisionPlatformUrl from '../assets/symbols/symbol-precision-platform-base-01.webp';
import tacticalCarbineUrl from '../assets/symbols/symbol-tactical-carbine-base-01.webp';
import utilityKnifeUrl from '../assets/symbols/symbol-utility-knife-base-01.webp';
import suppressedSidearmUrl from '../assets/symbols/symbol-suppressed-sidearm-base-01.webp';
import opticalScannerUrl from '../assets/symbols/symbol-optical-scanner-base-01.webp';
import armorRigUrl from '../assets/symbols/symbol-armor-rig-base-01.webp';
import accessKeycardUrl from '../assets/symbols/symbol-access-keycard-base-01.webp';
import fieldRadioUrl from '../assets/symbols/symbol-field-radio-base-01.webp';

/** A serializable, presentation-only reel grid. Rows are top-to-bottom. */
export type ReelGrid = readonly (readonly string[])[];

export interface ReelCell {
  readonly row: number;
  readonly column: number;
}

export interface WinningPath {
  readonly lineIndex: number;
  readonly symbolId: string;
  readonly payout: number;
  readonly positions: readonly ReelCell[];
  readonly winningPositions?: readonly ReelCell[];
}

export const WIN_PATH_CYCLE_MS = 900;
export const MAX_PRESENTED_WIN_PATHS = 4;

export interface ReelCanvasProps {
  /** The complete grid selected by the engine. This component never changes it. */
  grid: ReelGrid;
  /** Drives visual motion only; it never selects or modifies a stop. */
  phase: 'ready' | 'spinning' | 'result' | 'bonus-choice' | 'bonus';
  /** Optional immutable outcome metadata for exact result emphasis. */
  winningCells?: readonly ReelCell[];
  /** Evaluated payline paths supplied by the engine result. */
  winningPaths?: readonly WinningPath[];
  /** Optional route metadata; omitted during base play and before a choice. */
  bonusRoute?: 'alpha' | 'bravo';
  /** Presentation tier derived outside the renderer from the committed payout. */
  winTier?: WinTier;
  reducedMotion?: boolean;
  className?: string;
}

const PALETTE = {
  mist: 0xe2dccb,
  slate: 0x696b61,
  amber: 0xd19a45,
  cyan: 0x718d89,
  gold: 0xd8b25c,
  red: 0x9e4435,
  deep: 0x171b19,
};

const MOTION = {
  reelBaseMs: 244,
  reelStaggerMs: 47,
  resultEmphasisMs: 460,
  winPathDrawMs: 620,
  winPathCycleMs: WIN_PATH_CYCLE_MS,
  winResponseMs: WIN_PATH_CYCLE_MS * MAX_PRESENTED_WIN_PATHS,
  corePulseMs: 1_400,
} as const;

const SYMBOLS: Record<string, { name: string; mark?: string; accent: number; shape: 'circle' | 'case' | 'diamond' | 'arc' }> = {
  CORE: { name: 'Signal Core', mark: 'CORE', accent: PALETTE.cyan, shape: 'circle' },
  WILD: { name: 'Containment Specialist', mark: 'WILD', accent: PALETTE.gold, shape: 'diamond' },
  RECOVERY: { name: 'Recovery Case', accent: PALETTE.gold, shape: 'case' },
  ARMOR: { name: 'Armor Rig', accent: PALETTE.gold, shape: 'case' },
  OPTIC: { name: 'Optical Scanner', accent: PALETTE.cyan, shape: 'circle' },
  RADIO: { name: 'Field Radio', accent: PALETTE.amber, shape: 'arc' },
  SIDEARM: { name: 'Suppressed Sidearm', accent: PALETTE.amber, shape: 'diamond' },
  KNIFE: { name: 'Utility Knife', accent: PALETTE.slate, shape: 'diamond' },
  CARBINE: { name: 'Tactical Carbine', accent: PALETTE.cyan, shape: 'arc' },
  PRECISION: { name: 'Precision Platform', accent: PALETTE.gold, shape: 'arc' },
  KEYCARD: { name: 'Access Keycard', accent: PALETTE.slate, shape: 'case' },
};

const PRODUCTION_SYMBOL_ASSETS = {
  CORE: signalCoreUrl,
  RECOVERY: recoveryCaseUrl,
  WILD: containmentSpecialistUrl,
  PRECISION: precisionPlatformUrl,
  CARBINE: tacticalCarbineUrl,
  KNIFE: utilityKnifeUrl,
  SIDEARM: suppressedSidearmUrl,
  OPTIC: opticalScannerUrl,
  ARMOR: armorRigUrl,
  KEYCARD: accessKeycardUrl,
  RADIO: fieldRadioUrl,
} as const;

type PresentationPhase = ReelCanvasProps['phase'];

async function loadProductionTextures() {
  const textures = new Map<string, Texture>();
  await Promise.all(Object.entries(PRODUCTION_SYMBOL_ASSETS).map(async ([id, url]) => {
    try {
      textures.set(id, await Assets.load<Texture>(url));
    } catch (error: unknown) {
      console.warn(`Production texture ${id} could not be loaded; using the procedural fallback.`, error);
    }
  }));
  return textures;
}

function resolveSymbol(id: string) {
  return SYMBOLS[id.toUpperCase()] ?? { name: id, accent: PALETTE.slate, shape: 'diamond' as const };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number) {
  return 1 - ((1 - value) ** 3);
}

function pulseEnvelope(progress: number) {
  return Math.sin(clamp01(progress) * Math.PI) ** 2;
}

function drawSymbol(
  target: Container,
  textures: ReadonlyMap<string, Texture>,
  id: string,
  x: number,
  y: number,
  size: number,
  scanOffset: number,
  landingReaction = 0,
) {
  const symbol = resolveSymbol(id);
  const layer = new Container();
  layer.pivot.set(size / 2);
  layer.position.set(x + size / 2, y + size / 2);
  layer.scale.set(1 + landingReaction * 0.025);
  target.addChild(layer);

  const frame = new Graphics()
    .roundRect(3, 3, size - 6, size - 6, 2)
    .fill({ color: 0x2a2e2a })
    .stroke({ color: symbol.accent, width: id === 'CORE' || id === 'WILD' ? 2.5 : 1.2, alpha: 0.8 });
  layer.addChild(frame);

  if (landingReaction > 0) {
    layer.addChild(new Graphics()
      .roundRect(1, 1, size - 2, size - 2, 3)
      .stroke({ color: PALETTE.amber, width: 1.5, alpha: landingReaction * 0.55 }));
  }

  const centerX = size / 2;
  const centerY = size / 2 - (symbol.mark ? size * 0.045 : 0);
  const productionTexture = textures.get(id.toUpperCase());
  if (productionTexture) {
    const art = new Sprite(productionTexture);
    art.anchor.set(0.5);
    art.position.set(centerX, centerY + 1);
    const artSize = size * (symbol.mark ? 0.72 : 0.84);
    art.width = artSize;
    art.height = artSize;
    layer.addChild(art);
  } else {
    const art = new Graphics();
    const radius = size * 0.22;
    if (symbol.shape === 'circle') {
      art.circle(centerX, centerY, radius).stroke({ color: symbol.accent, width: 3 });
      art.circle(centerX, centerY, radius * 0.47).fill({ color: symbol.accent, alpha: 0.45 });
      art.moveTo(centerX - radius * 1.25, centerY).lineTo(centerX + radius * 1.25, centerY).stroke({ color: PALETTE.mist, width: 1, alpha: 0.5 });
    } else if (symbol.shape === 'case') {
      art.roundRect(centerX - radius * 1.25, centerY - radius * 0.7, radius * 2.5, radius * 1.45, 3).stroke({ color: symbol.accent, width: 3 });
      art.moveTo(centerX - radius * 1.4, centerY - radius).lineTo(centerX - radius * 0.55, centerY - radius).stroke({ color: symbol.accent, width: 2 });
      art.moveTo(centerX, centerY - radius * 0.7).lineTo(centerX, centerY + radius * 0.7).stroke({ color: symbol.accent, width: 2 });
    } else if (symbol.shape === 'arc') {
      art.arc(centerX, centerY, radius, Math.PI * 1.08, Math.PI * 1.92).stroke({ color: symbol.accent, width: 3 });
      art.arc(centerX, centerY, radius * 1.5, Math.PI * 1.15, Math.PI * 1.85).stroke({ color: symbol.accent, width: 2, alpha: 0.7 });
      art.circle(centerX, centerY + radius * 0.7, 3).fill({ color: symbol.accent });
    } else {
      art.poly([centerX, centerY - radius * 1.25, centerX + radius, centerY, centerX, centerY + radius * 1.25, centerX - radius, centerY]).stroke({ color: symbol.accent, width: 3 });
      art.circle(centerX, centerY, 3).fill({ color: symbol.accent });
    }
    layer.addChild(art);
  }

  if (symbol.mark) {
    layer.addChild(new Graphics()
      .roundRect(size * 0.22, size * 0.76, size * 0.56, size * 0.16, 2)
      .fill({ color: PALETTE.deep, alpha: 0.88 })
      .stroke({ color: symbol.accent, width: 1, alpha: 0.8 }));
    const label = new Text({
      text: symbol.mark,
      style: new TextStyle({
        fill: symbol.accent,
        fontFamily: 'Bahnschrift Condensed, Arial Narrow, sans-serif',
        fontSize: Math.max(10, size * 0.12),
        fontWeight: '800',
        letterSpacing: 1.8,
        stroke: { color: PALETTE.deep, width: 2 },
      }),
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(centerX, size * 0.84);
    layer.addChild(label);
  }

  if (scanOffset > 0) {
    layer.addChild(new Graphics().rect(5, (scanOffset + x * 0.15) % size, size - 10, 2).fill({ color: PALETTE.amber, alpha: 0.2 }));
  }
}

function drawAtmosphere(
  stage: Container,
  phase: PresentationPhase,
  x: number,
  y: number,
  width: number,
  height: number,
  bonusRoute: ReelCanvasProps['bonusRoute'],
  reducedMotion: boolean,
  elapsed: number,
) {
  if (phase !== 'bonus-choice' && phase !== 'bonus') return;
  const leftTone = phase === 'bonus-choice' || bonusRoute === 'alpha' ? PALETTE.cyan : PALETTE.red;
  const rightTone = phase === 'bonus-choice' ? PALETTE.red : bonusRoute === 'bravo' ? PALETTE.amber : PALETTE.gold;
  const drift = reducedMotion ? 0.4 : 0.35 + Math.sin(elapsed / 650) * 0.08;
  const rails = new Graphics()
    .moveTo(x - 10, y + height * 0.2).lineTo(x - 10, y + height * 0.8).stroke({ color: leftTone, width: 2, alpha: drift })
    .moveTo(x + width + 10, y + height * 0.2).lineTo(x + width + 10, y + height * 0.8).stroke({ color: rightTone, width: 2, alpha: drift })
    .moveTo(x - 14, y + height * 0.2).lineTo(x - 6, y + height * 0.2).stroke({ color: leftTone, width: 1, alpha: 0.55 })
    .moveTo(x + width + 6, y + height * 0.8).lineTo(x + width + 14, y + height * 0.8).stroke({ color: rightTone, width: 1, alpha: 0.55 });
  if (phase === 'bonus' && bonusRoute === 'alpha') {
    rails.moveTo(x - 13, y + height * 0.38).lineTo(x - 7, y + height * 0.38).stroke({ color: PALETTE.gold, width: 1, alpha: 0.5 });
  } else if (phase === 'bonus' && bonusRoute === 'bravo') {
    rails.moveTo(x + width + 7, y + height * 0.38).lineTo(x + width + 13, y + height * 0.44).stroke({ color: PALETTE.red, width: 1.5, alpha: 0.55 });
  }
  stage.addChild(rails);
}

function drawWinningCells(
  stage: Container,
  winningCells: readonly ReelCell[],
  startX: number,
  startY: number,
  gap: number,
  cell: number,
  rows: number,
  columns: number,
  strength: number,
) {
  const seen = new Set<string>();
  winningCells.forEach(({ row, column }) => {
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= rows || column >= columns) return;
    const key = `${row}:${column}`;
    if (seen.has(key)) return;
    seen.add(key);
    const x = startX + gap + column * (cell + gap);
    const y = startY + gap + row * (cell + gap);
    stage.addChild(new Graphics()
      .roundRect(x + 1.5, y + 1.5, cell - 3, cell - 3, 3)
      .stroke({ color: PALETTE.amber, width: 2, alpha: 0.3 + strength * 0.7 })
      .moveTo(x + cell * 0.18, y + cell - 5).lineTo(x + cell * 0.82, y + cell - 5)
      .stroke({ color: PALETTE.gold, width: 2, alpha: 0.38 + strength * 0.5 }));
  });
}

function cellCenter(
  position: ReelCell,
  startX: number,
  startY: number,
  gap: number,
  cell: number,
) {
  return {
    x: startX + gap + position.column * (cell + gap) + cell / 2,
    y: startY + gap + position.row * (cell + gap) + cell / 2,
  };
}

function partialLine(
  points: readonly { x: number; y: number }[],
  progress: number,
  color: number,
  width: number,
  alpha: number,
) {
  const graphic = new Graphics();
  if (points.length === 0) return graphic;
  graphic.moveTo(points[0].x, points[0].y);
  if (points.length === 1) return graphic.circle(points[0].x, points[0].y, width).fill({ color, alpha });

  const scaled = clamp01(progress) * (points.length - 1);
  const wholeSegments = Math.floor(scaled);
  for (let index = 1; index <= wholeSegments; index += 1) {
    graphic.lineTo(points[index].x, points[index].y);
  }
  if (wholeSegments < points.length - 1) {
    const fraction = scaled - wholeSegments;
    const from = points[wholeSegments];
    const to = points[wholeSegments + 1];
    graphic.lineTo(from.x + (to.x - from.x) * fraction, from.y + (to.y - from.y) * fraction);
  }
  return graphic.stroke({ color, width, alpha, cap: 'round', join: 'round' });
}

function drawRouteRibbon(stage: Container, points: readonly { x: number; y: number }[], progress: number, width: number) {
  const segmentCount = Math.max(0, Math.ceil((points.length - 1) * progress));
  for (let index = 0; index < segmentCount; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) continue;
    const segmentProgress = clamp01(progress * (points.length - 1) - index);
    const end = {
      x: from.x + (to.x - from.x) * segmentProgress,
      y: from.y + (to.y - from.y) * segmentProgress,
    };
    const halfWidth = width / 2;
    const perpendicularX = -((to.y - from.y) / length) * halfWidth;
    const perpendicularY = ((to.x - from.x) / length) * halfWidth;
    stage.addChild(new Graphics()
      .poly([
        from.x + perpendicularX, from.y + perpendicularY,
        end.x + perpendicularX, end.y + perpendicularY,
        end.x - perpendicularX, end.y - perpendicularY,
        from.x - perpendicularX, from.y - perpendicularY,
      ])
      .fill({ color: PALETTE.gold, alpha: 0.22 })
      .stroke({ color: PALETTE.deep, width: 2, alpha: 0.84 }));
  }
}

function drawWinningPaths(
  stage: Container,
  paths: readonly WinningPath[],
  startX: number,
  startY: number,
  gap: number,
  cell: number,
  rows: number,
  columns: number,
  reducedMotion: boolean,
  elapsed: number,
) {
  const validPaths = paths.map((path) => ({
    ...path,
    positions: path.positions
      .filter(({ row, column }) => Number.isInteger(row) && Number.isInteger(column) && row >= 0 && column >= 0 && row < rows && column < columns)
      .slice()
      .sort((left, right) => left.column - right.column),
  }))
    .filter((path) => path.positions.length > 0)
    .sort((left, right) => right.payout - left.payout || left.lineIndex - right.lineIndex)
    .slice(0, MAX_PRESENTED_WIN_PATHS);
  if (validPaths.length === 0) return;

  const sequenceDuration = validPaths.length * MOTION.winPathCycleMs;
  if (!reducedMotion && elapsed >= sequenceDuration) return;
  const activeIndex = reducedMotion ? 0 : Math.floor(elapsed / MOTION.winPathCycleMs);
  const activePath = validPaths[activeIndex];
  const cycleElapsed = reducedMotion ? MOTION.winPathDrawMs + 90 : elapsed % MOTION.winPathCycleMs;
  const drawProgress = reducedMotion ? 1 : easeOutCubic(clamp01((cycleElapsed - 90) / MOTION.winPathDrawMs));
  const activeKeys = new Set(activePath.positions.map(({ row, column }) => `${row}:${column}`));
  const payingPositions = activePath.winningPositions?.length ? activePath.winningPositions : activePath.positions;

  const dimmer = new Graphics();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (activeKeys.has(`${row}:${column}`)) continue;
      const x = startX + gap + column * (cell + gap);
      const y = startY + gap + row * (cell + gap);
      dimmer.roundRect(x + 3, y + 3, cell - 6, cell - 6, 2).fill({ color: PALETTE.deep, alpha: 0.42 });
    }
  }
  stage.addChild(dimmer);

  validPaths.forEach((path, index) => {
    if (index === activeIndex) return;
    const points = path.positions.map((position) => cellCenter(position, startX, startY, gap, cell));
    stage.addChild(partialLine(points, 1, PALETTE.slate, Math.max(2, cell * 0.025), 0.24));
  });

  const points = activePath.positions.map((position) => cellCenter(position, startX, startY, gap, cell));
  const lineWidth = Math.max(3, cell * 0.045);
  drawRouteRibbon(stage, points, drawProgress, Math.max(10, cell * 0.1));
  stage.addChild(partialLine(points, drawProgress, PALETTE.deep, lineWidth + 5, 0.88));
  stage.addChild(partialLine(points, drawProgress, PALETTE.gold, lineWidth, 0.98));
  stage.addChild(partialLine(points, drawProgress, PALETTE.amber, Math.max(1.5, lineWidth * 0.36), 1));

  const cellPulse = reducedMotion ? 0.82 : 0.78 + Math.sin(elapsed / 145) * 0.14;
  payingPositions.forEach((position) => {
    const pathIndex = activePath.positions.findIndex(({ row, column }) => row === position.row && column === position.column);
    const visitPoint = activePath.positions.length === 1 ? 1 : Math.max(0, pathIndex) / (activePath.positions.length - 1);
    if (visitPoint > drawProgress + 0.08) return;
    const x = startX + gap + position.column * (cell + gap);
    const y = startY + gap + position.row * (cell + gap);
    const center = cellCenter(position, startX, startY, gap, cell);
    stage.addChild(new Graphics()
      .roundRect(x - 1, y - 1, cell + 2, cell + 2, 4)
      .fill({ color: PALETTE.gold, alpha: 0.07 + cellPulse * 0.05 })
      .stroke({ color: PALETTE.gold, width: Math.max(2.5, cell * 0.035), alpha: cellPulse })
      .circle(center.x, center.y, Math.max(4, cell * 0.055))
      .fill({ color: PALETTE.mist, alpha: 0.94 })
      .stroke({ color: PALETTE.deep, width: 2, alpha: 0.9 }));
  });
}

function drawCoreCue(
  stage: Container,
  grid: ReelGrid,
  phase: PresentationPhase,
  startX: number,
  startY: number,
  gap: number,
  cell: number,
  reducedMotion: boolean,
  elapsed: number,
) {
  if (phase !== 'bonus-choice' && phase !== 'bonus') return;
  const pulse = reducedMotion ? 0.28 : 0.28 + (Math.sin((elapsed / MOTION.corePulseMs) * Math.PI * 2) + 1) * 0.16;
  grid.forEach((row, rowIndex) => row.forEach((id, columnIndex) => {
    if (id.toUpperCase() !== 'CORE') return;
    const centerX = startX + gap + columnIndex * (cell + gap) + cell / 2;
    const centerY = startY + gap + rowIndex * (cell + gap) + cell / 2;
    stage.addChild(new Graphics()
      .circle(centerX, centerY, cell * 0.43).stroke({ color: PALETTE.cyan, width: 1.5, alpha: pulse })
      .circle(centerX, centerY, cell * 0.48).stroke({ color: PALETTE.gold, width: 1, alpha: pulse * 0.55 }));
  }));
}

function drawWinTierVfx(
  stage: Container,
  tier: WinTier,
  phase: PresentationPhase,
  x: number,
  y: number,
  width: number,
  height: number,
  reducedMotion: boolean,
  elapsed: number,
) {
  if ((phase !== 'result' && phase !== 'bonus') || tier === 'none' || tier === 'standard') return;
  const intensity = tier === 'major' ? 1 : tier === 'big' ? 0.72 : 0.42;
  const envelope = reducedMotion ? 0.46 : Math.max(0, 1 - elapsed / (tier === 'major' ? 2_600 : tier === 'big' ? 2_150 : 1_350));
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const sweep = reducedMotion ? 0.5 : (elapsed % 1_100) / 1_100;
  stage.addChild(new Graphics()
    .rect(x, y + height * sweep, width, Math.max(2, height * 0.012))
    .fill({ color: PALETTE.gold, alpha: 0.08 + envelope * intensity * 0.18 })
    .circle(centerX, centerY, Math.min(width, height) * (0.32 + sweep * 0.24))
    .stroke({ color: PALETTE.gold, width: tier === 'major' ? 3 : 2, alpha: envelope * intensity * 0.28 }));

  const sparkCount = tier === 'major' ? 14 : tier === 'big' ? 9 : 5;
  for (let index = 0; index < sparkCount; index += 1) {
    const cycle = reducedMotion ? 0.6 : ((elapsed * (0.00022 + index * 0.000013) + index * 0.173) % 1);
    const sparkX = x + width * ((index * 0.271 + cycle * 0.16) % 1);
    const sparkY = y + height * (0.92 - cycle * 0.78);
    stage.addChild(new Graphics()
      .circle(sparkX, sparkY, 1.2 + (index % 3) * 0.55)
      .fill({ color: index % 2 === 0 ? PALETTE.gold : PALETTE.amber, alpha: envelope * intensity * 0.62 }));
  }
}

/**
 * An original PixiJS v8 reel renderer. The grid is always the committed engine
 * result; deterministic animation only changes how that grid is presented.
 */
export function ReelCanvas({ grid, phase, winningCells = [], winningPaths = [], bonusRoute, winTier = 'none', reducedMotion = false, className }: ReelCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const latestRef = useRef({ grid, phase, winningCells, winningPaths, bonusRoute, winTier, reducedMotion });
  latestRef.current = { grid, phase, winningCells, winningPaths, bonusRoute, winTier, reducedMotion };

  useEffect(() => {
    renderRef.current?.();
  }, [grid, phase, winningCells, winningPaths, bonusRoute, winTier, reducedMotion]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const app = new Application();
    let disposed = false;
    let initialized = false;
    let destroyed = false;
    let resizeObserver: ResizeObserver | undefined;
    let removeContextListeners: () => void = () => {};
    let mediaReduced = false;
    let removeMotionListener: () => void = () => {};
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const clock = { phase: latestRef.current.phase, phaseStartedAt: performance.now() };
    const destroyApp = () => {
      if (!initialized || destroyed) return;
      destroyed = true;
      removeMotionListener();
      removeContextListeners();
      app.destroy(true, { children: true });
      recordDiagnostic('renderer-disposed');
    };

    const start = async () => {
      await app.init({ backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
      initialized = true;
      if (disposed) {
        destroyApp();
        return;
      }
      const textures = await loadProductionTextures();
      if (disposed) {
        destroyApp();
        return;
      }
      host.replaceChildren(app.canvas);
      const canvas = app.canvas as HTMLCanvasElement;
      const handleContextLost = (event: Event) => {
        event.preventDefault();
        recordDiagnostic('renderer-context-lost', { phase: latestRef.current.phase });
      };
      const handleContextRestored = () => {
        recordDiagnostic('renderer-context-restored', { phase: latestRef.current.phase });
        renderRef.current?.();
      };
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);
      removeContextListeners = () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
      recordDiagnostic('renderer-ready', {
        width: host.clientWidth,
        height: host.clientHeight,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        framePolicy: 'display-refresh',
      });

      let renderCount = 0;
      let lastHeartbeatAt = performance.now();

      const render = () => {
        const now = performance.now();
        const {
          grid: currentGrid,
          phase: currentPhase,
          winningCells: currentWinningCells,
          winningPaths: currentWinningPaths,
          bonusRoute: currentBonusRoute,
          winTier: currentWinTier,
          reducedMotion: reducedMotionProp,
        } = latestRef.current;
        if (clock.phase !== currentPhase) {
          clock.phase = currentPhase;
          clock.phaseStartedAt = now;
        }
        const elapsed = now - clock.phaseStartedAt;
        const shouldReduceMotion = reducedMotionProp || mediaReduced;
        const width = Math.max(host.clientWidth, 240);
        const height = Math.max(host.clientHeight, 250);
        app.renderer.resize(width, height);
        app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
        const rows = Math.max(currentGrid.length, 3);
        const columns = Math.max(...currentGrid.map((row) => row.length), 5);
        const gap = Math.max(4, width * 0.009);
        const cell = Math.min((width - gap * (columns + 1)) / columns, (height - gap * (rows + 1)) / rows);
        const boardWidth = cell * columns + gap * (columns + 1);
        const boardHeight = cell * rows + gap * (rows + 1);
        const startX = (width - boardWidth) / 2;
        const startY = (height - boardHeight) / 2;
        const isResultPhase = currentPhase === 'result' || currentPhase === 'bonus-choice' || currentPhase === 'bonus';
        const resultProgress = clamp01(elapsed / MOTION.resultEmphasisMs);
        const hasLineWin = isResultPhase && currentWinningPaths.length > 0;
        const winPulse = shouldReduceMotion ? 0.78 : 0.72 + Math.sin(Math.min(elapsed, MOTION.winResponseMs) / 165) * 0.12;
        const resultStrength = isResultPhase
          ? hasLineWin ? winPulse : shouldReduceMotion ? 0.16 : pulseEnvelope(resultProgress) * 0.55
          : 0;
        const board = new Graphics()
          .roundRect(startX - 5, startY - 5, boardWidth + 10, boardHeight + 10, 3)
          .fill({ color: PALETTE.deep, alpha: 0.94 })
          .stroke({ color: currentPhase === 'bonus' ? PALETTE.gold : PALETTE.slate, width: 2 });
        if (resultStrength > 0) {
          board.roundRect(startX - 8, startY - 8, boardWidth + 16, boardHeight + 16, 4)
            .stroke({ color: PALETTE.amber, width: 1.5, alpha: resultStrength });
        }
        app.stage.addChild(board);
        drawAtmosphere(app.stage, currentPhase, startX, startY, boardWidth, boardHeight, currentBonusRoute, shouldReduceMotion, elapsed);

        const content = new Container();
        const viewportMask = new Graphics().rect(startX, startY, boardWidth, boardHeight).fill({ color: 0xffffff });
        app.stage.addChild(viewportMask);
        content.mask = viewportMask;
        const pitch = cell + gap;
        const cycle = Math.max(1, currentGrid.length) * pitch;
        const spinning = currentPhase === 'spinning' && !shouldReduceMotion;

        for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
          const reelDuration = MOTION.reelBaseMs + columnIndex * MOTION.reelStaggerMs;
          const reelProgress = spinning ? clamp01(elapsed / reelDuration) : 1;
          const totalTravel = cycle * (2 + (columnIndex % 3));
          const traveled = reelProgress >= 1 ? totalTravel : totalTravel * easeOutCubic(reelProgress);
          const reelOffset = reelProgress >= 1 ? 0 : traveled % cycle;
          const landingProgress = clamp01((reelProgress - 0.76) / 0.24);
          const landingReaction = spinning ? pulseEnvelope(landingProgress) : 0;
          const landingBounce = spinning ? -Math.sin(landingProgress * Math.PI) * cell * 0.035 : 0;
          const firstCopy = spinning ? -currentGrid.length : 0;
          const lastCopy = spinning ? currentGrid.length * 2 : currentGrid.length;

          for (let copyRow = firstCopy; copyRow < lastCopy; copyRow += 1) {
            const rowCount = Math.max(currentGrid.length, 1);
            const sourceRow = ((copyRow % rowCount) + rowCount) % rowCount;
            const id = currentGrid[sourceRow]?.[columnIndex];
            if (!id) continue;
            const symbolX = startX + gap + columnIndex * pitch;
            const symbolY = startY + gap + copyRow * pitch + reelOffset + landingBounce;
            const scanOffset = spinning ? (elapsed * 0.36 + columnIndex * 19) % cell : 0;
            drawSymbol(content, textures, id, symbolX, symbolY, cell, scanOffset, landingReaction);
          }
        }
        app.stage.addChild(content);

        if (spinning) {
          const lastDuration = MOTION.reelBaseMs + (columns - 1) * MOTION.reelStaggerMs;
          const activeStrength = 1 - clamp01(elapsed / lastDuration);
          const shutterY = startY + boardHeight * (0.3 + ((elapsed * 0.0007) % 0.4));
          app.stage.addChild(new Graphics().rect(startX, shutterY, boardWidth, 2).fill({ color: PALETTE.amber, alpha: 0.12 + activeStrength * 0.2 }));
        } else if (isResultPhase && resultStrength > 0 && !shouldReduceMotion) {
          const sweepY = startY + boardHeight * resultProgress;
          app.stage.addChild(new Graphics().rect(startX + 2, sweepY, boardWidth - 4, 2).fill({ color: PALETTE.amber, alpha: resultStrength * 0.35 }));
        }

        if (hasLineWin) {
          drawWinningPaths(
            app.stage,
            currentWinningPaths,
            startX,
            startY,
            gap,
            cell,
            currentGrid.length,
            columns,
            shouldReduceMotion,
            elapsed,
          );
        } else if (isResultPhase && currentWinningCells.length > 0) {
          drawWinningCells(app.stage, currentWinningCells, startX, startY, gap, cell, currentGrid.length, columns, resultStrength);
        }
        drawWinTierVfx(app.stage, currentWinTier, currentPhase, startX, startY, boardWidth, boardHeight, shouldReduceMotion, elapsed);
        drawCoreCue(app.stage, currentGrid, currentPhase, startX, startY, gap, cell, shouldReduceMotion, elapsed);
        renderCount += 1;
        if (now - lastHeartbeatAt >= 10_000) {
          lastHeartbeatAt = now;
          recordDiagnosticRateLimited('renderer-heartbeat', {
            renders: renderCount,
            phase: currentPhase,
            stageChildren: app.stage.children.length,
            width,
            height,
          }, 9_500);
        }
      };

      renderRef.current = render;
      mediaReduced = motionQuery?.matches ?? false;
      const handleMotionPreference = () => {
        mediaReduced = motionQuery?.matches ?? false;
        render();
      };
      motionQuery?.addEventListener('change', handleMotionPreference);
      removeMotionListener = () => motionQuery?.removeEventListener('change', handleMotionPreference);
      render();
      resizeObserver = new ResizeObserver(render);
      resizeObserver.observe(host);
      app.ticker.add(() => {
        const state = latestRef.current;
        const elapsed = performance.now() - clock.phaseStartedAt;
        const shouldReduceMotion = state.reducedMotion || mediaReduced;
        const hasCore = state.grid.some((row) => row.some((id) => id.toUpperCase() === 'CORE'));
        const isSettled = state.phase === 'result' || state.phase === 'bonus-choice' || state.phase === 'bonus';
        const animateResult = isSettled && elapsed < MOTION.resultEmphasisMs;
        // Keep one extra frame after the last displayed line so the final path
        // is cleared instead of remaining over the next presentation state.
        const winSequenceMs = Math.min(state.winningPaths.length, MAX_PRESENTED_WIN_PATHS) * MOTION.winPathCycleMs;
        const animateWin = isSettled && state.winningPaths.length > 0 && elapsed < winSequenceMs + 64;
        const animateCore = (state.phase === 'bonus-choice' || state.phase === 'bonus') && hasCore && elapsed < MOTION.corePulseMs;
        const tierDuration = state.winTier === 'major' ? 2_600 : state.winTier === 'big' ? 2_150 : state.winTier === 'strong' ? 1_350 : 0;
        const animateTier = isSettled && tierDuration > 0 && elapsed < tierDuration;
        if (!shouldReduceMotion && (state.phase === 'spinning' || animateResult || animateWin || animateCore || animateTier)) render();
      });
    };
    void start().catch((error: unknown) => {
      if (disposed) return;
      console.error('PixiJS reel renderer failed to initialize.', error);
      recordDiagnostic('renderer-init-error', { message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500) });
      const fallback = document.createElement('p');
      fallback.className = 'dp-renderer-fallback';
      fallback.textContent = 'Reel renderer unavailable. Game controls and mathematics remain active.';
      host.replaceChildren(fallback);
    });
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      renderRef.current = null;
      destroyApp();
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
