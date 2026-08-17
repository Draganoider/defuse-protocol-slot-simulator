import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_GAME_CONFIG,
  PAYLINES_20,
  buildGrid,
  buyFeature,
  chooseBonusRoute,
  createSession,
  featureBuyCost,
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
  type ReelCell,
  type ReelGrid,
  type WinningPath,
} from './renderer/ReelCanvas';
import { MAX_PRESENTED_WIN_PATHS, WIN_PATH_CYCLE_MS } from './presentation/win-sequence';
import { useGameAudio } from './audio/useGameAudio';
import { recordDiagnostic, recordDiagnosticRateLimited } from './diagnostics/diagnostic-log';
import { classifyWin } from './presentation/win-tier';
import { featureIntensity } from './presentation/feature-intensity';
import {
  DEFAULT_SPIN_SPEED,
  isSpinSpeed,
  naturalSpinTiming,
  planSpinTiming,
  type SpinSpeed,
  type SpinTiming,
} from './presentation/spin-timing';
import {
  createPlayRecord,
  parsePlayRecord,
  PLAY_RECORD_STORAGE_KEY,
  recordSpin,
  type PlayRecord,
  type RecordedSpin,
} from './presentation/play-record';
import { BUILD_ID } from './build-id';

const STARTING_BALANCE = 2_000;
const BONUS_AUTOPLAY_GAP_MS = 650;
const BONUS_AUTOPLAY_WIN_GAP_MS = 1_800;
/** Extra hold after a feature win so its celebration is readable before the next spin. */
const BONUS_AUTOPLAY_TIER_TAIL_MS = 420;
const MIN_SPIN_ENTRY_GAP_MS = 180;
/** Highest scatter count the award table still pays more for. */
const MAX_AWARD_SCATTERS = Math.max(
  ...Object.keys(DEFAULT_GAME_CONFIG.bonus.alphaSpinsByScatters).map(Number),
);

/**
 * The forced-feature menu is available in every build, including the published site, but
 * only when explicitly requested with `?qa=1`. The default experience stays clean while a
 * single link still reaches the controls, and the preference persists for the tab so a
 * session reset or reload does not drop it.
 */
const QA_STORAGE_KEY = 'defuse-protocol:qa-tools:v1';
const SPIN_SPEED_STORAGE_KEY = 'defuse-protocol:spin-speed:v1';

function loadSpinSpeed(): SpinSpeed {
  try {
    const stored = window.localStorage.getItem(SPIN_SPEED_STORAGE_KEY);
    return isSpinSpeed(stored) ? stored : DEFAULT_SPIN_SPEED;
  } catch {
    return DEFAULT_SPIN_SPEED;
  }
}

function readQaToolsFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const requested = new URLSearchParams(window.location.search).get('qa');
    if (requested === '1') {
      window.sessionStorage.setItem(QA_STORAGE_KEY, '1');
      return true;
    }
    if (requested === '0') {
      window.sessionStorage.removeItem(QA_STORAGE_KEY);
      return false;
    }
    return window.sessionStorage.getItem(QA_STORAGE_KEY) === '1';
  } catch {
    // Blocked storage must never prevent the game from loading.
    return false;
  }
}

function loadPlayRecord(): PlayRecord {
  if (typeof window === 'undefined') return createPlayRecord(BUILD_ID);
  try {
    const stored = window.localStorage.getItem(PLAY_RECORD_STORAGE_KEY);
    return (stored ? parsePlayRecord(JSON.parse(stored), BUILD_ID) : undefined) ?? createPlayRecord(BUILD_ID);
  } catch {
    // A blocked or corrupt store must never prevent play.
    return createPlayRecord(BUILD_ID);
  }
}

function savePlayRecord(record: PlayRecord): void {
  try {
    window.localStorage.setItem(PLAY_RECORD_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // The record is best effort and never blocks a spin.
  }
}

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
    setFeatureIntensity,
    preview: previewAudio,
  } = useGameAudio();
  const [qaToolsEnabled] = useState(readQaToolsFlag);
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
  const [spinTiming, setSpinTiming] = useState<SpinTiming>();
  const [playRecord, setPlayRecord] = useState<PlayRecord>(loadPlayRecord);
  const [spinSpeed, setSpinSpeed] = useState<SpinSpeed>(loadSpinSpeed);
  // The session commits the next feature state before presentation begins, so the meter
  // reads a copy that only advances at the reveal. Showing the live state would announce
  // a multiplier step, a collected charge, or a consumed shield before the reels land.
  const [presentedBonus, setPresentedBonus] = useState<PrototypeBonus>();
  const presentationTimer = useRef<number | undefined>(undefined);
  const bonusAutoplayTimer = useRef<number | undefined>(undefined);
  const simulationWorker = useRef<Worker | undefined>(undefined);
  const pendingSimulation = useRef<string | undefined>(undefined);
  const lastAcceptedSpinAt = useRef(Number.NEGATIVE_INFINITY);
  const featureTotalWin = useRef(0);
  const featureSpinsPlayed = useRef(0);
  const reducedMotion = useReducedMotion();

  /**
   * Enters the next phase and applies everything the player is allowed to see only once
   * the reels have finished settling. The result itself is already committed; this defers
   * the readouts so a payout is not legible from the scoreboard before it is revealed.
   */
  const finishPresentation = useCallback((
    nextPhase: PresentationPhase,
    durationMs: number,
    reveal: () => void,
  ) => {
    if (presentationTimer.current !== undefined) window.clearTimeout(presentationTimer.current);
    const settle = () => {
      presentationTimer.current = undefined;
      reveal();
      setPhase(nextPhase);
    };
    if (reducedMotion) {
      settle();
      return;
    }
    presentationTimer.current = window.setTimeout(settle, durationMs);
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

  const trackSpin = useCallback((spin: RecordedSpin) => {
    setPlayRecord((current) => {
      const next = recordSpin(current, spin);
      if (next !== current) savePlayRecord(next);
      return next;
    });
  }, []);

  const showResult = useCallback((
    result: SpinResult,
    nextPhase: PresentationPhase,
    onRevealed?: () => void,
  ) => {
    // The reel plan is read from the committed result. Anticipation only changes how long
    // a reel is displayed running; it never selects, delays or alters a landing position.
    const timing = planSpinTiming({
      reels: DEFAULT_GAME_CONFIG.reels,
      scatterReelIndexes: result.scatter.positions.map((position) => position.reel),
      triggerScatters: DEFAULT_GAME_CONFIG.bonus.triggerScatters,
      maxAwardScatters: MAX_AWARD_SCATTERS,
      speed: spinSpeed,
    });
    setSpinTiming(timing);
    setGrid(transposeGrid(result.evaluatedGrid));
    // The award stays hidden until the reveal; only the stake has left the balance so far.
    setLastWin(0);
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
      anticipatedReels: timing.anticipation.filter((kind) => kind !== 'none').length,
      presentationMs: timing.presentationMs,
      rngBefore: result.replay.rngBefore.position,
      rngAfter: result.replay.rngAfter.position,
    });
    playSpinAudio(reducedMotion, timing);
    presentAudioResult(result, reducedMotion, timing.presentationMs);
    finishPresentation(nextPhase, timing.presentationMs, () => {
      setLastWin(result.totalPayout);
      if (result.totalPayout > 0) setBalance((current) => current + result.totalPayout);
      trackSpin({
        wager: result.wager,
        payout: result.totalPayout,
        paid: result.mode === 'base',
        enteredFeature: Boolean(result.bonusOffer),
        developerGenerated: result.developerGenerated,
      });
      onRevealed?.();
    });
  }, [finishPresentation, playSpinAudio, presentAudioResult, reducedMotion, spinSpeed, trackSpin]);

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
      const transition = spinBonus(session);
      featureTotalWin.current += transition.result.totalPayout;
      featureSpinsPlayed.current += 1;
      setSession(transition.session);
      const revealedBonus = bonusView(transition.session);
      showResult(
        transition.result,
        transition.session.phase === 'bonus' ? 'bonus' : 'result',
        () => setPresentedBonus(revealedBonus),
      );
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
    const ordinarySession = session.developerCheat ? { ...session, developerCheat: false } : session;
    const transition = spinBase(ordinarySession);
    setForcedFixture(false);
    setSession(transition.session);
    // The stake leaves immediately, the way a real cabinet debits before the reels run.
    setBalance((current) => current - ordinarySession.wager);
    showResult(transition.result, transition.session.phase === 'bonus-choice' ? 'bonus-choice' : 'result');
  }, [balance, finishFeatureAudio, phase, session, showResult]);

  const featureBuyPrices = useMemo(() => ({
    alpha: featureBuyCost(session, 'alpha'),
    bravo: featureBuyCost(session, 'bravo'),
  }), [session]);

  const handleBuyFeature = useCallback((route: BonusRoute) => {
    if (session.phase !== 'base' || phase === 'spinning') return;
    const cost = featureBuyPrices[route];
    if (balance < cost) {
      recordDiagnosticRateLimited('feature-buy-blocked', { route, cost, balance }, 1_000);
      return;
    }
    const purchase = buyFeature(session, route, balance);
    recordDiagnostic('feature-buy', { route, cost: purchase.cost, spinsAwarded: purchase.spinsAwarded });
    playRouteAudio(route);
    featureTotalWin.current = 0;
    featureSpinsPlayed.current = 0;
    setFeatureSummary(undefined);
    setEnvironmentRoute(route);
    setBonusAutoplay(true);
    lastAcceptedSpinAt.current = Number.NEGATIVE_INFINITY;
    setBalance((current) => current - purchase.cost);
    trackSpin({ wager: purchase.cost, payout: 0, paid: true, enteredFeature: true });
    setSession(purchase.session);
    setPresentedBonus(bonusView(purchase.session));
    setLastWin(0);
    setPhase('bonus');
  }, [balance, featureBuyPrices, phase, playRouteAudio, session, trackSpin]);

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
    const entered = chooseBonusRoute(session, route);
    setSession(entered);
    setPresentedBonus(bonusView(entered));
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
      ? Math.max(
        BONUS_AUTOPLAY_WIN_GAP_MS,
        winSequenceGap,
        classifyWin(lastWin, session.wager).durationMs + BONUS_AUTOPLAY_TIER_TAIL_MS,
      )
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
    setPresentedBonus(undefined);
    setSession(createSession({ seed: nextSeed, wager: session.wager }));
    setBalance(STARTING_BALANCE);
    setLastWin(0);
    setGrid(initialGrid());
    setLastReplayId(undefined);
    setHighlightedCells([]);
    setHighlightedPaths([]);
    setSpinTiming(naturalSpinTiming(spinSpeed));
    setForcedFixture(false);
    setPhase('ready');
    recordDiagnostic('session-reset', { wager: session.wager });
  }, [clearFeatureAudio, seed, session.wager, spinSpeed]);

  const handleToggleSpinSpeed = useCallback(() => {
    setSpinSpeed((current) => {
      const next: SpinSpeed = current === 'turbo' ? 'standard' : 'turbo';
      try {
        window.localStorage.setItem(SPIN_SPEED_STORAGE_KEY, next);
      } catch {
        // The preference is best effort and never blocks play.
      }
      recordDiagnostic('spin-speed-changed', { speed: next });
      return next;
    });
  }, []);

  const handleNewSeed = useCallback(() => {
    const nextSeed = createUiSeed();
    setSeed(nextSeed);
    resetSession(nextSeed);
  }, [resetSession]);

  const handleScaleWager = useCallback((direction: 'down' | 'up') => {
    if (session.phase !== 'base' || phase === 'spinning') return;
    // Derive the next wager inside the updater so a burst of clicks in one React batch
    // advances once per click instead of collapsing onto a single stale reading.
    setSession((current) => {
      if (current.phase !== 'base') return current;
      const step = current.config.baseWager;
      const wager = Math.min(current.config.maxWager, Math.max(step, current.wager + (direction === 'up' ? step : -step)));
      return wager === current.wager ? current : { ...current, wager };
    });
  }, [phase, session.phase]);

  const handleForceBonus = useCallback(async (cores: 3 | 4 | 5) => {
    if (!qaToolsEnabled || session.phase !== 'base' || phase === 'spinning') return;
    const { createDeveloperCheatBonus } = await import('./engine/dev-tools');
    setSession(createDeveloperCheatBonus(session, cores));
    setGrid(forcedCoreGrid(cores));
    setLastWin(0);
    setLastReplayId(`DEV-FORCED-${cores}-CORE`);
    setHighlightedCells([]);
    setHighlightedPaths([]);
    setSpinTiming(naturalSpinTiming(spinSpeed));
    setForcedFixture(true);
    setPhase('bonus-choice');
  }, [phase, qaToolsEnabled, session, spinSpeed]);

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

  // Feature music follows live route state: Alpha on secured reels, Bravo on the multiplier
  // ladder, both lifting into the closing spins. It only shapes presentation.
  useEffect(() => {
    const state = session.bonusState;
    if (!state) {
      setFeatureIntensity(0);
      return;
    }
    setFeatureIntensity(featureIntensity({
      route: state.route,
      spinsRemaining: state.spinsRemaining,
      totalAwarded: state.totalAwarded,
      alphaCharges: state.alphaCharges,
      securedReels: state.alphaSecuredReels.length,
      reels: session.config.reels,
      bravoMultiplier: state.bravoMultiplier,
      multiplierSteps: session.config.bonus.bravoMultiplierSteps,
    }));
  }, [session.bonusState, session.config, setFeatureIntensity]);

  // Cleared once the feature is over so a finished run cannot leave a stale meter.
  useEffect(() => {
    if (!session.bonusState) setPresentedBonus(undefined);
  }, [session.bonusState]);

  const displayedReplay = forcedFixture ? lastReplayId : lastReplayId ?? `${session.rng.algorithm}:${session.rng.position}`;
  const bonus = presentedBonus;

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
      insufficientCredits={session.phase === 'base' && balance < session.wager}
      spinSpeed={spinSpeed}
      onToggleSpinSpeed={handleToggleSpinSpeed}
      featureBuyPrices={featureBuyPrices}
      onBuyFeature={handleBuyFeature}
      playRecord={playRecord}
      winningCells={highlightedCells}
      winningPaths={highlightedPaths}
      spinTiming={spinTiming}
      simulation={simulation}
      simulationRunning={simulationRunning}
      reducedMotion={reducedMotion}
      audioSettings={audioSettings}
      audioStatus={audioStatus}
      devCheatsEnabled={qaToolsEnabled}
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
