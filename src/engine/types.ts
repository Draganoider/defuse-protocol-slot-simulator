export const ENGINE_VERSION = '1.0.0' as const;
export const CONFIG_SCHEMA_VERSION = '1' as const;
export const MATH_VERSION = 'fixed-lines-1' as const;
export const RNG_ALGORITHM = 'mulberry32-v1' as const;

export type SymbolRole = 'regular' | 'wild' | 'scatter';
export type BonusRoute = 'alpha' | 'bravo';
export type SpinMode = 'base' | 'bonus';

export interface SymbolDefinition {
  readonly id: string;
  readonly name: string;
  readonly role: SymbolRole;
}

export interface PaytableEntry {
  readonly 3: number;
  readonly 4: number;
  readonly 5: number;
}

export interface BonusRules {
  readonly triggerScatters: number;
  readonly alphaSpinsByScatters: Readonly<Record<3 | 4 | 5, number>>;
  readonly bravoSpinsByScatters: Readonly<Record<3 | 4 | 5, number>>;
  readonly retriggerScatters: number;
  readonly retriggerSpins: number;
  readonly maxAwardedSpins: number;
  readonly alphaChargesPerSecuredReel: number;
  readonly bravoMultiplierSteps: readonly number[];
  readonly bravoMaxShields: number;
}

export interface GameConfig {
  readonly schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly mathVersion: typeof MATH_VERSION;
  readonly rngAlgorithm: typeof RNG_ALGORITHM;
  readonly reels: 5;
  readonly rows: 3;
  readonly baseWager: number;
  readonly maxWager: number;
  readonly symbols: readonly SymbolDefinition[];
  readonly wildSymbolId: string;
  readonly scatterSymbolId: string;
  readonly paylines: readonly (readonly number[])[];
  readonly baseReelStrips: readonly (readonly string[])[];
  readonly bonusReelStrips: Readonly<Record<BonusRoute, readonly (readonly string[])[]>>;
  readonly paytable: Readonly<Record<string, PaytableEntry>>;
  readonly bonus: BonusRules;
}

export interface ValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly configHash: string }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export interface RngSnapshot {
  readonly algorithm: typeof RNG_ALGORITHM;
  readonly seed: string;
  readonly state: number;
  readonly position: number;
}

export interface ReplayMetadata {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly mathVersion: typeof MATH_VERSION;
  readonly configId: string;
  readonly configHash: string;
  readonly rngBefore: RngSnapshot;
  readonly rngAfter: RngSnapshot;
  /** Required to replay a feature spin independently of surrounding session history. */
  readonly bonusStateBefore?: BonusState;
}

export interface GridPosition {
  readonly reel: number;
  readonly row: number;
}

export interface LineWin {
  readonly lineIndex: number;
  readonly symbolId: string;
  readonly count: 3 | 4 | 5;
  readonly positions: readonly GridPosition[];
  readonly lineBet: number;
  readonly paytableAward: number;
  readonly multiplier: number;
  readonly payout: number;
}

export interface ScatterSummary {
  readonly count: number;
  readonly positions: readonly GridPosition[];
  readonly triggered: boolean;
}

export interface BonusOffer {
  readonly source: 'generated' | 'developer-cheat';
  readonly scatterCount: 3 | 4 | 5;
  readonly alphaSpins: number;
  readonly bravoSpins: number;
}

export interface BonusState {
  readonly route: BonusRoute;
  readonly spinsRemaining: number;
  readonly totalAwarded: number;
  readonly totalPlayed: number;
  readonly retriggers: number;
  readonly alphaCharges: number;
  readonly alphaSecuredReels: readonly number[];
  readonly bravoMultiplier: number;
  readonly bravoShields: number;
}

export interface BonusSpinEvent {
  readonly route: BonusRoute;
  readonly isExtractionSpin: boolean;
  readonly coresCollected: number;
  readonly newlySecuredReels: readonly number[];
  readonly expandedWildReels: readonly number[];
  readonly retriggered: boolean;
  readonly retriggerSpinsAwarded: number;
  readonly multiplierBefore: number;
  readonly multiplierAfter: number;
  readonly shieldGranted: boolean;
  readonly shieldConsumed: boolean;
}

export interface SpinResult {
  readonly resultVersion: '1';
  readonly mode: SpinMode;
  readonly route?: BonusRoute;
  readonly wager: number;
  readonly lineBet: number;
  readonly stops: readonly number[];
  readonly rawGrid: readonly (readonly string[])[];
  readonly evaluatedGrid: readonly (readonly string[])[];
  readonly lineWins: readonly LineWin[];
  readonly scatter: ScatterSummary;
  readonly baseLinePayout: number;
  readonly appliedMultiplier: number;
  readonly totalPayout: number;
  readonly bonusOffer?: BonusOffer;
  readonly bonusEvent?: BonusSpinEvent;
  /** True only for feature spins entered through the development-only cheat boundary. */
  readonly developerGenerated: boolean;
  readonly replay: ReplayMetadata;
}

export interface GameSession {
  readonly sessionVersion: '1';
  readonly config: GameConfig;
  readonly configHash: string;
  readonly wager: number;
  readonly rng: RngSnapshot;
  readonly phase: 'base' | 'bonus-choice' | 'bonus';
  readonly pendingBonus?: BonusOffer;
  readonly bonusState?: BonusState;
  readonly developerCheat: boolean;
}

export interface SpinTransition {
  readonly session: GameSession;
  readonly result: SpinResult;
}

export interface RouteSimulationStats {
  readonly route: BonusRoute;
  readonly paidSpins: number;
  readonly bonusEntries: number;
  readonly bonusSpins: number;
  readonly retriggers: number;
  readonly totalWagered: number;
  readonly totalPayout: number;
  readonly observedRtp: number;
  /** Sample standard deviation of paid-spin return multiples. */
  readonly returnStdDev: number;
  /** Standard error of the observed RTP, derived from returnStdDev. */
  readonly rtpStandardError: number;
  readonly anyPayHitRate: number;
  readonly profitableHitRate: number;
  /** Observed bonus entries divided by paid base spins. */
  readonly bonusFrequency: number;
  /** Observed paid base spins per bonus entry; null when none occurred. */
  readonly spinsPerBonus: number | null;
  readonly maxWin: number;
  readonly featurePayout: number;
  readonly averageFeaturePayout: number;
}

export interface SimulationRequest {
  readonly config?: GameConfig;
  readonly seed: number | string;
  readonly paidSpins: number;
  readonly wager?: number;
  readonly route: BonusRoute;
}

export interface SimulationReport {
  readonly reportVersion: '1';
  readonly status: 'complete';
  readonly statisticKind: 'observed';
  readonly configId: string;
  readonly configHash: string;
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly mathVersion: typeof MATH_VERSION;
  readonly seed: string;
  readonly rngAlgorithm: typeof RNG_ALGORITHM;
  readonly requestedPaidSpins: number;
  readonly completedPaidSpins: number;
  readonly wager: number;
  readonly route: BonusRoute;
  readonly observedRtp: number;
  readonly returnStdDev: number;
  readonly rtpStandardError: number;
  readonly anyPayHitRate: number;
  readonly profitableHitRate: number;
  readonly bonusFrequency: number;
  readonly spinsPerBonus: number | null;
  readonly maxWin: number;
  readonly routeStats: Readonly<Record<BonusRoute, RouteSimulationStats | null>>;
}

export interface SimulationError {
  readonly code: string;
  readonly message: string;
  readonly issues?: readonly ValidationIssue[];
}
