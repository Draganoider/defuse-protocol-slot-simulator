import { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
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

export interface ReelCanvasProps {
  /** The complete grid selected by the engine. This component never changes it. */
  grid: ReelGrid;
  /** Drives visual motion only; it never selects or modifies a stop. */
  phase: 'ready' | 'spinning' | 'result' | 'bonus-choice' | 'bonus';
  /** Optional immutable outcome metadata for exact result emphasis. */
  winningCells?: readonly ReelCell[];
  /** Optional route metadata; omitted during base play and before a choice. */
  bonusRoute?: 'alpha' | 'bravo';
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
  corePulseMs: 1_400,
} as const;

const SYMBOLS: Record<string, { label: string; accent: number; shape: 'circle' | 'case' | 'diamond' | 'arc' }> = {
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
  return SYMBOLS[id.toUpperCase()] ?? { label: id.slice(0, 4).toUpperCase(), accent: PALETTE.slate, shape: 'diamond' as const };
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
  const centerY = size / 2 - 8;
  const productionTexture = textures.get(id.toUpperCase());
  if (productionTexture) {
    const art = new Sprite(productionTexture);
    art.anchor.set(0.5);
    art.position.set(centerX, centerY + 1);
    art.width = size * 0.72;
    art.height = size * 0.72;
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

  const label = new Text({ text: symbol.label, style: new TextStyle({ fill: PALETTE.mist, fontFamily: 'Arial, sans-serif', fontSize: Math.max(10, size * 0.13), fontWeight: '700', letterSpacing: 1.4 }) });
  label.anchor.set(0.5, 0.5);
  label.position.set(centerX, size * 0.8);
  layer.addChild(label);

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

/**
 * An original PixiJS v8 reel renderer. The grid is always the committed engine
 * result; deterministic animation only changes how that grid is presented.
 */
export function ReelCanvas({ grid, phase, winningCells = [], bonusRoute, reducedMotion = false, className }: ReelCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const latestRef = useRef({ grid, phase, winningCells, bonusRoute, reducedMotion });
  latestRef.current = { grid, phase, winningCells, bonusRoute, reducedMotion };

  useEffect(() => {
    renderRef.current?.();
  }, [grid, phase, winningCells, bonusRoute, reducedMotion]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const app = new Application();
    let disposed = false;
    let initialized = false;
    let destroyed = false;
    let resizeObserver: ResizeObserver | undefined;
    let mediaReduced = false;
    let removeMotionListener: () => void = () => {};
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const clock = { phase: latestRef.current.phase, phaseStartedAt: performance.now() };
    const destroyApp = () => {
      if (!initialized || destroyed) return;
      destroyed = true;
      removeMotionListener();
      app.destroy(true, { children: true });
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

      const render = () => {
        const now = performance.now();
        const {
          grid: currentGrid,
          phase: currentPhase,
          winningCells: currentWinningCells,
          bonusRoute: currentBonusRoute,
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
        const resultStrength = isResultPhase ? (shouldReduceMotion ? 0.16 : pulseEnvelope(resultProgress) * 0.55) : 0;
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

        if (isResultPhase && currentWinningCells.length > 0) {
          drawWinningCells(app.stage, currentWinningCells, startX, startY, gap, cell, currentGrid.length, columns, resultStrength);
        }
        drawCoreCue(app.stage, currentGrid, currentPhase, startX, startY, gap, cell, shouldReduceMotion, elapsed);
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
        const animateResult = (state.phase === 'result' || state.phase === 'bonus-choice' || state.phase === 'bonus') && elapsed < MOTION.resultEmphasisMs;
        const animateCore = (state.phase === 'bonus-choice' || state.phase === 'bonus') && hasCore && elapsed < MOTION.corePulseMs;
        if (!shouldReduceMotion && (state.phase === 'spinning' || animateResult || animateCore)) render();
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
      destroyApp();
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
