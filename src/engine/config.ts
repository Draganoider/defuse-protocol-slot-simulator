import { PAYLINES_20 } from './paylines';
import {
  CONFIG_SCHEMA_VERSION,
  MATH_VERSION,
  RNG_ALGORITHM,
  type GameConfig,
  type ValidationIssue,
  type ValidationResult,
} from './types';

export const SYMBOL_IDS = {
  RADIO: 'RADIO',
  KEYCARD: 'KEYCARD',
  ARMOR: 'ARMOR',
  OPTIC: 'OPTIC',
  SIDEARM: 'SIDEARM',
  KNIFE: 'KNIFE',
  CARBINE: 'CARBINE',
  PRECISION: 'PRECISION',
  RECOVERY: 'RECOVERY',
  WILD: 'WILD',
  CORE: 'CORE',
} as const;

const S = SYMBOL_IDS;

/** Applies the declared route-frequency tuning while preserving ordered circular strips. */
function tuneBonusStrips(
  strips: readonly (readonly string[])[],
  wildTargets: readonly number[],
  coreCopiesPerReel: number,
): readonly (readonly string[])[] {
  return strips.map((strip, reel) => {
    let coreCopies = 0;
    const coreTuned = strip.map((symbol) => {
      if (symbol !== S.CORE) return symbol;
      coreCopies += 1;
      return coreCopies <= coreCopiesPerReel ? symbol : S.RADIO;
    });
    let wildCopies = coreTuned.filter((symbol) => symbol === S.WILD).length;
    return coreTuned.map((symbol, index) => {
      if (wildCopies >= wildTargets[reel] || symbol === S.CORE || symbol === S.WILD) return symbol;
      if ((index * 7 + 3) % strip.length >= wildTargets[reel] + 2) return symbol;
      wildCopies += 1;
      return S.WILD;
    });
  });
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  id: 'defuse-protocol-standard-v1',
  name: 'Defuse Protocol — Standard Lab Configuration',
  mathVersion: MATH_VERSION,
  rngAlgorithm: RNG_ALGORITHM,
  reels: 5,
  rows: 3,
  baseWager: 20,
  maxWager: 2_000,
  symbols: [
    { id: S.RADIO, name: 'Field Radio', role: 'regular' },
    { id: S.KEYCARD, name: 'Access Keycard', role: 'regular' },
    { id: S.ARMOR, name: 'Armor Rig', role: 'regular' },
    { id: S.OPTIC, name: 'Optical Scanner', role: 'regular' },
    { id: S.SIDEARM, name: 'Suppressed Sidearm', role: 'regular' },
    { id: S.KNIFE, name: 'Utility Knife', role: 'regular' },
    { id: S.CARBINE, name: 'Tactical Carbine', role: 'regular' },
    { id: S.PRECISION, name: 'Precision Platform', role: 'regular' },
    { id: S.RECOVERY, name: 'Recovery Case', role: 'regular' },
    { id: S.WILD, name: 'Containment Specialist', role: 'wild' },
    { id: S.CORE, name: 'Signal Core', role: 'scatter' },
  ],
  wildSymbolId: S.WILD,
  scatterSymbolId: S.CORE,
  paylines: PAYLINES_20,
  baseReelStrips: [
    [S.RADIO, S.ARMOR, S.KEYCARD, S.OPTIC, S.RADIO, S.SIDEARM, S.KEYCARD, S.CARBINE, S.ARMOR, S.KNIFE, S.RADIO, S.PRECISION, S.KEYCARD, S.OPTIC, S.RECOVERY, S.RADIO, S.ARMOR, S.SIDEARM, S.KEYCARD, S.CARBINE, S.RADIO, S.KNIFE, S.OPTIC, S.KEYCARD, S.ARMOR, S.RECOVERY, S.PRECISION, S.SIDEARM, S.WILD, S.CORE],
    [S.KEYCARD, S.SIDEARM, S.RADIO, S.ARMOR, S.OPTIC, S.KEYCARD, S.KNIFE, S.RADIO, S.CARBINE, S.ARMOR, S.KEYCARD, S.RECOVERY, S.RADIO, S.SIDEARM, S.OPTIC, S.KEYCARD, S.PRECISION, S.RADIO, S.ARMOR, S.KNIFE, S.KEYCARD, S.CARBINE, S.RADIO, S.OPTIC, S.SIDEARM, S.ARMOR, S.RECOVERY, S.WILD, S.PRECISION, S.CORE],
    [S.ARMOR, S.RADIO, S.OPTIC, S.KEYCARD, S.SIDEARM, S.RADIO, S.ARMOR, S.CARBINE, S.KEYCARD, S.KNIFE, S.OPTIC, S.RADIO, S.RECOVERY, S.ARMOR, S.KEYCARD, S.SIDEARM, S.PRECISION, S.RADIO, S.OPTIC, S.KEYCARD, S.CARBINE, S.ARMOR, S.KNIFE, S.RADIO, S.RECOVERY, S.KEYCARD, S.SIDEARM, S.WILD, S.PRECISION, S.CORE],
    [S.OPTIC, S.KEYCARD, S.ARMOR, S.RADIO, S.CARBINE, S.SIDEARM, S.RADIO, S.KEYCARD, S.KNIFE, S.ARMOR, S.OPTIC, S.RECOVERY, S.RADIO, S.KEYCARD, S.PRECISION, S.SIDEARM, S.ARMOR, S.RADIO, S.CARBINE, S.KEYCARD, S.OPTIC, S.KNIFE, S.RADIO, S.ARMOR, S.SIDEARM, S.RECOVERY, S.KEYCARD, S.PRECISION, S.WILD, S.CORE],
    [S.SIDEARM, S.RADIO, S.KEYCARD, S.OPTIC, S.ARMOR, S.CARBINE, S.KEYCARD, S.RADIO, S.KNIFE, S.ARMOR, S.RECOVERY, S.OPTIC, S.KEYCARD, S.RADIO, S.PRECISION, S.SIDEARM, S.ARMOR, S.KEYCARD, S.CARBINE, S.RADIO, S.KNIFE, S.OPTIC, S.ARMOR, S.RADIO, S.RECOVERY, S.SIDEARM, S.KEYCARD, S.WILD, S.PRECISION, S.CORE],
  ],
  bonusReelStrips: {
    alpha: tuneBonusStrips([
      [S.RADIO, S.WILD, S.ARMOR, S.KEYCARD, S.CORE, S.OPTIC, S.RADIO, S.SIDEARM, S.KEYCARD, S.CARBINE, S.ARMOR, S.KNIFE, S.CORE, S.RADIO, S.PRECISION, S.KEYCARD, S.OPTIC, S.RECOVERY, S.WILD, S.RADIO, S.ARMOR, S.SIDEARM, S.KEYCARD, S.CARBINE, S.RADIO, S.KNIFE, S.OPTIC, S.RECOVERY, S.PRECISION, S.SIDEARM],
      [S.KEYCARD, S.SIDEARM, S.WILD, S.RADIO, S.ARMOR, S.CORE, S.OPTIC, S.KEYCARD, S.KNIFE, S.RADIO, S.CARBINE, S.ARMOR, S.RECOVERY, S.CORE, S.RADIO, S.SIDEARM, S.OPTIC, S.KEYCARD, S.PRECISION, S.RADIO, S.WILD, S.ARMOR, S.KNIFE, S.CARBINE, S.KEYCARD, S.OPTIC, S.SIDEARM, S.RECOVERY, S.ARMOR, S.PRECISION],
      [S.ARMOR, S.RADIO, S.OPTIC, S.WILD, S.KEYCARD, S.SIDEARM, S.CORE, S.RADIO, S.ARMOR, S.CARBINE, S.KEYCARD, S.KNIFE, S.OPTIC, S.RECOVERY, S.CORE, S.RADIO, S.PRECISION, S.ARMOR, S.KEYCARD, S.SIDEARM, S.WILD, S.OPTIC, S.RADIO, S.CARBINE, S.KEYCARD, S.KNIFE, S.RECOVERY, S.SIDEARM, S.PRECISION, S.RADIO],
      [S.OPTIC, S.KEYCARD, S.ARMOR, S.RADIO, S.WILD, S.CARBINE, S.SIDEARM, S.CORE, S.KEYCARD, S.RADIO, S.KNIFE, S.ARMOR, S.OPTIC, S.RECOVERY, S.RADIO, S.CORE, S.PRECISION, S.SIDEARM, S.ARMOR, S.KEYCARD, S.WILD, S.RADIO, S.CARBINE, S.OPTIC, S.KNIFE, S.RECOVERY, S.SIDEARM, S.PRECISION, S.RADIO, S.KEYCARD],
      [S.SIDEARM, S.RADIO, S.KEYCARD, S.OPTIC, S.ARMOR, S.WILD, S.CARBINE, S.CORE, S.KEYCARD, S.RADIO, S.KNIFE, S.ARMOR, S.RECOVERY, S.OPTIC, S.KEYCARD, S.RADIO, S.CORE, S.PRECISION, S.SIDEARM, S.WILD, S.ARMOR, S.KEYCARD, S.CARBINE, S.RADIO, S.KNIFE, S.OPTIC, S.RECOVERY, S.SIDEARM, S.PRECISION, S.ARMOR],
    ], [7, 7, 7, 6, 6], 1),
    bravo: tuneBonusStrips([
      [S.WILD, S.RADIO, S.ARMOR, S.KEYCARD, S.CORE, S.OPTIC, S.RADIO, S.WILD, S.SIDEARM, S.KEYCARD, S.CARBINE, S.ARMOR, S.KNIFE, S.CORE, S.RADIO, S.PRECISION, S.KEYCARD, S.WILD, S.OPTIC, S.RECOVERY, S.RADIO, S.ARMOR, S.SIDEARM, S.KEYCARD, S.CARBINE, S.RADIO, S.KNIFE, S.OPTIC, S.RECOVERY, S.PRECISION],
      [S.KEYCARD, S.SIDEARM, S.WILD, S.RADIO, S.ARMOR, S.CORE, S.OPTIC, S.KEYCARD, S.KNIFE, S.RADIO, S.WILD, S.CARBINE, S.ARMOR, S.RECOVERY, S.CORE, S.RADIO, S.SIDEARM, S.OPTIC, S.KEYCARD, S.PRECISION, S.WILD, S.RADIO, S.ARMOR, S.KNIFE, S.CARBINE, S.KEYCARD, S.OPTIC, S.SIDEARM, S.RECOVERY, S.PRECISION],
      [S.ARMOR, S.RADIO, S.OPTIC, S.WILD, S.KEYCARD, S.SIDEARM, S.CORE, S.RADIO, S.ARMOR, S.CARBINE, S.KEYCARD, S.WILD, S.KNIFE, S.OPTIC, S.RECOVERY, S.CORE, S.RADIO, S.PRECISION, S.ARMOR, S.KEYCARD, S.SIDEARM, S.WILD, S.OPTIC, S.RADIO, S.CARBINE, S.KEYCARD, S.KNIFE, S.RECOVERY, S.PRECISION, S.RADIO],
      [S.OPTIC, S.KEYCARD, S.ARMOR, S.RADIO, S.WILD, S.CARBINE, S.SIDEARM, S.CORE, S.KEYCARD, S.RADIO, S.KNIFE, S.WILD, S.ARMOR, S.OPTIC, S.RECOVERY, S.RADIO, S.CORE, S.PRECISION, S.SIDEARM, S.ARMOR, S.KEYCARD, S.WILD, S.RADIO, S.CARBINE, S.OPTIC, S.KNIFE, S.RECOVERY, S.SIDEARM, S.PRECISION, S.RADIO],
      [S.SIDEARM, S.RADIO, S.KEYCARD, S.OPTIC, S.ARMOR, S.WILD, S.CARBINE, S.CORE, S.KEYCARD, S.RADIO, S.KNIFE, S.ARMOR, S.WILD, S.RECOVERY, S.OPTIC, S.KEYCARD, S.RADIO, S.CORE, S.PRECISION, S.SIDEARM, S.WILD, S.ARMOR, S.KEYCARD, S.CARBINE, S.RADIO, S.KNIFE, S.OPTIC, S.RECOVERY, S.PRECISION, S.ARMOR],
    ], [5, 5, 5, 5, 5], 2),
  },
  paytable: {
    [S.RADIO]: { 3: 3, 4: 8, 5: 25 },
    [S.KEYCARD]: { 3: 4, 4: 10, 5: 30 },
    [S.ARMOR]: { 3: 5, 4: 15, 5: 45 },
    [S.OPTIC]: { 3: 7, 4: 20, 5: 65 },
    [S.SIDEARM]: { 3: 9, 4: 30, 5: 90 },
    [S.KNIFE]: { 3: 12, 4: 45, 5: 140 },
    [S.CARBINE]: { 3: 15, 4: 60, 5: 200 },
    [S.PRECISION]: { 3: 25, 4: 100, 5: 400 },
    [S.RECOVERY]: { 3: 35, 4: 150, 5: 600 },
  },
  bonus: {
    triggerScatters: 3,
    alphaSpinsByScatters: { 3: 10, 4: 13, 5: 16 },
    bravoSpinsByScatters: { 3: 6, 4: 8, 5: 10 },
    retriggerScatters: 3,
    retriggerSpins: 4,
    maxAwardedSpins: 30,
    alphaChargesPerSecuredReel: 3,
    bravoMultiplierSteps: [1, 2, 3, 5],
    bravoMaxShields: 3,
  },
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

export function hashConfig(config: GameConfig): string {
  const serialized = stableSerialize(config);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasRuntimeConfigShape(value: unknown): value is GameConfig {
  if (!isRecord(value)) return false;
  const featureStrips = value.bonusReelStrips;
  const bonus = value.bonus;
  return Array.isArray(value.symbols)
    && value.symbols.every(isRecord)
    && Array.isArray(value.paylines)
    && value.paylines.every(Array.isArray)
    && Array.isArray(value.baseReelStrips)
    && value.baseReelStrips.every(Array.isArray)
    && isRecord(featureStrips)
    && Array.isArray(featureStrips.alpha)
    && featureStrips.alpha.every(Array.isArray)
    && Array.isArray(featureStrips.bravo)
    && featureStrips.bravo.every(Array.isArray)
    && isRecord(value.paytable)
    && Object.values(value.paytable).every(isRecord)
    && isRecord(bonus)
    && isRecord(bonus.alphaSpinsByScatters)
    && isRecord(bonus.bravoSpinsByScatters)
    && Array.isArray(bonus.bravoMultiplierSteps);
}

export function validateConfig(config: GameConfig): ValidationResult {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (!hasRuntimeConfigShape(config)) {
    issue('MALFORMED_CONFIG', '', 'Configuration must contain the declared symbol, line, reel, paytable, and bonus structures.');
    return { ok: false, issues };
  }


  if (config.schemaVersion !== CONFIG_SCHEMA_VERSION) issue('UNSUPPORTED_SCHEMA', 'schemaVersion', 'Only configuration schema version 1 is supported.');
  if (config.mathVersion !== MATH_VERSION) issue('UNSUPPORTED_MATH', 'mathVersion', 'The math version is not supported.');
  if (config.rngAlgorithm !== RNG_ALGORITHM) issue('UNSUPPORTED_RNG', 'rngAlgorithm', 'The RNG algorithm is not supported.');
  if (config.reels !== 5 || config.rows !== 3) issue('INVALID_LAYOUT', 'reels/rows', 'This math version requires exactly five reels and three rows.');
  if (!Number.isSafeInteger(config.baseWager) || config.baseWager !== 20) issue('INVALID_BASE_WAGER', 'baseWager', 'The base wager must be exactly 20 virtual credits.');
  if (!Number.isSafeInteger(config.maxWager) || config.maxWager < config.baseWager || config.maxWager % config.baseWager !== 0) issue('INVALID_MAX_WAGER', 'maxWager', 'Maximum wager must be an integer multiple of the base wager.');

  const ids = new Set<string>();
  for (const [index, symbol] of config.symbols.entries()) {
    if (!symbol.id || ids.has(symbol.id)) issue('INVALID_SYMBOL_ID', `symbols[${index}].id`, 'Symbol IDs must be nonempty and unique.');
    ids.add(symbol.id);
  }
  const regulars = config.symbols.filter((symbol) => symbol.role === 'regular');
  const wilds = config.symbols.filter((symbol) => symbol.role === 'wild');
  const scatters = config.symbols.filter((symbol) => symbol.role === 'scatter');
  if (regulars.length !== 9) issue('INVALID_REGULAR_COUNT', 'symbols', 'Exactly nine regular symbols are required.');
  if (wilds.length !== 1 || wilds[0]?.id !== config.wildSymbolId) issue('INVALID_WILD', 'wildSymbolId', 'Exactly one declared WILD symbol is required.');
  if (scatters.length !== 1 || scatters[0]?.id !== config.scatterSymbolId) issue('INVALID_SCATTER', 'scatterSymbolId', 'Exactly one declared CORE scatter symbol is required.');
  if (config.wildSymbolId === config.scatterSymbolId) issue('ROLE_CONFLICT', 'wildSymbolId', 'Wild and scatter roles cannot share an ID.');

  if (config.paylines.length !== 20) issue('INVALID_PAYLINE_COUNT', 'paylines', 'Exactly 20 paylines are required.');
  const lineKeys = new Set<string>();
  config.paylines.forEach((line, index) => {
    if (line.length !== config.reels || line.some((row) => !Number.isInteger(row) || row < 0 || row >= config.rows)) {
      issue('INVALID_PAYLINE', `paylines[${index}]`, 'Each payline needs one in-range row for every reel.');
    }
    const key = line.join(',');
    if (lineKeys.has(key)) issue('DUPLICATE_PAYLINE', `paylines[${index}]`, 'Paylines must be unique.');
    lineKeys.add(key);
  });

  const validateStrips = (strips: readonly (readonly string[])[], path: string) => {
    if (strips.length !== config.reels) issue('INVALID_REEL_COUNT', path, 'Exactly five reel strips are required.');
    strips.forEach((strip, reel) => {
      if (strip.length === 0) issue('EMPTY_REEL', `${path}[${reel}]`, 'Reel strips cannot be empty.');
      strip.forEach((symbolId, position) => {
        if (!ids.has(symbolId)) issue('UNKNOWN_SYMBOL', `${path}[${reel}][${position}]`, `Unknown symbol ${symbolId}.`);
      });
    });
  };
  validateStrips(config.baseReelStrips, 'baseReelStrips');
  validateStrips(config.bonusReelStrips.alpha, 'bonusReelStrips.alpha');
  validateStrips(config.bonusReelStrips.bravo, 'bonusReelStrips.bravo');
  config.baseReelStrips.forEach((strip, reel) => {
    for (let stop = 0; stop < strip.length; stop += 1) {
      let visibleScatters = 0;
      for (let row = 0; row < config.rows; row += 1) {
        if (strip[(stop + row) % strip.length] === config.scatterSymbolId) visibleScatters += 1;
      }
      if (visibleScatters > 1) {
        issue('AMBIGUOUS_BASE_SCATTERS', `baseReelStrips[${reel}]`, 'A base reel window may contain at most one CORE.');
        break;
      }
    }
  });

  const paytableIds = Object.keys(config.paytable);
  if (paytableIds.length !== regulars.length || regulars.some((symbol) => !(symbol.id in config.paytable))) {
    issue('INCOMPLETE_PAYTABLE', 'paytable', 'Every regular symbol, and only regular symbols, must have a paytable entry.');
  }
  for (const [symbolId, entry] of Object.entries(config.paytable)) {
    if (!ids.has(symbolId) || symbolId === config.wildSymbolId || symbolId === config.scatterSymbolId) issue('INVALID_PAYTABLE_SYMBOL', `paytable.${symbolId}`, 'Only regular symbols may appear in the paytable.');
    for (const count of [3, 4, 5] as const) {
      const award = entry[count];
      if (!Number.isSafeInteger(award) || award < 0) issue('INVALID_AWARD', `paytable.${symbolId}.${count}`, 'Awards must be non-negative safe integers.');
    }
    if (!(entry[3] <= entry[4] && entry[4] <= entry[5])) issue('NON_MONOTONIC_AWARD', `paytable.${symbolId}`, 'Awards must not decrease as the match length grows.');
  }

  const bonus = config.bonus;
  if (bonus.triggerScatters !== 3 || bonus.retriggerScatters !== 3) issue('INVALID_TRIGGER', 'bonus', 'This math version requires three CORE symbols to trigger and retrigger.');
  const expectedAlpha = [10, 13, 16];
  const expectedBravo = [6, 8, 10];
  ([3, 4, 5] as const).forEach((count, index) => {
    if (bonus.alphaSpinsByScatters[count] !== expectedAlpha[index]) issue('INVALID_ALPHA_AWARD', `bonus.alphaSpinsByScatters.${count}`, 'Alpha awards must be 10/13/16.');
    if (bonus.bravoSpinsByScatters[count] !== expectedBravo[index]) issue('INVALID_BRAVO_AWARD', `bonus.bravoSpinsByScatters.${count}`, 'Bravo awards must be 6/8/10.');
  });
  if (bonus.retriggerSpins !== 4) issue('INVALID_RETRIGGER_AWARD', 'bonus.retriggerSpins', 'Retriggers must award four spins.');
  if (!Number.isSafeInteger(bonus.maxAwardedSpins) || bonus.maxAwardedSpins !== 30) issue('INVALID_BONUS_CAP', 'bonus.maxAwardedSpins', 'Total awarded feature spins must be capped at 30.');
  if (bonus.alphaChargesPerSecuredReel !== 3) issue('INVALID_ALPHA_CHARGES', 'bonus.alphaChargesPerSecuredReel', 'Alpha requires exactly three charges per secured reel.');
  if (bonus.bravoMultiplierSteps.length !== 4 || bonus.bravoMultiplierSteps.some((value, index) => value !== [1, 2, 3, 5][index])) issue('INVALID_BRAVO_MULTIPLIERS', 'bonus.bravoMultiplierSteps', 'Bravo multiplier steps must be 1x, 2x, 3x, 5x.');
  if (!Number.isSafeInteger(bonus.bravoMaxShields) || bonus.bravoMaxShields < 1) issue('INVALID_BRAVO_SHIELDS', 'bonus.bravoMaxShields', 'Bravo requires a positive finite shield cap.');

  const maxAward = Math.max(0, ...Object.values(config.paytable).flatMap((entry) => [entry[3], entry[4], entry[5]]));
  const maxLineBet = config.maxWager / config.paylines.length;
  const maxMultiplier = Math.max(...bonus.bravoMultiplierSteps);
  const boundedAttribution = maxAward * maxLineBet * config.paylines.length * maxMultiplier * (1 + bonus.maxAwardedSpins);
  if (!Number.isSafeInteger(boundedAttribution)) {
    issue('PAYOUT_OVERFLOW', 'paytable', 'The bounded base-plus-feature payout attribution is not a safe integer.');
  }

  return issues.length === 0 ? { ok: true, configHash: hashConfig(config) } : { ok: false, issues };
}

export function assertValidConfig(config: GameConfig): string {
  const result = validateConfig(config);
  if (!result.ok) {
    const error = Object.assign(new Error(result.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n')), { issues: result.issues });
    error.name = 'ConfigurationValidationError';
    throw error;
  }
  return result.configHash;
}

export function assertValidWager(config: GameConfig, wager: number): number {
  if (!Number.isSafeInteger(wager) || wager < config.baseWager || wager > config.maxWager || wager % config.baseWager !== 0) {
    throw new Error(`Wager must be an integer multiple of ${config.baseWager} between ${config.baseWager} and ${config.maxWager}.`);
  }
  return wager / config.paylines.length;
}

