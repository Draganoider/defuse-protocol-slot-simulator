import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_GAME_CONFIG,
  PAYLINES_20,
  buildGrid,
  chooseBonusRoute,
  createSession,
  spinBase,
  spinBonus,
  type BonusRoute,
  type GameSession,
  type SimulationReport,
  type SpinResult,
} from './engine';
import type {
  SimulationWorkerRequest,
  SimulationWorkerResponse,
} from './worker/simulation.worker';
import {
  Prototype,
  type PresentationPhase,
  type PrototypeBonus,
  type PrototypeFeatureSummary,
  type PrototypeStatistics,
} from './ui/Prototype';
import {
  MAX_PRESENTED_WIN_PATHS,
  WIN_PATH_CYCLE_MS,
  type ReelCell,
  type ReelGrid,
  type WinningPath,
} from './renderer/ReelCanvas';
import { useGameAudio } from './audio/useGameAudio';
import { recordDiagnostic, recordDiagnosticRateLimited } from './diagnostics/diagnostic-log';
import { classifyWin } from './presentation/win-tier';

const STARTING_BALANCE = 2_000;
const PRESENTATION_MS = 520;
const BONUS_AUTOPLAY_GAP_MS = 650;
const BONUS_AUTOPLAY_WIN_GAP_MS = 1_800;
const MIN_SPIN_ENTRY_GAP_MS = 180;

function createUiSeed(): string {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `${values[0].toString(16).padStart(8, '0')}-${values[1].toString(16).padStart(8, '0')}`;
}

function transposeGrid(grid: readonly (readonly string[])[]): ReelGrid {
  return Array.from({ length: DEFAULT_GAME_CONFIG.rows }, (_, row) =>
    Array.from({ length: DEFAULT_GAME_CONFIG.reels }, (_, reel) => grid[reel]?.[row] ?? 'RADIO'),
  );
}

function initialGrid(): ReelGrid {
  return transposeGrid(
    buildGrid(
      DEFAULT_GAME_CONFIG.baseReelStrips,
      Array.from({ length: DEFAULT_GAME_CONFIG.reels }, () => 0),
      DEFAULT_GAME_CONFIG.rows,
    ),
  );
}

function replayId(result: SpinResult): string {
  return `${result.mode.toUpperCase()}-${result.replay.rngBefore.position}-${result.replay.rngAfter.position}`;
}

function winningCells(result: SpinResult): readonly ReelCell[] {
  const unique = new Map<string, ReelCell>();
  for (const win of result.lineWins) {
    for (const position of win.positions) {
      const cell = { row: position.row, column: position.reel };
      unique.set(`${cell.row}:${cell.column}`, cell);
    }
  }
  return [...unique.values()];
}

function winningPaths(result: SpinResult): readonly WinningPath[] {
  return result.lineWins.map((win) => ({
    lineIndex: win.lineIndex,
    symbolId: win.symbolId,
    payout: win.payout,
    positions: (PAYLINES_20[win.lineIndex] ?? win.positions.map((position) => position.row))
      .map((row, column) => ({ row, column })),
    winningPositions: win.positions.map((position) => ({ row: position.row, column: position.reel })),
  }));
}

function bonusView(session: GameSession): PrototypeBonus | undefined {
  if (!session.bonusState) return undefined;
  const state = session.bonusState;
  return {
    route: state.route,
    spinsRemaining: state.spinsRemaining,
    alphaCharges: state.alphaCharges,
    alphaTarget: session.config.bonus.alphaChargesPerSecuredReel,
    bravoMultiplier: state.bravoMultiplier,
    bravoProtected: state.bravoShields > 0,
  };
}

function simulationView(report: SimulationReport): PrototypeStatistics {
  return {
    sampleSize: report.completedPaidSpins,
    observedRtp: report.observedRtp,
    anyPayHitRate: report.anyPayHitRate,
    profitableHitRate: report.profitableHitRate,
    bonusFrequency: report.bonusFrequency,
    maxWinMultiplier: report.maxWin / report.wager,
    seed: report.seed,
    configId: report.configId,
    route: report.route,
    completed: report.status === 'complete',
  };
}

function forcedCoreGrid(cores: 3 | 4 | 5): ReelGrid {
  const grid = initialGrid().map((row) => [...row]);
  for (let reel = 0; reel < cores; reel += 1) grid[1][reel] = 'CORE';
  return grid;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function App() {
  const {
    settings: audioSettings,
    status: audioStatus,
    updateSettings: updateAudioSettings,
    playSpin: playSpinAudio,
    presentResult: presentAudioResult,
    chooseRoute: playRouteAudio,
    finishFeature: finishFeatureAudio,
    clearFeatureAudio,
    preview: previewAudio,
  } = useGameAudio();
  const [seed, setSeed] = useState(createUiSeed);
  const [session, setSession] = useState(() => createSession({ seed }));
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [lastWin, setLastWin] = useState(0);
  const [grid, setGrid] = useState<ReelGrid>(initialGrid);
  const [phase, setPhase] = useState<PresentationPhase>('ready');
  const [lastReplayId, setLastReplayId] = useState<string>();
  const [highlightedCells, setHighlightedCells] = useState<readonly ReelCell[]>([]);
  const [highlightedPaths, setHighlightedPaths] = useState<readonly WinningPath[]>([]);
  const [forcedFixture, setForcedFixture] = useState(false);
  const [simulation, setSimulation] = useState<PrototypeStatistics>();
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [bonusAutoplay, setBonusAutoplay] = useState(true);
  const [environmentRoute, setEnvironmentRoute] = useState<BonusRoute>();
  const [featureSummary, setFeatureSummary] = useState<PrototypeFeatureSummary>();
  const presentationTimer = useRef<number | undefined>(undefined);
  const bonusAutoplayTimer = useRef<number | undefined>(undefined);
  const simulationWorker = useRef<Worker | undefined>(undefined);
  const pendingSimulation = useRef<string | undefined>(undefined);
  const lastAcceptedSpinAt = useRef(Number.NEGATIVE_INFINITY);
  const featureTotalWin = useRef(0);
  const featureSpinsPlayed = useRef(0);
  const reducedMotion = useReducedMotion();

  const finishPresentation = useCallback((nextPhase: PresentationPhase) => {
    if (presentationTimer.current !== undefined) window.clearTimeout(presentationTimer.current);
    if (reducedMotion) {
      setPhase(nextPhase);
      return;
    }
    presentationTimer.current = window.setTimeout(() => setPhase(nextPhase), PRESENTATION_MS);
  }, [reducedMotion]);

  useEffect(() => {
    const worker = new Worker(new URL('./worker/simulation.worker.ts', import.meta.url), { type: 'module' });
    simulationWorker.current = worker;
    worker.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
      const message = event.data;
      if (!message || message.requestId !== pendingSimulation.current) return;
      pendingSimulation.current = undefined;
      setSimulationRunning(false);
      if (message.type === 'complete') setSimulation(simulationView(message.report));
      else {
        recordDiagnostic('simulation-error', { message: message.error.message.slice(0, 500) });
        console.error(`Simulation failed: ${message.error.message}`);
      }
    };
    worker.onerror = (event) => {
      pendingSimulation.current = undefined;
      setSimulationRunning(false);
      recordDiagnostic('simulation-worker-error', { message: event.message.slice(0, 500) });
      console.error('Simulation worker failed.', event);
    };
    return () => {
      if (presentationTimer.current !== undefined) window.clearTimeout(presentationTimer.current);
      if (bonusAutoplayTimer.current !== undefined) window.clearTimeout(bonusAutoplayTimer.current);
      worker.terminate();
    };
  }, []);

  const showResult = useCallback((result: SpinResult, nextPhase: PresentationPhase) => {
    setGrid(transposeGrid(result.evaluatedGrid));
    setLastWin(result.totalPayout);
    setHighlightedCells(winningCells(result));
    setHighlightedPaths(winningPaths(result));
    setLastReplayId(replayId(result));
    setPhase('spinning');
    recordDiagnostic('spin-result', {
      mode: result.mode,
      payout: result.totalPayout,
      wager: result.wager,
      lineWins: result.lineWins.length,
      cores: result.scatter.count,
      nextPhase,
      rngBefore: result.replay.rngBefore.position,
      rngAfter: result.replay.rngAfter.position,
    });
    presentAudioResult(result, reducedMotion);
    finishPresentation(nextPhase);
  }, [finishPresentation, presentAudioResult, reducedMotion]);

  const handleSpin = useCallback(() => {
    const now = performance.now();
    if (phase === 'spinning' || session.phase === 'bonus-choice') {
      recordDiagnosticRateLimited('spin-blocked', { reason: phase === 'spinning' ? 'presenting' : 'bonus-choice' }, 500);
      return;
    }
    if (now - lastAcceptedSpinAt.current < MIN_SPIN_ENTRY_GAP_MS) {
      recordDiagnosticRateLimited('spin-blocked', { reason: 'entry-gap' }, 500);
      return;
    }
    if (session.phase === 'bonus') {
      const activeRoute = session.bonusState?.route;
      lastAcceptedSpinAt.current = now;
      recordDiagnostic('spin-start', { mode: 'bonus', route: session.bonusState?.route ?? 'unknown' });
      playSpinAudio(reducedMotion);
      const transition = spinBonus(session);
      featureTotalWin.current += transition.result.totalPayout;
      featureSpinsPlayed.current += 1;
      setSession(transition.session);
      setBalance((current) => current + transition.result.totalPayout);
      showResult(transition.result, transition.session.phase === 'bonus' ? 'bonus' : 'result');
      if (transition.session.phase !== 'bonus' && activeRoute) {
        setFeatureSummary({ route: activeRoute, totalWin: featureTotalWin.current, spinsPlayed: featureSpinsPlayed.current });
        finishFeatureAudio();
        recordDiagnostic('feature-complete', {
          route: activeRoute,
          totalWin: featureTotalWin.current,
          spinsPlayed: featureSpinsPlayed.current,
        });
      }
      return;
    }
    if (balance < session.wager) {
      recordDiagnosticRateLimited('spin-blocked', { reason: 'insufficient-credits' }, 1_000);
      return;
    }
    lastAcceptedSpinAt.current = now;
    recordDiagnostic('spin-start', { mode: 'base', balance, wager: session.wager });
    playSpinAudio(reducedMotion);
    const ordinarySession = session.developerCheat ? { ...session, developerCheat: false } : session;
    const transition = spinBase(ordinarySession);
    setForcedFixture(false);
    setSession(transition.session);
    setBalance((current) => current - ordinarySession.wager + transition.result.totalPayout);
    showResult(transition.result, transition.session.phase === 'bonus-choice' ? 'bonus-choice' : 'result');
  }, [balance, finishFeatureAudio, phase, playSpinAudio, reducedMotion, session, showResult]);

  const handleChooseBonus = useCallback((route: BonusRoute) => {
    if (session.phase !== 'bonus-choice') return;
    recordDiagnostic('bonus-route-chosen', { route });
    playRouteAudio(route);
    featureTotalWin.current = 0;
    featureSpinsPlayed.current = 0;
    setFeatureSummary(undefined);
    setEnvironmentRoute(route);
    setBonusAutoplay(true);
    lastAcceptedSpinAt.current = Number.NEGATIVE_INFINITY;
    setSession(chooseBonusRoute(session, route));
    setPhase('bonus');
  }, [playRouteAudio, session]);

  useEffect(() => {
    if (bonusAutoplayTimer.current !== undefined) {
      window.clearTimeout(bonusAutoplayTimer.current);
      bonusAutoplayTimer.current = undefined;
    }
    if (!bonusAutoplay || phase !== 'bonus' || session.phase !== 'bonus') return;
    const visibleLineCount = Math.min(highlightedPaths.length, MAX_PRESENTED_WIN_PATHS);
    const winSequenceGap = visibleLineCount * WIN_PATH_CYCLE_MS + 200;
    const autoplayGap = lastWin > 0
      ? Math.max(BONUS_AUTOPLAY_WIN_GAP_MS, winSequenceGap, classifyWin(lastWin, session.wager).durationMs + 180)
      : BONUS_AUTOPLAY_GAP_MS;
    bonusAutoplayTimer.current = window.setTimeout(() => {
      bonusAutoplayTimer.current = undefined;
      handleSpin();
    }, autoplayGap);
    return () => {
      if (bonusAutoplayTimer.current !== undefined) {
        window.clearTimeout(bonusAutoplayTimer.current);
        bonusAutoplayTimer.current = undefined;
      }
    };
  }, [bonusAutoplay, handleSpin, highlightedPaths.length, lastWin, phase, session.phase]);

  const resetSession = useCallback((nextSeed = seed) => {
    if (presentationTimer.current !== undefined) window.clearTimeout(presentationTimer.current);
    if (bonusAutoplayTimer.current !== undefined) window.clearTimeout(bonusAutoplayTimer.current);
    lastAcceptedSpinAt.current = Number.NEGATIVE_INFINITY;
    setBonusAutoplay(true);
    clearFeatureAudio();
    featureTotalWin.current = 0;
    featureSpinsPlayed.current = 0;
    setEnvironmentRoute(undefined);
    setFeatureSummary(undefined);
    setSession(createSession({ seed: nextSeed, wager: session.wager }));
    setBalance(STARTING_BALANCE);
    setLastWin(0);
    setGrid(initialGrid());
    setLastReplayId(undefined);
    setHighlightedCells([]);
    setHighlightedPaths([]);
    setForcedFixture(false);
    setPhase('ready');
    recordDiagnostic('session-reset', { wager: session.wager });
  }, [clearFeatureAudio, seed, session.wager]);

  const handleNewSeed = useCallback(() => {
    const nextSeed = createUiSeed();
    setSeed(nextSeed);
    resetSession(nextSeed);
  }, [resetSession]);

  const handleScaleWager = useCallback((direction: 'down' | 'up') => {
    if (session.phase !== 'base' || phase === 'spinning') return;
    const step = session.config.baseWager;
    const wager = Math.min(session.config.maxWager, Math.max(step, session.wager + (direction === 'up' ? step : -step)));
    setSession((current) => ({ ...current, wager }));
  }, [phase, session]);

  const handleForceBonus = useCallback(async (cores: 3 | 4 | 5) => {
    if (!import.meta.env.DEV || session.phase !== 'base' || phase === 'spinning') return;
    const { createDeveloperCheatBonus } = await import('./engine/dev-tools');
    setSession(createDeveloperCheatBonus(session, cores));
    setGrid(forcedCoreGrid(cores));
    setLastWin(0);
    setLastReplayId(`DEV-FORCED-${cores}-CORE`);
    setHighlightedCells([]);
    setHighlightedPaths([]);
    setForcedFixture(true);
    setPhase('bonus-choice');
  }, [phase, session]);

  const handleRunSimulation = useCallback((sampleSize: 10_000 | 100_000, route: BonusRoute) => {
    if (!simulationWorker.current || simulationRunning) return;
    const requestId = `${route}-${sampleSize}-${Date.now()}`;
    const message: SimulationWorkerRequest = {
      type: 'simulate',
      requestId,
      payload: { seed: `${seed}:simulation:${route}:${sampleSize}`, paidSpins: sampleSize, wager: session.wager, route },
    };
    pendingSimulation.current = requestId;
    setSimulationRunning(true);
    simulationWorker.current.postMessage(message);
  }, [seed, session.wager, simulationRunning]);

  const displayedReplay = forcedFixture ? lastReplayId : lastReplayId ?? `${session.rng.algorithm}:${session.rng.position}`;
  const bonus = useMemo(() => bonusView(session), [session]);

  return (
    <Prototype
      balance={balance}
      totalWager={session.wager}
      lastWin={lastWin}
      grid={grid}
      phase={phase}
      seed={seed}
      replayId={displayedReplay}
      configId={`${session.config.id} · ${session.configHash}`}
      bonus={bonus}
      environmentRoute={environmentRoute}
      featureSummary={featureSummary}
      bonusAutoplay={bonusAutoplay}
      winningCells={highlightedCells}
      winningPaths={highlightedPaths}
      simulation={simulation}
      simulationRunning={simulationRunning}
      reducedMotion={reducedMotion}
      audioSettings={audioSettings}
      audioStatus={audioStatus}
      devCheatsEnabled={import.meta.env.DEV}
      onSpin={handleSpin}
      onChooseBonus={handleChooseBonus}
      onToggleBonusAutoplay={() => setBonusAutoplay((current) => !current)}
      onRunSimulation={handleRunSimulation}
      onResetSeed={handleNewSeed}
      onScaleWager={handleScaleWager}
      onForceBonus={handleForceBonus}
      onResetSession={() => resetSession()}
      onUpdateAudio={updateAudioSettings}
      onPreviewAudio={previewAudio}
      onDismissFeatureSummary={() => {
        setFeatureSummary(undefined);
        setEnvironmentRoute(undefined);
      }}
    />
  );
}
