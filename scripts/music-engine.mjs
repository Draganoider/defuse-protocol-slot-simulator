/**
 * Deterministic music synthesis for Defuse Protocol.
 *
 * Everything here is generated from source: band-limited oscillators, a state-variable
 * filter, envelopes, noise percussion, a feedback delay, and a Schroeder reverb. There are
 * no recordings, samples, soundfonts, or third-party creative inputs, and a given seed
 * always renders identical bytes.
 *
 * Loop seams are handled by rendering each track longer than its loop and folding the
 * overflow back over the start, so filter, delay, and reverb tails continue across the
 * loop point instead of being cut off. Sustained tones that run the full loop are locked
 * to a whole number of cycles per loop for the same reason.
 */

export const SAMPLE_RATE = 44_100;
const TAU = Math.PI * 2;
/** Rendered past the loop end so reverb and delay tails can wrap onto the start. */
const TAIL_SECONDS = 2.4;

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function midiHz(midi) {
  return 440 * (2 ** ((midi - 69) / 12));
}

/** Rounds a sustained frequency to a whole number of cycles per loop. */
function lockToLoop(frequency, loopSeconds) {
  return Math.max(1, Math.round(frequency * loopSeconds)) / loopSeconds;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function softClip(value, drive) {
  return Math.tanh(value * drive) / Math.tanh(drive);
}

// --- Oscillators -----------------------------------------------------------------
// PolyBLEP removes the aliasing that a naive saw or pulse would fold back into the
// audible range, which is what makes a raw digital oscillator sound harsh and cheap.

function polyBlep(phase, increment) {
  if (phase < increment) {
    const t = phase / increment;
    return (t + t) - (t * t) - 1;
  }
  if (phase > 1 - increment) {
    const t = (phase - 1) / increment;
    return (t * t) + t + t + 1;
  }
  return 0;
}

function sawSample(phase, increment) {
  return (2 * phase) - 1 - polyBlep(phase, increment);
}

function pulseSample(phase, increment, width) {
  const value = phase < width ? 1 : -1;
  return value + polyBlep(phase, increment) - polyBlep((phase + 1 - width) % 1, increment);
}

function oscillator(wave, phase, increment) {
  if (wave === 'saw') return sawSample(phase, increment);
  if (wave === 'pulse') return pulseSample(phase, increment, 0.34);
  if (wave === 'square') return pulseSample(phase, increment, 0.5);
  if (wave === 'triangle') return 1 - (4 * Math.abs((phase % 1) - 0.5));
  return Math.sin(TAU * phase);
}

// --- Filter ----------------------------------------------------------------------

/** Topology-preserving state-variable filter; stable across fast cutoff modulation. */
function createFilter() {
  let ic1 = 0;
  let ic2 = 0;
  return {
    bandpass: 0,
    highpass: 0,
    lowpass(input, cutoffHz, q) {
      const g = Math.tan(Math.PI * clamp(cutoffHz, 20, SAMPLE_RATE * 0.45) / SAMPLE_RATE);
      const k = 1 / clamp(q, 0.5, 12);
      const a1 = 1 / (1 + g * (g + k));
      const a2 = g * a1;
      const a3 = g * a2;
      const v3 = input - ic2;
      const v1 = (a1 * ic1) + (a2 * v3);
      const v2 = ic2 + (a2 * ic1) + (a3 * v3);
      ic1 = (2 * v1) - ic1;
      ic2 = (2 * v2) - ic2;
      this.bandpass = v1;
      this.highpass = input - (k * v1) - v2;
      return v2;
    },
  };
}

// --- Time-based effects ----------------------------------------------------------

function createDelay(maxSamples) {
  const buffer = new Float64Array(maxSamples);
  let writeIndex = 0;
  return (input, delaySamples, feedback) => {
    const offset = clamp(Math.round(delaySamples), 1, maxSamples - 1);
    const readIndex = (writeIndex - offset + maxSamples) % maxSamples;
    const output = buffer[readIndex];
    buffer[writeIndex] = input + (output * feedback);
    writeIndex = (writeIndex + 1) % maxSamples;
    return output;
  };
}

const COMB_DELAYS = [1_116, 1_188, 1_277, 1_356];
const ALLPASS_DELAYS = [556, 441];

/** Schroeder reverb: four damped comb filters into two allpass diffusers. */
function createReverb(spread, damping, roomSize) {
  const combs = COMB_DELAYS.map((length) => ({
    buffer: new Float64Array(length + spread),
    index: 0,
    store: 0,
  }));
  const allpasses = ALLPASS_DELAYS.map((length) => ({
    buffer: new Float64Array(length + spread),
    index: 0,
  }));
  return (input) => {
    let output = 0;
    for (const comb of combs) {
      const value = comb.buffer[comb.index];
      comb.store = (value * (1 - damping)) + (comb.store * damping);
      comb.buffer[comb.index] = input + (comb.store * roomSize);
      comb.index = (comb.index + 1) % comb.buffer.length;
      output += value;
    }
    output *= 0.25;
    for (const allpass of allpasses) {
      const value = allpass.buffer[allpass.index];
      allpass.buffer[allpass.index] = output + (value * 0.5);
      allpass.index = (allpass.index + 1) % allpass.buffer.length;
      output = value - output;
    }
    return output;
  };
}

// --- Voice rendering -------------------------------------------------------------

/**
 * Renders one monophonic synth line. Oscillator phase and filter state run continuously
 * across the whole buffer, so a line keeps its character instead of restarting per note.
 */
function renderVoice(totalSamples, notes, voice) {
  const output = new Float64Array(totalSamples);
  const filter = createFilter();
  const detune = 2 ** ((voice.detuneCents ?? 0) / 1_200);
  const attack = Math.max(1, (voice.attack ?? 0.005) * SAMPLE_RATE);
  const decay = Math.max(1, (voice.decay ?? 0.12) * SAMPLE_RATE);
  const release = Math.max(1, (voice.release ?? 0.08) * SAMPLE_RATE);
  const sustain = voice.sustain ?? 0.6;
  let phase = voice.phase ?? 0;
  let noteIndex = 0;
  let active;

  for (let index = 0; index < totalSamples; index += 1) {
    while (noteIndex < notes.length && notes[noteIndex].start <= index) {
      active = notes[noteIndex];
      phase = 0;
      noteIndex += 1;
    }
    if (!active) continue;

    const age = index - active.start;
    const gate = active.length;
    let envelope;
    if (age < attack) envelope = age / attack;
    else if (age < attack + decay) envelope = 1 - ((1 - sustain) * ((age - attack) / decay));
    else if (age < gate) envelope = sustain;
    else {
      const releaseAge = age - gate;
      if (releaseAge >= release) continue;
      envelope = sustain * (1 - (releaseAge / release));
    }
    envelope *= active.velocity ?? 1;

    const frequency = midiHz(active.midi) * detune;
    const increment = frequency / SAMPLE_RATE;
    phase += increment;
    if (phase >= 1) phase -= 1;

    const raw = oscillator(voice.wave, phase, increment);
    const filterEnvelope = age < attack + decay
      ? 1 - (age / (attack + decay))
      : 0;
    const lfo = voice.lfoHz
      ? Math.sin(TAU * voice.lfoHz * (index / SAMPLE_RATE)) * (voice.lfoAmount ?? 0)
      : 0;
    const cutoff = (voice.cutoff ?? 900)
      * (1 + (filterEnvelope * (voice.filterEnvAmount ?? 0)))
      * (1 + lfo)
      * (voice.keyTrack ? frequency / 220 : 1);
    output[index] = filter.lowpass(raw, cutoff, voice.resonance ?? 1.1) * envelope * (voice.gain ?? 0.2);
  }
  return output;
}

// --- Percussion ------------------------------------------------------------------

function addKick(buffer, startSample, gain, pitchFrom, pitchTo, lengthSeconds) {
  const length = Math.floor(lengthSeconds * SAMPLE_RATE);
  let phase = 0;
  for (let index = 0; index < length; index += 1) {
    const target = startSample + index;
    if (target >= buffer.length) return;
    const progress = index / length;
    const frequency = pitchTo + ((pitchFrom - pitchTo) * ((1 - progress) ** 3));
    phase += frequency / SAMPLE_RATE;
    const envelope = (1 - progress) ** 2.2;
    const click = index < 90 ? (1 - (index / 90)) ** 3 * 0.35 : 0;
    buffer[target] += ((Math.sin(TAU * phase) * envelope) + click) * gain;
  }
}

function addNoiseHit(buffer, startSample, gain, cutoffHz, resonance, lengthSeconds, random) {
  const length = Math.floor(lengthSeconds * SAMPLE_RATE);
  const filter = createFilter();
  for (let index = 0; index < length; index += 1) {
    const target = startSample + index;
    if (target >= buffer.length) return;
    const progress = index / length;
    const noise = (random() * 2) - 1;
    const swept = cutoffHz * (1 - (progress * 0.55));
    filter.lowpass(noise, swept, resonance);
    const envelope = (1 - progress) ** 2.6;
    buffer[target] += filter.bandpass * envelope * gain;
  }
}

function addMetallic(buffer, startSample, gain, baseHz, lengthSeconds) {
  const length = Math.floor(lengthSeconds * SAMPLE_RATE);
  // Inharmonic partials read as struck metal rather than a tuned instrument.
  const partials = [1, 2.37, 3.41, 4.83, 6.19];
  for (let index = 0; index < length; index += 1) {
    const target = startSample + index;
    if (target >= buffer.length) return;
    const time = index / SAMPLE_RATE;
    let value = 0;
    for (let partial = 0; partial < partials.length; partial += 1) {
      value += Math.sin(TAU * baseHz * partials[partial] * time)
        * Math.exp(-time * (7 + (partial * 5)))
        / (partial + 1.6);
    }
    buffer[target] += value * gain;
  }
}

// --- Loop-safe post processing ---------------------------------------------------

/**
 * One-pole high pass applied to an already loop-continuous buffer. The filter is warmed
 * up on the buffer tail first so its state at sample zero matches the state it would
 * have arrived at by wrapping around, which keeps the loop point clean.
 */
function highPassLoop(buffer, cutoffHz) {
  const coefficient = 1 / (1 + (TAU * cutoffHz / SAMPLE_RATE));
  const warmup = Math.min(buffer.length, Math.round(SAMPLE_RATE * 0.25));
  let previousInput = buffer[buffer.length - warmup];
  let previousOutput = 0;
  for (let index = buffer.length - warmup; index < buffer.length; index += 1) {
    previousOutput = coefficient * (previousOutput + buffer[index] - previousInput);
    previousInput = buffer[index];
  }
  for (let index = 0; index < buffer.length; index += 1) {
    const input = buffer[index];
    previousOutput = coefficient * (previousOutput + input - previousInput);
    previousInput = input;
    buffer[index] = previousOutput;
  }
}

function normalizeStereo(left, right, targetPeak) {
  let peak = 0;
  for (let index = 0; index < left.length; index += 1) {
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  }
  if (peak <= 0) return;
  const scale = targetPeak / peak;
  for (let index = 0; index < left.length; index += 1) {
    left[index] *= scale;
    right[index] *= scale;
  }
}

// --- Track definitions -----------------------------------------------------------

const A_MINOR_BASE = [
  { bass: 45, pad: [57, 60, 64] },
  { bass: 45, pad: [57, 60, 64] },
  { bass: 41, pad: [57, 60, 65] },
  { bass: 41, pad: [57, 60, 65] },
  { bass: 45, pad: [57, 60, 64] },
  { bass: 45, pad: [57, 60, 64] },
  { bass: 38, pad: [57, 62, 65] },
  { bass: 40, pad: [56, 59, 64] },
];

const A_MINOR_ALPHA = [
  { bass: 45, pad: [57, 60, 64] },
  { bass: 45, pad: [57, 60, 64] },
  { bass: 41, pad: [57, 60, 65] },
  { bass: 43, pad: [55, 59, 62] },
  { bass: 45, pad: [57, 60, 64] },
  { bass: 38, pad: [57, 62, 65] },
  { bass: 41, pad: [57, 60, 65] },
  { bass: 40, pad: [56, 59, 64] },
];

const D_MINOR_BRAVO = [
  { bass: 38, pad: [57, 62, 65] },
  { bass: 38, pad: [57, 62, 65] },
  { bass: 34, pad: [58, 62, 65] },
  { bass: 36, pad: [55, 60, 64] },
  { bass: 38, pad: [57, 62, 65] },
  { bass: 43, pad: [58, 62, 67] },
  { bass: 34, pad: [58, 62, 65] },
  { bass: 33, pad: [57, 61, 64] },
  { bass: 38, pad: [57, 62, 65] },
  { bass: 39, pad: [58, 63, 67] },
  { bass: 34, pad: [58, 62, 65] },
  { bass: 33, pad: [57, 61, 64] },
];

export const MUSIC_TRACKS = {
  base: { bpm: 72, bars: 8, chords: A_MINOR_BASE, seed: 0x50454c41 },
  alpha: { bpm: 84, bars: 8, chords: A_MINOR_ALPHA, seed: 0x4d414c50 },
  bravo: { bpm: 104, bars: 12, chords: D_MINOR_BRAVO, seed: 0x4d425241 },
};

export function trackDuration(name) {
  const track = MUSIC_TRACKS[name];
  return Number(((track.bars * 4 * 60) / track.bpm).toFixed(6));
}

/** Periodic wind and machine-room bed built from whole-loop sinusoids so it always loops. */
function renderRoomTone(loopSamples, totalSamples, loopSeconds, random, strength) {
  const left = new Float64Array(totalSamples);
  const right = new Float64Array(totalSamples);
  const components = Array.from({ length: 44 }, (_, index) => ({
    cycles: 2 + index + Math.floor(random() * 30),
    amplitude: (0.011 + (random() * 0.022)) / Math.sqrt(1 + (index * 0.2)),
    phase: random() * TAU,
    pan: (random() * 2) - 1,
  }));
  const hum = lockToLoop(50, loopSeconds);
  for (let index = 0; index < totalSamples; index += 1) {
    const loopPhase = (index % loopSamples) / loopSamples;
    const time = index / SAMPLE_RATE;
    const shape = 0.6 + (0.2 * Math.sin((TAU * loopPhase * 2) - 0.4)) + (0.11 * Math.sin((TAU * loopPhase * 5) + 1.2));
    let leftValue = (Math.sin(TAU * hum * time) * 0.03) + (Math.sin((TAU * hum * 2 * time) + 0.4) * 0.01);
    let rightValue = (Math.sin((TAU * hum * time) + 0.025) * 0.028) + (Math.sin((TAU * hum * 2 * time) + 0.48) * 0.009);
    for (const component of components) {
      const value = Math.sin((TAU * component.cycles * loopPhase) + component.phase) * component.amplitude * shape;
      leftValue += value * (1 - (component.pan * 0.3));
      rightValue += value * (1 + (component.pan * 0.3));
    }
    left[index] = leftValue * strength;
    right[index] = rightValue * strength;
  }
  return [left, right];
}

function buildNotes(track, loopSamples, secondsPerBeat) {
  const beatSamples = secondsPerBeat * SAMPLE_RATE;
  const barSamples = beatSamples * 4;
  const bass = [];
  const padVoices = [[], [], []];
  const lead = [];

  track.chords.forEach((chord, bar) => {
    const barStart = Math.round(bar * barSamples);
    const half = bar >= track.chords.length / 2;

    chord.pad.forEach((midi, voice) => {
      padVoices[voice].push({
        start: barStart,
        length: Math.round(barSamples * 0.98),
        midi: midi - 12,
        velocity: 1,
      });
    });

    if (track.name === 'base') {
      bass.push({ start: barStart, length: Math.round(barSamples * 0.9), midi: chord.bass - 12, velocity: 1 });
    } else if (track.name === 'alpha') {
      for (const beat of [0, 2, 3.5]) {
        bass.push({
          start: barStart + Math.round(beat * beatSamples),
          length: Math.round(beatSamples * (beat === 3.5 ? 0.4 : 0.85)),
          midi: chord.bass,
          velocity: beat === 3.5 ? 0.7 : 1,
        });
      }
    } else {
      for (let step = 0; step < 8; step += 1) {
        if (step === 5) continue;
        bass.push({
          start: barStart + Math.round(step * beatSamples * 0.5),
          length: Math.round(beatSamples * 0.34),
          midi: chord.bass + (step === 6 ? 12 : 0),
          velocity: step % 2 === 0 ? 1 : 0.72,
        });
      }
    }

    if (track.name === 'base') return;
    // The lead walks the chord tones so the sequence follows the harmony instead of
    // repeating one fixed pattern, and lifts an octave in the second half of the loop.
    const steps = track.name === 'alpha' ? 8 : 16;
    const stepSamples = barSamples / steps;
    const shape = track.name === 'alpha' ? [0, 1, 2, 1, 3, 2, 1, 0] : [0, 2, 1, 3, 0, 2, 4, 1, 0, 3, 1, 2, 0, 4, 2, 1];
    const tones = [...chord.pad, chord.pad[0] + 12, chord.pad[1] + 12];
    for (let step = 0; step < steps; step += 1) {
      if (track.name === 'bravo' && step % 8 === 7) continue;
      lead.push({
        start: barStart + Math.round(step * stepSamples),
        length: Math.round(stepSamples * 0.62),
        midi: tones[shape[step % shape.length] % tones.length] + (half ? 12 : 0),
        velocity: step % 4 === 0 ? 1 : 0.68,
      });
    }
  });

  const inLoop = (note) => note.start < loopSamples;
  return {
    bass: bass.filter(inLoop),
    padVoices: padVoices.map((voice) => voice.filter(inLoop)),
    lead: lead.filter(inLoop),
  };
}

function buildPercussion(track, buffer, loopSamples, secondsPerBeat, random) {
  const beatSamples = secondsPerBeat * SAMPLE_RATE;
  const barSamples = beatSamples * 4;
  for (let bar = 0; bar < track.bars; bar += 1) {
    const barStart = Math.round(bar * barSamples);
    const half = bar >= track.bars / 2;

    if (track.name === 'base') {
      addKick(buffer, barStart, 0.2, 78, 44, 0.34);
      if (bar % 2 === 1) addMetallic(buffer, barStart + Math.round(beatSamples * 2.5), 0.035, 1_180, 0.5);
      if (bar % 4 === 2) addNoiseHit(buffer, barStart + Math.round(beatSamples * 3), 0.06, 1_600, 0.9, 0.6, random);
      continue;
    }

    const kickBeats = track.name === 'alpha' ? [0, 2] : [0, 1, 2, 3];
    for (const beat of kickBeats) {
      addKick(buffer, barStart + Math.round(beat * beatSamples), track.name === 'alpha' ? 0.34 : 0.4, 96, 46, 0.3);
    }
    for (const beat of [1, 3]) {
      addNoiseHit(buffer, barStart + Math.round(beat * beatSamples), track.name === 'alpha' ? 0.2 : 0.26, 2_600, 2.4, 0.22, random);
    }
    const tickSteps = track.name === 'alpha' ? 8 : 16;
    for (let step = 0; step < tickSteps; step += 1) {
      if (step % 2 === 0 && track.name === 'bravo') continue;
      addNoiseHit(
        buffer,
        barStart + Math.round((step * barSamples) / tickSteps),
        (step % 4 === 0 ? 0.07 : 0.045) * (half ? 1.18 : 1),
        7_400,
        1.6,
        0.045,
        random,
      );
    }
    if (bar % 4 === 3) {
      addMetallic(buffer, barStart + Math.round(beatSamples * 3.5), track.name === 'alpha' ? 0.07 : 0.1, 940, 0.6);
    }
  }
}

/**
 * Renders one loop as a stereo pair. The caller receives exactly `loopSamples` frames with
 * every effect tail already wrapped over the start.
 */
export function renderMusicTrack(name) {
  const track = { ...MUSIC_TRACKS[name], name, bars: MUSIC_TRACKS[name].bars };
  const loopSeconds = trackDuration(name);
  const secondsPerBeat = 60 / track.bpm;
  const loopSamples = Math.round(loopSeconds * SAMPLE_RATE);
  const totalSamples = loopSamples + Math.round(TAIL_SECONDS * SAMPLE_RATE);
  const random = seededRandom(track.seed);

  const { bass, padVoices, lead } = buildNotes(track, loopSamples, secondsPerBeat);
  const feature = name !== 'base';

  const bassLine = renderVoice(totalSamples, bass, {
    wave: feature ? 'saw' : 'triangle',
    attack: feature ? 0.004 : 0.6,
    decay: feature ? 0.16 : 1.2,
    sustain: feature ? 0.42 : 0.85,
    release: feature ? 0.1 : 1.4,
    cutoff: name === 'bravo' ? 180 : name === 'alpha' ? 220 : 150,
    filterEnvAmount: feature ? 2.6 : 0.4,
    resonance: feature ? 1.5 : 0.9,
    gain: name === 'bravo' ? 0.34 : 0.3,
  });

  const padLayers = [];
  for (const [voiceIndex, notes] of padVoices.entries()) {
    for (const detune of [-7, 7]) {
      padLayers.push(renderVoice(totalSamples, notes, {
        wave: 'saw',
        detuneCents: detune + (voiceIndex * 2),
        phase: 0.13 * (voiceIndex + 1) + (detune > 0 ? 0.37 : 0),
        attack: feature ? 0.25 : 1.4,
        decay: 1.2,
        sustain: 0.8,
        release: feature ? 0.8 : 2.2,
        cutoff: name === 'bravo' ? 520 : name === 'alpha' ? 640 : 430,
        filterEnvAmount: 0.5,
        lfoHz: name === 'bravo' ? 0.21 : 0.13,
        lfoAmount: 0.42,
        resonance: 0.85,
        gain: 0.05,
      }));
    }
  }

  const leadLine = feature ? renderVoice(totalSamples, lead, {
    wave: 'pulse',
    attack: 0.003,
    decay: 0.1,
    sustain: 0.25,
    release: 0.07,
    cutoff: name === 'bravo' ? 900 : 1_150,
    filterEnvAmount: name === 'bravo' ? 3.4 : 2.6,
    lfoHz: name === 'bravo' ? 0.34 : 0.19,
    lfoAmount: 0.3,
    resonance: name === 'bravo' ? 3.6 : 2.8,
    keyTrack: true,
    gain: 0.13,
  }) : new Float64Array(totalSamples);

  const percussion = new Float64Array(totalSamples);
  buildPercussion(track, percussion, loopSamples, secondsPerBeat, random);

  // Dotted-eighth delay on the lead, which is what gives a simple sequence its motion.
  const delaySamples = secondsPerBeat * 0.75 * SAMPLE_RATE;
  const delayLeft = createDelay(Math.ceil(delaySamples) + 8);
  const delayRight = createDelay(Math.ceil(delaySamples * 1.01) + 8);
  const reverbLeft = createReverb(0, 0.34, 0.78);
  const reverbRight = createReverb(23, 0.34, 0.78);

  const wideLeft = new Float64Array(totalSamples);
  const wideRight = new Float64Array(totalSamples);
  for (let index = 0; index < totalSamples; index += 1) {
    let padLeft = 0;
    let padRight = 0;
    for (let layer = 0; layer < padLayers.length; layer += 1) {
      const value = padLayers[layer][index];
      // Alternate layers across the stereo field so the pad is genuinely wide.
      if (layer % 2 === 0) { padLeft += value * 1.15; padRight += value * 0.6; }
      else { padLeft += value * 0.6; padRight += value * 1.15; }
    }

    const leadValue = leadLine[index];
    const echoLeft = delayLeft(leadValue * 0.45, delaySamples, 0.4);
    const echoRight = delayRight(leadValue * 0.45, delaySamples * 1.01, 0.42);

    const dry = bassLine[index] + percussion[index];
    const wetSource = ((padLeft + padRight) * 0.14) + (percussion[index] * 0.16) + (leadValue * 0.12);
    const tailLeft = reverbLeft(wetSource) * (feature ? 0.22 : 0.3);
    const tailRight = reverbRight(wetSource) * (feature ? 0.22 : 0.3);

    wideLeft[index] = dry + padLeft + (leadValue * 0.6) + echoLeft + tailLeft;
    wideRight[index] = dry + padRight + (leadValue * 0.6) + echoRight + tailRight;
  }

  // Fold every effect tail back over the start so the loop point is continuous. Only
  // content that decays is folded; periodic material is added afterwards because it
  // already repeats exactly and would otherwise be summed with itself.
  const left = wideLeft.slice(0, loopSamples);
  const right = wideRight.slice(0, loopSamples);
  for (let index = loopSamples; index < totalSamples; index += 1) {
    const wrapped = index - loopSamples;
    if (wrapped >= loopSamples) break;
    left[wrapped] += wideLeft[index];
    right[wrapped] += wideRight[index];
  }

  const [roomLeft, roomRight] = renderRoomTone(
    loopSamples,
    loopSamples,
    loopSeconds,
    seededRandom(track.seed ^ 0x5f5f5f5f),
    feature ? 0.42 : 1,
  );
  for (let index = 0; index < loopSamples; index += 1) {
    left[index] = softClip(left[index] + roomLeft[index], 1.15);
    right[index] = softClip(right[index] + roomRight[index], 1.15);
  }

  // Remove sub-rumble that only eats headroom and encoder bits.
  highPassLoop(left, 32);
  highPassLoop(right, 32);
  normalizeStereo(left, right, feature ? 0.5 : 0.46);
  return [left, right];
}
