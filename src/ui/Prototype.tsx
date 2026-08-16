import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ReelCanvas, type ReelGrid } from '../renderer/ReelCanvas';
import './prototype.css';

const DevCheats = import.meta.env.DEV
  ? lazy(() => import('./dev/DevCheats'))
  : null;

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

export interface PrototypeProps {
  /** Authoritative virtual-credit state supplied by the application service. */
  balance: number;
  totalWager: number;
  lastWin: number;
  /** Complete, immutable grid produced before any presentation starts. */
  grid: ReelGrid;
  phase: PresentationPhase;
  seed: string;
  replayId?: string;
  configId?: string;
  bonus?: PrototypeBonus;
  simulation?: PrototypeStatistics;
  /** True while the parent-owned worker is processing a simulation request. */
  simulationRunning?: boolean;
  reducedMotion?: boolean;
  /** Development builds only; shows controls that request a forced feature outcome. */
  devCheatsEnabled?: boolean;
  onSpin: () => void;
  onChooseBonus: (route: BonusRoute) => void;
  onRunSimulation: (sampleSize: 10_000 | 100_000, route: BonusRoute) => void;
  onResetSeed: () => void;
  onScaleWager: (direction: 'down' | 'up') => void;
  onForceBonus: (cores: 3 | 4 | 5) => void;
  onResetSession: () => void;
}

const initialGrid: ReelGrid = [
  ['RADIO', 'ARMOR', 'OPTIC', 'RECOVERY', 'CORE'],
  ['KNIFE', 'SIDEARM', 'WILD', 'CARBINE', 'KEYCARD'],
  ['PRECISION', 'RADIO', 'ARMOR', 'OPTIC', 'RECOVERY'],
];

function formatCredits(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
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
  const [cheatOpen, setCheatOpen] = useState(false);
  const activeGrid = props.grid.length ? props.grid : initialGrid;
  const inFeature = props.phase === 'bonus';
  const spinDisabled = props.phase === 'spinning' || props.phase === 'bonus-choice';
  const wagerControlsDisabled = spinDisabled || inFeature;
  const outcomeMessage = useMemo(() => {
    if (props.phase === 'spinning') return 'Spin result has been committed. Reel display is in motion.';
    if (props.phase === 'bonus-choice') return 'Signal Core containment event. Choose a relay route.';
    if (inFeature) return `Defuse Operation active${props.bonus?.spinsRemaining ? `, ${props.bonus.spinsRemaining} free spins remaining` : ''}.`;
    if (props.lastWin > 0) return `Last result returned ${formatCredits(props.lastWin)} virtual credits.`;
    return 'System ready. All balances and wagers are virtual credits.';
  }, [inFeature, props.bonus?.spinsRemaining, props.lastWin, props.phase]);

  useEffect(() => {
    if (!props.devCheatsEnabled) setCheatOpen(false);
  }, [props.devCheatsEnabled]);

  return (
    <main className="dp-prototype">
      <header className="dp-topbar">
        <div><p className="dp-kicker">Pelagos Relay · containment console</p><h1>Defuse Protocol</h1></div>
        <div className="dp-topbar__actions">
          <button className="dp-quiet-button" type="button" onClick={() => setHelpOpen(true)}>Paytable & help</button>
          <button className="dp-quiet-button" type="button" onClick={() => setLabOpen(true)}>Lab</button>
        </div>
      </header>

      <p className="dp-no-value">Simulation only · virtual credits have no monetary value · no deposits, purchases, prizes, or cash-out.</p>
      <p className="dp-sr-only" aria-live="polite">{outcomeMessage}</p>

      <section className="dp-cabinet" aria-label="Defuse Protocol slot simulator">
        <div className="dp-cabinet__header"><span className={inFeature ? 'dp-mode dp-mode--feature' : 'dp-mode'}>{inFeature ? 'Defuse Operation' : 'Base operation'}</span><span>5 reels · 20 fixed lines</span><span className="dp-status-dot">{props.phase === 'spinning' ? 'Result presenting' : 'System secure'}</span></div>
        <div className="dp-reel-frame"><ReelCanvas grid={activeGrid} phase={props.phase} reducedMotion={props.reducedMotion} className="dp-reel-canvas" /></div>
        <dl className="dp-scoreboard">
          <Stat label="Balance" value={`${formatCredits(props.balance)} VC`} />
          <Stat label="Total wager" value={`${formatCredits(props.totalWager)} VC`} tone="amber" />
          <Stat label="Last win" value={`${formatCredits(props.lastWin)} VC`} tone="cyan" />
        </dl>
        <div className="dp-control-deck">
          <div className="dp-wager-controls"><span>Wager</span><button aria-label="Decrease wager" type="button" onClick={() => props.onScaleWager('down')} disabled={wagerControlsDisabled}>−</button><output>{formatCredits(props.totalWager)} VC</output><button aria-label="Increase wager" type="button" onClick={() => props.onScaleWager('up')} disabled={wagerControlsDisabled}>+</button></div>
          <button className="dp-spin-button" type="button" onClick={props.onSpin} disabled={spinDisabled}>{props.phase === 'spinning' ? 'Presenting result…' : inFeature ? 'Continue feature' : 'Spin'}</button>
          <div className="dp-replay"><span>Seed <code>{props.seed}</code></span><span>{props.replayId ? `Replay ${props.replayId}` : 'Replay ready'}</span><button type="button" onClick={props.onResetSeed}>New seed</button></div>
        </div>
        {inFeature && <FeatureMeter bonus={props.bonus} />}
      </section>

      <section className="dp-provenance" aria-label="Result provenance"><span>Configuration: <code>{props.configId ?? 'pending configuration'}</code></span><span>Seeded results can be replayed.</span><button type="button" onClick={props.onResetSession}>Reset virtual-credit session</button></section>
      {import.meta.env.DEV && props.devCheatsEnabled && DevCheats && (
        <Suspense fallback={null}>
          <DevCheats open={cheatOpen} setOpen={setCheatOpen} onForceBonus={props.onForceBonus} onReset={props.onResetSession} />
        </Suspense>
      )}
      {props.phase === 'bonus-choice' && <BonusChoice onChoose={props.onChooseBonus} />}
      {labOpen && <LabPanel statistics={props.simulation} running={props.simulationRunning} onRun={props.onRunSimulation} onClose={() => setLabOpen(false)} />}
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </main>
  );
}

function FeatureMeter({ bonus }: { bonus?: PrototypeBonus }) {
  if (bonus?.route === 'bravo') return <section className="dp-feature-meter" aria-label="Relay Bravo status"><p><strong>Relay Bravo — Emergency Recovery</strong><span>Consecutive wins raise the multiplier; a blank result resets it. Signal Cores protect one reset.</span></p><div className="dp-multiplier">{bonus.bravoMultiplier ?? 1}×</div><span className="dp-protect">{bonus.bravoProtected ? 'Core protection armed' : 'No protection armed'}</span></section>;
  const charges = bonus?.alphaCharges ?? 0;
  const target = bonus?.alphaTarget ?? 3;
  return <section className="dp-feature-meter" aria-label="Relay Alpha status"><p><strong>Relay Alpha — Controlled Containment</strong><span>Signal Cores charge expanding wild reels for a final Extraction Spin.</span></p><div className="dp-meter-track" aria-label={`${charges} of ${target} containment charges`}><span style={{ width: `${Math.min(100, (charges / Math.max(target, 1)) * 100)}%` }} /></div><b>{charges}/{target} charges</b></section>;
}

function BonusChoice({ onChoose }: { onChoose: (route: BonusRoute) => void }) {
  return <div className="dp-overlay" role="dialog" aria-modal="true" aria-labelledby="bonus-choice-title"><section className="dp-dialog dp-bonus-choice"><p className="dp-kicker">Signal Core trigger confirmed</p><h2 id="bonus-choice-title">Choose a relay route</h2><p>Both routes are designed around similar expected feature return. Their risk profiles are different.</p><div className="dp-choice-grid"><button type="button" onClick={() => onChoose('alpha')}><span className="dp-choice-mark">A</span><strong>Relay Alpha</strong><em>Controlled containment</em><span>10 free spins. Collect Core charges to activate expanding wild reels and carry them into the Extraction Spin.</span><b>Steadier medium outcomes</b></button><button type="button" onClick={() => onChoose('bravo')}><span className="dp-choice-mark dp-choice-mark--red">B</span><strong>Relay Bravo</strong><em>Emergency recovery</em><span>6 free spins. Consecutive wins escalate 1× → 2× → 3× → 5×; a blank spin resets it.</span><b>Higher risk, larger peaks</b></button></div></section></div>;
}

function LabPanel({ statistics, running = false, onRun, onClose }: { statistics?: PrototypeStatistics; running?: boolean; onRun: PrototypeProps['onRunSimulation']; onClose: () => void }) {
  const [route, setRoute] = useState<BonusRoute>(statistics?.route ?? 'alpha');
  return <div className="dp-overlay" role="dialog" aria-modal="true" aria-labelledby="lab-title"><section className="dp-dialog dp-lab"><button className="dp-close" type="button" aria-label="Close laboratory" onClick={onClose}>×</button><p className="dp-kicker">Transparent mathematics</p><h2 id="lab-title">Simulation laboratory</h2><p>Observed figures come from a finite seeded run; they are not a promise of a session result.</p><fieldset className="dp-route-picker" disabled={running}><legend>Feature route to simulate</legend><label><input type="radio" name="simulation-route" checked={route === 'alpha'} onChange={() => setRoute('alpha')} /> Relay Alpha <span>Steadier containment charges</span></label><label><input type="radio" name="simulation-route" checked={route === 'bravo'} onChange={() => setRoute('bravo')} /> Relay Bravo <span>Higher-risk multiplier recovery</span></label></fieldset><div className="dp-sim-buttons"><button type="button" disabled={running} onClick={() => onRun(10_000, route)}>{running ? 'Simulation running…' : 'Run 10,000 spins'}</button><button type="button" disabled={running} onClick={() => onRun(100_000, route)}>Run 100,000 spins</button></div>{running && <p className="dp-running-status" role="status">Simulation worker is running {route === 'alpha' ? 'Relay Alpha' : 'Relay Bravo'}.</p>}{statistics ? <><dl className="dp-lab-stats"><Stat label="Observed RTP" value={percent(statistics.observedRtp)} tone="amber" /><Stat label="Any-pay hit rate" value={percent(statistics.anyPayHitRate)} /><Stat label="Profitable hit rate" value={percent(statistics.profitableHitRate)} /><Stat label="Bonus frequency" value={statistics.bonusFrequency ? `1 in ${(1 / statistics.bonusFrequency).toFixed(1)}` : 'Not observed'} /><Stat label="Maximum win" value={`${statistics.maxWinMultiplier.toFixed(1)}×`} tone="cyan" /><Stat label="Completed samples" value={formatCredits(statistics.sampleSize)} /></dl><p className="dp-provenance-text">{statistics.completed === false ? 'Partial run. ' : ''}{statistics.route === 'alpha' ? 'Relay Alpha' : 'Relay Bravo'} · seed <code>{statistics.seed}</code> · configuration <code>{statistics.configId}</code></p></> : <div className="dp-empty">Run a seeded route simulation to inspect observed results and provenance.</div>}</section></div>;
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  return <div className="dp-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title"><section className="dp-dialog dp-help"><button className="dp-close" type="button" aria-label="Close paytable and help" onClick={onClose}>×</button><p className="dp-kicker">How this simulator works</p><h2 id="help-title">Paytable & feature guide</h2><div className="dp-help-grid"><section><h3>Base game</h3><p>Wins evaluate on 20 fixed left-to-right paylines. The Containment Specialist substitutes for regular symbols; Signal Cores trigger the feature anywhere on the reels.</p><dl><div><dt>Containment Specialist</dt><dd>WILD substitute</dd></div><div><dt>Signal Core</dt><dd>CORE · 3 / 4 / 5 unlock route spins</dd></div><div><dt>Recovery Case / Precision Platform</dt><dd>Highest regular tiers</dd></div><div><dt>Tactical Carbine / Utility Knife / Suppressed Sidearm</dt><dd>High regular tiers</dd></div><div><dt>Optical Scanner / Armor Rig</dt><dd>Medium regular tiers</dd></div><div><dt>Access Keycard / Field Radio</dt><dd>Frequent regular tiers</dd></div></dl></section><section><h3>Read the lab</h3><p><strong>Any-pay</strong> counts any payout. <strong>Profitable</strong> counts payouts above the total wager. RTP is long-run returned virtual credits divided by total virtual credits wagered.</p><p>Every display result is chosen before presentation. The seed and configuration ID let you replay a result or simulation.</p></section></div></section></div>;
}
