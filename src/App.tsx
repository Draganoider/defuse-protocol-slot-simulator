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
  type PrototypeStatistics,
} from './ui/Prototype';
import type { ReelCell, ReelGrid, WinningPath } from './renderer/ReelCanvas';

const STARTING_BALANCE = 2_000;
const PRESENTATION_MS = 520;
const BONUS_AUTOPLAY_GAP_MS = 650;
const BONUS_AUTOPLAY_WIN_GAP_MS = 1_800;

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
  const presentationTimer = useRef<number | undefined>(undefined);
  const bonusAutoplayTimer = useRef<number | undefined>(undefined);
  const simulationWorker = useRef<Worker | undefined>(undefined);
  const pendingSimulation = useRef<string | undefined>(undefined);
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
      else console.error(`Simulation failed: ${message.error.message}`);
    };
    worker.onerror = (event) => {
      pendingSimulation.current = undefined;
      setSimulationRunning(false);
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
    finishPresentation(nextPhase);
  }, [finishPresentation]);

  const handleSpin = useCallback(() => {
    if (phase === 'spinning' || session.phase === 'bonus-choice') return;
    if (session.phase === 'bonus') {
      const transition = spinBonus(session);
      setSession(transition.session);
      setBalance((current) => current + transition.result.totalPayout);
      showResult(transition.result, transition.session.phase === 'bonus' ? 'bonus' : 'result');
      return;
    }
    if (balance < session.wager) return;
    const ordinarySession = session.developerCheat ? { ...session, developerCheat: false } : session;
    const transition = spinBase(ordinarySession);
    setForcedFixture(false);
    setSession(transition.session);
    setBalance((current) => current - ordinarySession.wager + transition.result.totalPayout);
    showResult(transition.result, transition.session.phase === 'bonus-choice' ? 'bonus-choice' : 'result');
  }, [balance, phase, session, showResult]);

  const handleChooseBonus = useCallback((route: BonusRoute) => {
    if (session.phase !== 'bonus-choice') return;
    setBonusAutoplay(true);
    setSession(chooseBonusRoute(session, route));
    setPhase('bonus');
  }, [session]);

  useEffect(() => {
    if (bonusAutoplayTimer.current !== undefined) {
      window.clearTimeout(bonusAutoplayTimer.current);
      bonusAutoplayTimer.current = undefined;
    }
    if (!bonusAutoplay || phase !== 'bonus' || session.phase !== 'bonus') return;
    const autoplayGap = lastWin > 0 ? BONUS_AUTOPLAY_WIN_GAP_MS : BONUS_AUTOPLAY_GAP_MS;
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
  }, [bonusAutoplay, handleSpin, lastWin, phase, session.phase]);

  const resetSession = useCallback((nextSeed = seed) => {
    if (presentationTimer.current !== undefined) window.clearTimeout(presentationTimer.current);
    if (bonusAutoplayTimer.current !== undefined) window.clearTimeout(bonusAutoplayTimer.current);
    setBonusAutoplay(true);
    setSession(createSession({ seed: nextSeed, wager: session.wager }));
    setBalance(STARTING_BALANCE);
    setLastWin(0);
    setGrid(initialGrid());
    setLastReplayId(undefined);
    setHighlightedCells([]);
    setHighlightedPaths([]);
    setForcedFixture(false);
    setPhase('ready');
  }, [seed, session.wager]);

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
      bonusAutoplay={bonusAutoplay}
      winningCells={highlightedCells}
      winningPaths={highlightedPaths}
      simulation={simulation}
      simulationRunning={simulationRunning}
      reducedMotion={reducedMotion}
      devCheatsEnabled={import.meta.env.DEV}
      onSpin={handleSpin}
      onChooseBonus={handleChooseBonus}
      onToggleBonusAutoplay={() => setBonusAutoplay((current) => !current)}
      onRunSimulation={handleRunSimulation}
      onResetSeed={handleNewSeed}
      onScaleWager={handleScaleWager}
      onForceBonus={handleForceBonus}
      onResetSession={() => resetSession()}
    />
  );
}
