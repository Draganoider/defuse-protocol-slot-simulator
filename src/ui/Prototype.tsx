import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReelCanvas,
  type ReelCell,
  type ReelGrid,
  type WinningPath,
} from '../renderer/ReelCanvas';
import type { AudioPreviewCue, AudioSettings, AudioStatus } from '../audio/types';
import type { SpinSpeed, SpinTiming } from '../presentation/spin-timing';
import { playRecordNet, playRecordRtp, type PlayRecord } from '../presentation/play-record';
import { classifyWin } from '../presentation/win-tier';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { WinCelebration } from './WinCelebration';
import { useCountUp } from './useCountUp';
import './prototype.css';

// Shipped in every build, including production, as a deliberate project decision: the
// simulator uses virtual credits only and a forced result stays marked as developer
// generated, so the menu is a demonstration aid rather than a hidden advantage.
const DevCheats = lazy(() => import('./dev/DevCheats'));

export type PresentationPhase = 'ready' | 'spinning' | 'result' | 'bonus-choice' | 'bonus';
export type BonusRoute = 'alpha' | 'bravo';

export interface PrototypeStatistics {
  sampleSize: number;
  observedRtp: number;
  anyPayHitRate: number;
  profitableHitRate: number;
  bonusFrequency: number;
  maxWinMultiplier: number;
  seed: string;
  configId: string;
  /** Feature route explicitly supplied to the simulation worker. */
  route: BonusRoute;
  completed?: boolean;
}

export interface PrototypeBonus {
  /** The chosen branch while the feature is active; omit while choice awaits input. */
  route?: BonusRoute;
  spinsRemaining?: number;
  alphaCharges?: number;
  alphaTarget?: number;
  bravoMultiplier?: number;
  bravoProtected?: boolean;
}

export interface PrototypeFeatureSummary {
  readonly route: BonusRoute;
  readonly totalWin: number;
  readonly spinsPlayed: number;
}

export interface PrototypeProps {
  /** Authoritative virtual-credit state supplied by the application service. */
  balance: number;
  totalWager: number;
  lastWin: number;
  /** Complete, immutable grid produced before any presentation starts. */
  grid: ReelGrid;
  /** Immutable cell coordinates from the evaluated engine result. */
  winningCells?: readonly ReelCell[];
  /** Authoritative evaluated payline summaries used for visual tracing and labels. */
  winningPaths?: readonly WinningPath[];
  /** Reel settle plan derived from the committed result before presentation begins. */
  spinTiming?: SpinTiming;
  phase: PresentationPhase;
  seed: string;
  replayId?: string;
  configId?: string;
  bonus?: PrototypeBonus;
  /** Keeps the selected environment visible through the final feature result. */
  environmentRoute?: BonusRoute;
  featureSummary?: PrototypeFeatureSummary;
  /** Whether the application should request the next free spin automatically. */
  bonusAutoplay?: boolean;
  /** True when the remaining virtual-credit balance cannot cover the current wager. */
  insufficientCredits?: boolean;
  /** Browser-local running record of ordinary play. Never shared between visitors. */
  playRecord?: PlayRecord;
  /** How long the reels are displayed running. Presentation only. */
  spinSpeed?: SpinSpeed;
  onToggleSpinSpeed?: () => void;
  /** Virtual-credit cost of entering each route directly, at the current wager. */
  featureBuyPrices?: Readonly<Record<BonusRoute, number>>;
  onBuyFeature?: (route: BonusRoute) => void;
  simulation?: PrototypeStatistics;
  /** True while the parent-owned worker is processing a simulation request. */
  simulationRunning?: boolean;
  reducedMotion?: boolean;
  audioSettings: AudioSettings;
  audioStatus: AudioStatus;
  /** Shows the clearly labeled controls that request a forced feature outcome. */
  devCheatsEnabled?: boolean;
  onSpin: () => void;
  onChooseBonus: (route: BonusRoute) => void;
  onToggleBonusAutoplay: () => void;
  onRunSimulation: (sampleSize: 10_000 | 100_000, route: BonusRoute) => void;
  onResetSeed: () => void;
  onScaleWager: (direction: 'down' | 'up') => void;
  onForceBonus: (cores: 3 | 4 | 5) => void;
  onResetSession: () => void;
  onUpdateAudio: (patch: Partial<Omit<AudioSettings, 'version'>>) => void;
  onPreviewAudio: (cue: AudioPreviewCue) => void;
  onDismissFeatureSummary: () => void;
}

const initialGrid: ReelGrid = [
  ['RADIO', 'ARMOR', 'OPTIC', 'RECOVERY', 'CORE'],
  ['KNIFE', 'SIDEARM', 'WILD', 'CARBINE', 'KEYCARD'],
  ['PRECISION', 'RADIO', 'ARMOR', 'OPTIC', 'RECOVERY'],
];

const SYMBOL_NAMES: Readonly<Record<string, string>> = {
  CORE: 'Signal Core',
  WILD: 'Containment Specialist',
  RECOVERY: 'Recovery Case',
  PRECISION: 'Precision Platform',
  CARBINE: 'Tactical Carbine',
  KNIFE: 'Utility Knife',
  SIDEARM: 'Suppressed Sidearm',
  OPTIC: 'Optical Scanner',
  ARMOR: 'Armor Rig',
  KEYCARD: 'Access Keycard',
  RADIO: 'Field Radio',
};

function formatCredits(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function symbolName(id: string) {
  return SYMBOL_NAMES[id.toUpperCase()] ?? id;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'cyan' }) {
  return <div className={`dp-stat ${tone ? `dp-stat--${tone}` : ''}`}><dt>{label}</dt><dd>{value}</dd></div>;
}

/**
 * Presentation-only game cabinet contract. All fields are derived from parent-owned
 * engine/application state and every callback delegates a user intent back to it.
 * No payout, RNG, spin selection, or bonus math is implemented in this component.
 */
export function Prototype(props: PrototypeProps) {
  const [labOpen, setLabOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const activeGrid = props.grid.length ? props.grid : initialGrid;
  const winningPaths = props.winningPaths ?? [];
  const sceneRoute = props.environmentRoute ?? props.bonus?.route;
  const inFeature = props.phase === 'bonus'
    || (props.phase === 'spinning' && Boolean(props.bonus?.route));
  const hasPresentedWin = props.lastWin > 0 && (props.phase === 'result' || props.phase === 'bonus');
  const winPresentation = useMemo(
    () => classifyWin(hasPresentedWin ? props.lastWin : 0, props.totalWager),
    [hasPresentedWin, props.lastWin, props.totalWager],
  );
  const countedWin = useCountUp(
    hasPresentedWin ? props.lastWin : 0,
    winPresentation.countDurationMs,
    props.reducedMotion,
    `${props.replayId ?? props.seed}:${props.lastWin}`,
  );
  const strongestPath = winningPaths.reduce<WinningPath | undefined>((best, path) => !best || path.payout > best.payout ? path : best, undefined);
  const presentationLocked = props.phase === 'spinning' || props.phase === 'bonus-choice';
  const needsCredits = Boolean(props.insufficientCredits) && !inFeature && !presentationLocked;
  const spinDisabled = presentationLocked || needsCredits;
  // The wager must stay adjustable while credits are short, otherwise lowering it is
  // impossible and the only way to keep playing is a full session reset.
  const wagerControlsDisabled = presentationLocked || inFeature;
  const cheapestBuy = props.featureBuyPrices
    ? Math.min(props.featureBuyPrices.alpha, props.featureBuyPrices.bravo)
    : Number.POSITIVE_INFINITY;
  const buyDisabled = presentationLocked || inFeature || !props.onBuyFeature || props.balance < cheapestBuy;
  const outcomeFeedback = useMemo(() => {
    if (props.phase === 'spinning') return {
      eyebrow: 'Result locked',
      title: 'Presenting committed result',
      detail: 'Reel motion only reveals the result already supplied by the game engine.',
      tone: 'pending',
      statusLabel: 'Result presenting',
    } as const;
    if (props.phase === 'bonus-choice') return {
      eyebrow: 'Signal Core event',
      title: 'Feature route required',
      detail: 'The result is confirmed. Choose a relay route to continue the operation.',
      tone: 'feature',
      statusLabel: 'Awaiting route',
    } as const;
    if (needsCredits) return {
      eyebrow: 'Insufficient virtual credits',
      title: `${formatCredits(props.balance)} VC remaining`,
      detail: `The current wager is ${formatCredits(props.totalWager)} VC. Lower the wager or reset the virtual-credit session to continue.`,
      tone: 'neutral',
      statusLabel: 'Wager exceeds balance',
    } as const;
    if (hasPresentedWin) {
      const route = inFeature ? `${props.bonus?.route === 'bravo' ? 'Relay Bravo' : 'Relay Alpha'} · ` : '';
      const lineDetail = strongestPath
        ? `${winningPaths.length} winning ${winningPaths.length === 1 ? 'line' : 'lines'}. Strongest: line ${strongestPath.lineIndex + 1}, ${symbolName(strongestPath.symbolId)} ×${strongestPath.winningPositions?.length ?? strongestPath.positions.length}, +${formatCredits(strongestPath.payout)} VC.`
        : 'Virtual-credit payout applied from the committed result.';
      // A paused feature otherwise reports only the payout, leaving no statement that the
      // next automatic spin is waiting on the player.
      const pausedNote = inFeature && props.bonusAutoplay === false ? ' Automatic spins paused.' : '';
      return {
        eyebrow: `${route}payout confirmed`,
        title: `+${formatCredits(props.lastWin)} VC`,
        detail: `${lineDetail}${pausedNote}`,
        tone: 'win',
        statusLabel: inFeature ? 'Feature payout confirmed' : 'Payout confirmed',
      } as const;
    }
    if (inFeature) {
      const route = props.bonus?.route === 'bravo' ? 'Relay Bravo' : 'Relay Alpha';
      const spins = props.bonus?.spinsRemaining;
      return {
        eyebrow: route,
        title: 'Defuse Operation active',
        detail: spins === undefined
          ? 'Feature state confirmed. Automatic spins can be paused at any time.'
          : `${spins} free ${spins === 1 ? 'spin' : 'spins'} remaining. ${props.bonusAutoplay === false ? 'Automatic spins paused.' : 'Next spin runs automatically.'}`,
        tone: 'feature',
        statusLabel: `${route} active`,
      } as const;
    }
    if (props.phase === 'result') return {
      eyebrow: 'Result confirmed',
      title: 'No line payout',
      detail: 'The committed result returned no virtual-credit payout.',
      tone: 'neutral',
      statusLabel: 'Result confirmed',
    } as const;
    return {
      eyebrow: 'Containment console',
      title: 'System ready',
      detail: props.lastWin > 0
        ? `Previous result returned ${formatCredits(props.lastWin)} virtual credits.`
        : 'All balances and wagers are virtual credits.',
      tone: 'neutral',
      statusLabel: 'System secure',
    } as const;
  }, [hasPresentedWin, inFeature, needsCredits, props.balance, props.bonus?.route, props.bonus?.spinsRemaining, props.bonusAutoplay, props.lastWin, props.phase, props.totalWager, strongestPath, winningPaths.length]);

  const choosingRoute = props.phase === 'bonus-choice';
  const cabinetClassName = [
    'dp-cabinet',
    choosingRoute && 'dp-cabinet--choosing',
    inFeature && 'dp-cabinet--feature',
    sceneRoute && `dp-cabinet--${sceneRoute}`,
    hasPresentedWin && 'dp-cabinet--win',
    hasPresentedWin && `dp-cabinet--win-${winPresentation.tier}`,
  ].filter(Boolean).join(' ');

  const prototypeClassName = [
    'dp-prototype',
    props.reducedMotion && 'dp-prototype--reduced-motion',
    hasPresentedWin && 'dp-prototype--win',
    sceneRoute && `dp-prototype--${sceneRoute}`,
    hasPresentedWin && `dp-prototype--win-${winPresentation.tier}`,
  ].filter(Boolean).join(' ');

  useEffect(() => {
    if (!props.devCheatsEnabled) setCheatOpen(false);
  }, [props.devCheatsEnabled]);

  useEffect(() => {
    if (sceneRoute) document.documentElement.dataset.relayScene = sceneRoute;
    else delete document.documentElement.dataset.relayScene;
  }, [sceneRoute]);

  useEffect(() => () => {
    delete document.documentElement.dataset.relayScene;
  }, []);

  useEffect(() => {
    const handleSpaceSpin = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (spinDisabled || inFeature || props.featureSummary || helpOpen || labOpen || audioOpen || diagnosticsOpen || cheatOpen) return;
      const target = event.target;
      if (target instanceof Element && target.closest('button, a, input, select, textarea, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      props.onSpin();
    };
    window.addEventListener('keydown', handleSpaceSpin);
    return () => window.removeEventListener('keydown', handleSpaceSpin);
  }, [audioOpen, cheatOpen, diagnosticsOpen, helpOpen, inFeature, labOpen, props.featureSummary, props.onSpin, spinDisabled]);

  const { featureSummary, onDismissFeatureSummary } = props;
  useEffect(() => {
    // The route choice is deliberately excluded: it is a required decision with no
    // dismissed state, so there is nothing for Escape to return the player to.
    const closeTopPanel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (diagnosticsOpen) setDiagnosticsOpen(false);
      else if (audioOpen) setAudioOpen(false);
      else if (labOpen) setLabOpen(false);
      else if (helpOpen) setHelpOpen(false);
      else if (featureSummary) onDismissFeatureSummary();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', closeTopPanel);
    return () => window.removeEventListener('keydown', closeTopPanel);
  }, [audioOpen, diagnosticsOpen, featureSummary, helpOpen, labOpen, onDismissFeatureSummary]);

  return (
    <main className={prototypeClassName}>
      <span className="dp-win-ambient" aria-hidden="true" />
      <span className={`dp-route-atmosphere ${sceneRoute ? `dp-route-atmosphere--${sceneRoute}` : ''}`} aria-hidden="true"><i /><i /><i /></span>
      <header className="dp-topbar">
        <div><p className="dp-kicker">Pelagos Relay · containment console</p><h1>Defuse Protocol</h1></div>
        <div className="dp-topbar__actions">
          <button className="dp-quiet-button" type="button" onClick={() => setAudioOpen(true)}>{props.audioSettings.muted ? 'Audio off' : 'Audio'}</button>
          <button className="dp-quiet-button" type="button" onClick={() => setDiagnosticsOpen(true)}>Diagnostics</button>
          <button className="dp-quiet-button" type="button" onClick={() => setHelpOpen(true)}>Paytable & help</button>
          <button className="dp-quiet-button" type="button" onClick={() => setLabOpen(true)}>Lab</button>
        </div>
      </header>

      <p className="dp-no-value">Simulation only · virtual credits have no monetary value · no deposits, purchases, prizes, or cash-out.</p>

      <section className={cabinetClassName} aria-label="Defuse Protocol slot simulator" aria-busy={props.phase === 'spinning'} aria-describedby="dp-result-feedback">
        <div className="dp-cabinet__header"><span className={inFeature ? 'dp-mode dp-mode--feature' : 'dp-mode'}>{inFeature ? 'Defuse Operation' : 'Base operation'}</span><span>5 reels · 20 fixed lines</span><span className={`dp-status-dot dp-status-dot--${outcomeFeedback.tone}`}>{outcomeFeedback.statusLabel}</span></div>
        <div
          className={`dp-win-total dp-win-total--${hasPresentedWin ? winPresentation.tier : 'idle'}`}
          aria-hidden="true"
        >
          <span>{hasPresentedWin ? winPresentation.headline : 'Return'}</span>
          <strong>{hasPresentedWin ? `+${formatCredits(countedWin)}` : '—'}</strong>
          <small>VC</small>
        </div>
        <div className="dp-reel-frame">
          <ReelCanvas grid={activeGrid} phase={props.phase} winningCells={props.winningCells} winningPaths={winningPaths} bonusRoute={sceneRoute} winTier={winPresentation.tier} spinTiming={props.spinTiming} reducedMotion={props.reducedMotion} className="dp-reel-canvas" />
          {hasPresentedWin && <WinCelebration payout={props.lastWin} presentation={winPresentation} replayId={props.replayId} reducedMotion={props.reducedMotion} />}
          {choosingRoute && <BonusChoice onChoose={props.onChooseBonus} reducedMotion={props.reducedMotion} />}
        </div>
        <dl className="dp-scoreboard">
          <Stat label="Balance" value={`${formatCredits(props.balance)} VC`} />
          <Stat label="Total wager" value={`${formatCredits(props.totalWager)} VC`} tone="amber" />
          <Stat label="Last win" value={`${formatCredits(props.lastWin)} VC`} tone="cyan" />
        </dl>
        <div className="dp-control-deck">
          <div className="dp-deck-lead">
          <div className="dp-wager-controls"><span>Wager</span><button aria-label="Decrease wager" type="button" onClick={() => props.onScaleWager('down')} disabled={wagerControlsDisabled}>−</button><output>{formatCredits(props.totalWager)} VC</output><button aria-label="Increase wager" type="button" onClick={() => props.onScaleWager('up')} disabled={wagerControlsDisabled}>+</button></div>
            {props.onToggleSpinSpeed && (
              <button
                className={`dp-turbo-button${props.spinSpeed === 'turbo' ? ' dp-turbo-button--on' : ''}`}
                type="button"
                aria-pressed={props.spinSpeed === 'turbo'}
                onClick={props.onToggleSpinSpeed}
                title="Shorten the reel presentation. The result is unchanged."
              >
                Turbo
              </button>
            )}
          </div>
          <button
            className="dp-spin-button"
            type="button"
            onClick={inFeature ? props.onToggleBonusAutoplay : props.onSpin}
            disabled={spinDisabled}
            aria-keyshortcuts={inFeature ? undefined : 'Space'}
            title={inFeature ? undefined : 'Spin (Space)'}
          >
            {props.phase === 'spinning'
              ? 'Presenting result…'
              : needsCredits
                ? 'Out of credits'
                : inFeature
                  ? props.bonusAutoplay === false ? 'Resume auto spins' : 'Pause auto spins'
                  : 'Spin'}
          </button>
          <div className="dp-deck-side">
            <button
              className="dp-buy-button"
              type="button"
              onClick={() => setBuyOpen(true)}
              disabled={buyDisabled}
              title={buyDisabled ? undefined : 'Enter a relay route immediately for virtual credits'}
            >
              Buy feature
            </button>
            <div className="dp-replay"><span>Seed <code>{props.seed}</code></span><span>{props.replayId ? `Replay ${props.replayId}` : 'Replay ready'}</span><button type="button" onClick={props.onResetSeed} disabled={choosingRoute}>New seed</button></div>
          </div>
        </div>
        <section
          key={`${props.phase}-${props.replayId ?? props.seed}-${props.lastWin}`}
          id="dp-result-feedback"
          className={`dp-result-feedback dp-result-feedback--${outcomeFeedback.tone}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="dp-result-feedback__eyebrow">{outcomeFeedback.eyebrow}</span>
          <strong>{outcomeFeedback.title}</strong>
          <span>{outcomeFeedback.detail}</span>
        </section>
        {hasPresentedWin && winningPaths.length > 0 && <WinLedger paths={winningPaths} />}
        {inFeature && <FeatureMeter bonus={props.bonus} />}
      </section>

      <section className="dp-provenance" aria-label="Result provenance"><span>Configuration: <code>{props.configId ?? 'pending configuration'}</code></span><span>Seeded results can be replayed.</span><button type="button" onClick={props.onResetSession}>Reset virtual-credit session</button></section>
      <PlayRecordSummary record={props.playRecord} />
      {props.devCheatsEnabled && (
        <Suspense fallback={null}>
          <DevCheats open={cheatOpen} setOpen={setCheatOpen} onForceBonus={props.onForceBonus} onReset={props.onResetSession} />
        </Suspense>
      )}
      {choosingRoute && <div className="dp-bonus-lock" aria-hidden="true" />}
      {buyOpen && props.featureBuyPrices && props.onBuyFeature && (
        <FeatureBuyDialog
          prices={props.featureBuyPrices}
          balance={props.balance}
          wager={props.totalWager}
          onBuy={(route) => { setBuyOpen(false); props.onBuyFeature?.(route); }}
          onClose={() => setBuyOpen(false)}
        />
      )}
      {labOpen && <LabPanel statistics={props.simulation} playRecord={props.playRecord} running={props.simulationRunning} onRun={props.onRunSimulation} onClose={() => setLabOpen(false)} />}
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      {audioOpen && <AudioPanel settings={props.audioSettings} status={props.audioStatus} onUpdate={props.onUpdateAudio} onPreview={props.onPreviewAudio} onClose={() => setAudioOpen(false)} />}
      {diagnosticsOpen && <DiagnosticsPanel onClose={() => setDiagnosticsOpen(false)} />}
      {props.featureSummary && props.phase === 'result' && <FeatureSummary summary={props.featureSummary} onClose={props.onDismissFeatureSummary} />}
    </main>
  );
}

function FeatureSummary({ summary, onClose }: { readonly summary: PrototypeFeatureSummary; readonly onClose: () => void }) {
  const routeName = summary.route === 'alpha' ? 'Relay Alpha' : 'Relay Bravo';
  return (
    <div className={`dp-overlay dp-feature-summary dp-feature-summary--${summary.route}`} role="dialog" aria-modal="true" aria-labelledby="feature-summary-title">
      <section className="dp-dialog">
        <p className="dp-kicker">Operation complete</p>
        <h2 id="feature-summary-title">{routeName} secured</h2>
        <p>The complete deterministic feature result has been applied to the virtual-credit balance.</p>
        <div className="dp-feature-summary__total"><span>Total feature return</span><strong>+{formatCredits(summary.totalWin)} VC</strong></div>
        <dl><div><dt>Route</dt><dd>{routeName}</dd></div><div><dt>Spins completed</dt><dd>{summary.spinsPlayed}</dd></div></dl>
        <button type="button" autoFocus onClick={onClose}>Return to base operation</button>
      </section>
    </div>
  );
}

function AudioPanel({ settings, status, onUpdate, onPreview, onClose }: {
  settings: AudioSettings;
  status: AudioStatus;
  onUpdate: PrototypeProps['onUpdateAudio'];
  onPreview: PrototypeProps['onPreviewAudio'];
  onClose: () => void;
}) {
  const statusCopy: Readonly<Record<AudioStatus, string>> = {
    locked: 'Ready after your first spin or sound preview',
    loading: 'Loading original sound assets…',
    ready: 'Audio system active',
    unavailable: 'Audio is unavailable in this browser',
  };
  const slider = (label: string, key: 'masterVolume' | 'ambienceVolume' | 'effectsVolume' | 'musicVolume') => (
    <label className="dp-audio-slider">
      <span>{label}<output>{Math.round(settings[key] * 100)}%</output></span>
      <input type="range" min="0" max="1" step="0.01" value={settings[key]} onChange={(event) => onUpdate({ [key]: Number(event.currentTarget.value) })} />
    </label>
  );
  return <div className="dp-overlay" role="dialog" aria-modal="true" aria-labelledby="audio-title"><section className="dp-dialog dp-audio"><button className="dp-close" type="button" aria-label="Close audio settings" onClick={onClose}>×</button><p className="dp-kicker">Presentation audio</p><h2 id="audio-title">Audio console</h2><p>Grounded industrial ambience, feature music, and feedback created specifically for Defuse Protocol. Audio never selects or changes a result.</p><label className="dp-audio-mute"><input type="checkbox" checked={settings.muted} onChange={(event) => onUpdate({ muted: event.currentTarget.checked })} /><span>Mute all audio</span></label><div className="dp-audio-controls">{slider('Master', 'masterVolume')}{slider('Relay ambience', 'ambienceVolume')}{slider('Feature music', 'musicVolume')}{slider('Game effects', 'effectsVolume')}</div><div className="dp-audio-preview" aria-label="Sound previews"><button type="button" onClick={() => onPreview('spin-drive')}>Spin mechanism</button><button type="button" onClick={() => onPreview('payline-trace')}>Payline</button><button type="button" onClick={() => onPreview('win-medium')}>Win signal</button><button type="button" onClick={() => onPreview('core-activation')}>Signal Core</button></div><p className={`dp-audio-status dp-audio-status--${status}`} role="status">{statusCopy[status]}</p></section></div>;
}

function WinLedger({ paths }: { paths: readonly WinningPath[] }) {
  const visiblePaths = paths.slice(0, 4);
  return (
    <section className="dp-win-ledger" aria-label="Winning paylines">
      <header><span>Confirmed paylines</span><b>{paths.length}</b></header>
      <ol>
        {visiblePaths.map((path) => (
          <li key={`${path.lineIndex}-${path.symbolId}`}>
            <span>Line {String(path.lineIndex + 1).padStart(2, '0')}</span>
            <strong>{symbolName(path.symbolId)} ×{path.winningPositions?.length ?? path.positions.length}</strong>
            <b>+{formatCredits(path.payout)} VC</b>
          </li>
        ))}
      </ol>
      {paths.length > visiblePaths.length && <p>+{paths.length - visiblePaths.length} additional winning paylines</p>}
    </section>
  );
}

function FeatureMeter({ bonus }: { bonus?: PrototypeBonus }) {
  const spinsRemaining = bonus?.spinsRemaining;
  if (bonus?.route === 'bravo') return <section className="dp-feature-meter dp-feature-meter--bravo" aria-label="Relay Bravo status" aria-live="polite" aria-atomic="true"><p><strong>Relay Bravo — Emergency Recovery</strong><span>Consecutive wins raise the multiplier; a blank result resets it. Signal Cores protect one reset.</span></p><span className="dp-feature-spins">{spinsRemaining ?? '—'} <small>spins left</small></span><output className="dp-multiplier" aria-label={`${bonus.bravoMultiplier ?? 1} times multiplier`}>{bonus.bravoMultiplier ?? 1}×</output><span className={`dp-protect${bonus.bravoProtected ? ' dp-protect--armed' : ''}`}>{bonus.bravoProtected ? 'Core protection armed' : 'No protection armed'}</span></section>;
  const charges = bonus?.alphaCharges ?? 0;
  const target = bonus?.alphaTarget ?? 3;
  return <section className="dp-feature-meter dp-feature-meter--alpha" aria-label="Relay Alpha status" aria-live="polite" aria-atomic="true"><p><strong>Relay Alpha — Controlled Containment</strong><span>Signal Cores charge expanding wild reels for a final Extraction Spin.</span></p><span className="dp-feature-spins">{spinsRemaining ?? '—'} <small>spins left</small></span><div className="dp-meter-track" role="progressbar" aria-label="Containment charges" aria-valuemin={0} aria-valuemax={target} aria-valuenow={charges} aria-valuetext={`${charges} of ${target} containment charges`}><span style={{ width: `${Math.min(100, (charges / Math.max(target, 1)) * 100)}%` }} /></div><b>{charges}/{target} charges</b></section>;
}

/**
 * The required route decision is presented directly over the reels that produced the
 * Signal Core trigger. A sibling page lock keeps the rest of the console unreachable
 * so the pending offer cannot be discarded by an unrelated control.
 */
function BonusChoice({ onChoose, reducedMotion }: { onChoose: (route: BonusRoute) => void; reducedMotion?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [reducedMotion]);

  useEffect(() => {
    const trapFocus = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (event.key !== 'Tab' || !panel) return;
      const stops = [...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if (stops.length === 0) return;
      const edge = event.shiftKey ? stops[0] : stops[stops.length - 1];
      if (document.activeElement !== edge && panel.contains(document.activeElement)) return;
      event.preventDefault();
      (event.shiftKey ? stops[stops.length - 1] : stops[0]).focus();
    };
    window.addEventListener('keydown', trapFocus);
    return () => window.removeEventListener('keydown', trapFocus);
  }, []);

  return (
    <div ref={panelRef} className="dp-bonus-popup" role="dialog" aria-modal="true" aria-labelledby="bonus-choice-title" aria-describedby="bonus-choice-description">
      <section className="dp-bonus-choice">
        <p className="dp-kicker">Signal Core trigger confirmed</p>
        <h2 id="bonus-choice-title">Choose a relay route</h2>
        <p id="bonus-choice-description">Both routes are designed around similar expected feature return. Their risk profiles are different.</p>
        <div className="dp-choice-grid">
          <button type="button" autoFocus onClick={() => onChoose('alpha')}>
            <span className="dp-choice-mark">A</span>
            <strong>Relay Alpha</strong>
            <em>Controlled containment</em>
            <span>10 free spins. Collect Core charges to activate expanding wild reels and carry them into the Extraction Spin.</span>
            <b>Steadier medium outcomes</b>
          </button>
          <button type="button" onClick={() => onChoose('bravo')}>
            <span className="dp-choice-mark dp-choice-mark--red">B</span>
            <strong>Relay Bravo</strong>
            <em>Emergency recovery</em>
            <span>6 free spins. Consecutive wins escalate 1× → 2× → 3× → 5×; a blank spin resets it.</span>
            <b>Higher risk, larger peaks</b>
          </button>
        </div>
        <p className="dp-choice-commitment">Route selection changes feature behavior only. It does not redraw the triggering result.</p>
      </section>
    </div>
  );
}

/**
 * Confirmation for the largest single stake in the game. It states the price in credits and
 * as a multiple of the wager, and repeats that the credits are virtual, so the purchase is
 * never one misplaced click away.
 */
function FeatureBuyDialog({ prices, balance, wager, onBuy, onClose }: {
  prices: Readonly<Record<BonusRoute, number>>;
  balance: number;
  wager: number;
  onBuy: (route: BonusRoute) => void;
  onClose: () => void;
}) {
  const routes = [
    { route: 'alpha' as const, name: 'Relay Alpha', detail: '10 free spins · steadier containment charges' },
    { route: 'bravo' as const, name: 'Relay Bravo', detail: '6 free spins · higher-risk multiplier recovery' },
  ];
  return (
    <div className="dp-overlay" role="dialog" aria-modal="true" aria-labelledby="feature-buy-title">
      <section className="dp-dialog dp-feature-buy">
        <button className="dp-close" type="button" aria-label="Close feature buy" onClick={onClose}>×</button>
        <p className="dp-kicker">Virtual credits only</p>
        <h2 id="feature-buy-title">Buy a relay route</h2>
        <p>
          Enter a route immediately instead of waiting for three Signal Cores. The price is a
          stake of virtual credits, not a purchase: there is no money, deposit, or cash-out.
          A bought route returns slightly less over time than reaching it in ordinary play.
        </p>
        <div className="dp-choice-grid">
          {routes.map(({ route, name, detail }) => {
            const cost = prices[route];
            const affordable = balance >= cost;
            return (
              <button key={route} type="button" disabled={!affordable} onClick={() => onBuy(route)}>
                <strong>{name}</strong>
                <em>{formatCredits(cost)} VC · {Math.round(cost / Math.max(wager, 1))}× wager</em>
                <span>{detail}</span>
                <b>{affordable ? 'Balance covers this' : `Short by ${formatCredits(cost - balance)} VC`}</b>
              </button>
            );
          })}
        </div>
        <p className="dp-choice-commitment">
          The feature plays exactly as a triggered one, with the same variance. Purchased entries
          are recorded separately and never counted in base-game statistics.
        </p>
      </section>
    </div>
  );
}

function formatSigned(value: number) {
  return `${value < 0 ? '−' : '+'}${formatCredits(Math.abs(value))}`;
}

/**
 * One-line browser-local summary. It is deliberately outside the result provenance region:
 * it describes this browser's accumulated play, not the provenance of a committed result.
 */
function PlayRecordSummary({ record }: { record?: PlayRecord }) {
  if (!record || record.paidSpins === 0) return null;
  const net = playRecordNet(record);
  return (
    <section className={`dp-play-record-line dp-play-record-line--${net < 0 ? 'down' : 'up'}`} aria-label="Play record in this browser">
      <span>This browser only</span>
      <b>{formatSigned(net)} VC</b>
      <span>over {formatCredits(record.paidSpins)} paid {record.paidSpins === 1 ? 'spin' : 'spins'} · not shared between visitors</span>
    </section>
  );
}

function PlayRecordPanel({ record }: { record?: PlayRecord }) {
  if (!record || record.paidSpins === 0) {
    return <div className="dp-empty">No paid spins recorded in this browser yet. The record starts once you spin.</div>;
  }
  const net = playRecordNet(record);
  const rtp = playRecordRtp(record);
  return (
    <>
      <dl className="dp-lab-stats">
        <Stat label="Paid spins" value={formatCredits(record.paidSpins)} />
        <Stat label="Total staked" value={`${formatCredits(record.wagered)} VC`} tone="amber" />
        <Stat label="Total returned" value={`${formatCredits(record.returned)} VC`} tone="cyan" />
        <Stat label={net < 0 ? 'Net down' : 'Net up'} value={`${formatSigned(net)} VC`} tone={net < 0 ? 'amber' : 'cyan'} />
        <Stat label="Observed return" value={rtp === undefined ? 'Not observed' : percent(rtp)} />
        <Stat label="Largest single return" value={`${formatCredits(record.biggestWin)} VC`} />
      </dl>
      <p className="dp-provenance-text">
        Features entered: {formatCredits(record.featuresEntered)} · recorded since {new Date(record.startedAt).toLocaleString()}.
        This record is stored in this browser only. It is never sent anywhere, is not shared with other
        visitors or devices, and resets when a new build is deployed. Forced developer results are excluded.
        A short run says nothing about the declared long-run return.
      </p>
    </>
  );
}

function LabPanel({ statistics, playRecord, running = false, onRun, onClose }: { statistics?: PrototypeStatistics; playRecord?: PlayRecord; running?: boolean; onRun: PrototypeProps['onRunSimulation']; onClose: () => void }) {
  const [route, setRoute] = useState<BonusRoute>(statistics?.route ?? 'alpha');
  return <div className="dp-overlay" role="dialog" aria-modal="true" aria-labelledby="lab-title"><section className="dp-dialog dp-lab"><button className="dp-close" type="button" aria-label="Close laboratory" onClick={onClose}>×</button><p className="dp-kicker">Transparent mathematics</p><h2 id="lab-title">Simulation laboratory</h2><p>Observed figures come from a finite seeded run; they are not a promise of a session result.</p><section className="dp-play-record"><h3>Your play record in this browser</h3><PlayRecordPanel record={playRecord} /></section><fieldset className="dp-route-picker" disabled={running}><legend>Feature route to simulate</legend><label><input type="radio" name="simulation-route" checked={route === 'alpha'} onChange={() => setRoute('alpha')} /> Relay Alpha <span>Steadier containment charges</span></label><label><input type="radio" name="simulation-route" checked={route === 'bravo'} onChange={() => setRoute('bravo')} /> Relay Bravo <span>Higher-risk multiplier recovery</span></label></fieldset><div className="dp-sim-buttons"><button type="button" disabled={running} onClick={() => onRun(10_000, route)}>{running ? 'Simulation running…' : 'Run 10,000 spins'}</button><button type="button" disabled={running} onClick={() => onRun(100_000, route)}>Run 100,000 spins</button></div>{running && <p className="dp-running-status" role="status">Simulation worker is running {route === 'alpha' ? 'Relay Alpha' : 'Relay Bravo'}.</p>}{statistics ? <><dl className="dp-lab-stats"><Stat label="Observed RTP" value={percent(statistics.observedRtp)} tone="amber" /><Stat label="Any-pay hit rate" value={percent(statistics.anyPayHitRate)} /><Stat label="Profitable hit rate" value={percent(statistics.profitableHitRate)} /><Stat label="Bonus frequency" value={statistics.bonusFrequency ? `1 in ${(1 / statistics.bonusFrequency).toFixed(1)}` : 'Not observed'} /><Stat label="Maximum win" value={`${statistics.maxWinMultiplier.toFixed(1)}×`} tone="cyan" /><Stat label="Completed samples" value={formatCredits(statistics.sampleSize)} /></dl><p className="dp-provenance-text">{statistics.completed === false ? 'Partial run. ' : ''}{statistics.route === 'alpha' ? 'Relay Alpha' : 'Relay Bravo'} · seed <code>{statistics.seed}</code> · configuration <code>{statistics.configId}</code></p></> : <div className="dp-empty">Run a seeded route simulation to inspect observed results and provenance.</div>}</section></div>;
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  return <div className="dp-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title"><section className="dp-dialog dp-help"><button className="dp-close" type="button" aria-label="Close paytable and help" onClick={onClose}>×</button><p className="dp-kicker">How this simulator works</p><h2 id="help-title">Paytable & feature guide</h2><div className="dp-help-grid"><section><h3>Base game</h3><p>Wins evaluate on 20 fixed left-to-right paylines. The Containment Specialist substitutes for regular symbols; Signal Cores trigger the feature anywhere on the reels.</p><dl><div><dt>Containment Specialist</dt><dd>WILD substitute</dd></div><div><dt>Signal Core</dt><dd>CORE · 3 / 4 / 5 unlock route spins</dd></div><div><dt>Recovery Case / Precision Platform</dt><dd>Highest regular tiers</dd></div><div><dt>Tactical Carbine / Utility Knife / Suppressed Sidearm</dt><dd>High regular tiers</dd></div><div><dt>Optical Scanner / Armor Rig</dt><dd>Medium regular tiers</dd></div><div><dt>Access Keycard / Field Radio</dt><dd>Frequent regular tiers</dd></div></dl></section><section><h3>Read the lab</h3><p><strong>Any-pay</strong> counts any payout. <strong>Profitable</strong> counts payouts above the total wager. RTP is long-run returned virtual credits divided by total virtual credits wagered.</p><p>Every display result is chosen before presentation. The seed and configuration ID let you replay a result or simulation.</p></section></div></section></div>;
}
