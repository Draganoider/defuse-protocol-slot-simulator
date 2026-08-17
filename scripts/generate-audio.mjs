import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderMusicTrack, SAMPLE_RATE, trackDuration } from './music-engine.mjs';

// Short one-shots keep their transients at q5. The long background loops are filtered,
// mixed under effects, and much denser, so a lower setting saves a lot of download for
// no useful difference in what a player hears.
const SFX_QUALITY = 5;
const MUSIC_QUALITY = 3;

const OUTPUT_DIR = resolve('src/assets/audio');
const CREATED_ON = '2026-08-16';
const CREATOR = 'Yevhen Mishchenko';
const TAU = Math.PI * 2;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function clamp(value, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothStep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function envelope(time, attack, hold, release) {
  if (time < 0 || time >= attack + hold + release) return 0;
  if (time < attack) return smoothStep(0, attack, time);
  if (time < attack + hold) return 1;
  return 1 - smoothStep(attack + hold, attack + hold + release, time);
}

function dampedSine(time, start, frequency, decay, amplitude, phase = 0) {
  if (time < start) return 0;
  const local = time - start;
  return Math.sin(TAU * frequency * local + phase) * Math.exp(-local * decay) * amplitude;
}

function chirp(time, start, duration, fromHz, toHz, amplitude) {
  const local = time - start;
  if (local < 0 || local >= duration) return 0;
  const slope = (toHz - fromHz) / duration;
  const phase = TAU * (fromHz * local + 0.5 * slope * local * local);
  return Math.sin(phase) * envelope(local, 0.018, duration * 0.55, duration * 0.432) * amplitude;
}

function normalize(channels, targetPeak = 0.68) {
  let peak = 0;
  for (const channel of channels) {
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }
  const scale = peak > 0 ? targetPeak / peak : 1;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) channel[index] = clamp(channel[index] * scale);
  }
  return targetPeak;
}

function fadeEdges(channels, fadeSeconds = 0.008) {
  const fadeSamples = Math.max(1, Math.floor(fadeSeconds * SAMPLE_RATE));
  for (const channel of channels) {
    for (let index = 0; index < fadeSamples; index += 1) {
      const gain = smoothStep(0, fadeSamples, index);
      channel[index] *= gain;
      channel[channel.length - 1 - index] *= gain;
    }
  }
}

function renderMono(duration, _seed, synth) {
  const length = Math.floor(duration * SAMPLE_RATE);
  const channel = new Float64Array(length);
  for (let index = 0; index < length; index += 1) {
    channel[index] = synth(index / SAMPLE_RATE, index);
  }
  fadeEdges([channel]);
  normalize([channel]);
  return [channel];
}

function writeWav(channels) {
  const channelCount = channels.length;
  const sampleCount = channels[0].length;
  const bytesPerSample = 2;
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let index = 0; index < sampleCount; index += 1) {
    for (const channel of channels) {
      const sample = Math.round(clamp(channel[index]) * 32_767);
      buffer.writeInt16LE(sample, offset);
      offset += bytesPerSample;
    }
  }
  return buffer;
}

const definitions = [
  {
    id: 'ambience-pelagos-relay-loop-01', duration: trackDuration('base'), seed: 0x50454c41, stereo: true,
    description: 'Seamless base-operation bed in A minor: relay room tone, slow filtered pad, sub pulse, and sparse machinery.',
    render: () => renderMusicTrack('base'), quality: MUSIC_QUALITY,
  },
  {
    id: 'music-relay-alpha-loop-01', duration: trackDuration('alpha'), seed: 0x4d414c50, stereo: true,
    description: 'Seamless Relay Alpha loop at 84 BPM in A minor: driven bass, filtered pad, delayed pulse sequence, and restrained industrial percussion.',
    render: () => renderMusicTrack('alpha'), quality: MUSIC_QUALITY,
  },
  {
    id: 'music-relay-bravo-loop-01', duration: trackDuration('bravo'), seed: 0x4d425241, stereo: true,
    description: 'Seamless Relay Bravo loop at 104 BPM in D minor: pumping bass, darker pad, sixteenth-note sequence, and insistent percussion.',
    render: () => renderMusicTrack('bravo'), quality: MUSIC_QUALITY,
  },
  {
    id: 'sfx-spin-drive-01', duration: 0.72, seed: 0x5350494e,
    description: 'Noise-free mechanical reel assembly with lever detent and dry roller contacts.',
    render: (duration, seed) => renderMono(duration, seed, (t) => {
      const leverDetent = dampedSine(t, 0.008, 76, 22, 0.68)
        + dampedSine(t, 0.009, 318, 35, 0.23)
        + dampedSine(t, 0.011, 1_080, 58, 0.07);
      const rollerContacts = [0.085, 0.16, 0.235, 0.31, 0.385, 0.46].reduce((sum, start, index) => (
        sum
        + dampedSine(t, start, 61 + (index % 3) * 7, 27, 0.12 - index * 0.008)
        + dampedSine(t, start + 0.002, 248 + (index % 2) * 39, 46, 0.035)
      ), 0);
      const weightTransfer = [0.135, 0.305, 0.475].reduce((sum, start, index) => (
        sum + dampedSine(t, start, 46 + index * 6, 18, 0.11 - index * 0.018)
      ), 0);
      const release = dampedSine(t, 0.575, 102, 25, 0.24)
        + dampedSine(t, 0.578, 610, 42, 0.065);
      return leverDetent + rollerContacts + weightTransfer + release;
    }),
  },
  ...Array.from({ length: 5 }, (_, variant) => ({
    id: `sfx-reel-latch-0${variant + 1}`, duration: 0.24, seed: 0x4c415443 + variant * 97,
    description: `Reel ${variant + 1} magnetic latch with a distinct resonant pitch.`,
    render: (duration, seed) => renderMono(duration, seed, (t) => {
      const base = 132 + variant * 17;
      return dampedSine(t, 0.006, base, 24, 0.62)
        + dampedSine(t, 0.006, base * 3.12, 35, 0.25)
        + dampedSine(t, 0.009, 1_420 + variant * 83, 52, 0.12)
        + dampedSine(t, 0.004, 2_160 + variant * 91, 78, 0.045);
    }),
  })),
  {
    id: 'sfx-payline-trace-01', duration: 0.62, seed: 0x4c494e45,
    description: 'Brass relay trace for an evaluated winning payline.',
    render: (duration, seed) => renderMono(duration, seed, (t) => (
      chirp(t, 0.025, 0.5, 370, 780, 0.46)
      + dampedSine(t, 0.34, 1_160, 10, 0.15)
      + [0.08, 0.2, 0.32].reduce((sum, start, index) => sum + dampedSine(t, start, 210 + index * 38, 32, 0.055), 0)
    )),
  },
  {
    id: 'sfx-win-small-01', duration: 0.92, seed: 0x57494e31,
    description: 'Three-contact restrained small-win confirmation.',
    render: (duration, seed) => renderMono(duration, seed, (t) => [392, 494, 587].reduce((sum, frequency, index) => (
      sum + dampedSine(t, 0.08 + index * 0.105, frequency, 3.7, 0.24) + dampedSine(t, 0.08 + index * 0.105, frequency * 2.01, 7.5, 0.07)
    ), 0)),
  },
  {
    id: 'sfx-win-medium-01', duration: 1.34, seed: 0x57494e32,
    description: 'Layered brass-and-relay medium-win confirmation.',
    render: (duration, seed) => renderMono(duration, seed, (t) => [294, 392, 494, 659].reduce((sum, frequency, index) => (
      sum + dampedSine(t, 0.07 + index * 0.12, frequency, 2.7, 0.25) + dampedSine(t, 0.07 + index * 0.12, frequency * 2.4, 6.2, 0.055)
    ), 0)),
  },
  {
    id: 'sfx-win-large-01', duration: 1.95, seed: 0x57494e33,
    description: 'Broad industrial harmonic rise for a high virtual-credit return.',
    render: (duration, seed) => renderMono(duration, seed, (t) => [196, 294, 392, 494, 659, 784].reduce((sum, frequency, index) => (
      sum + dampedSine(t, 0.06 + index * 0.13, frequency, 1.75, 0.22) + dampedSine(t, 0.06 + index * 0.13, frequency * 2.02, 4.8, 0.06)
    ), chirp(t, 0, 1.35, 62, 118, 0.22))),
  },
  {
    id: 'sfx-win-big-01', duration: 2.5, seed: 0x57494e34,
    description: 'Extended brass relay rise for a committed ten-times-or-higher return.',
    render: (duration, seed) => renderMono(duration, seed, (t) => (
      [147, 220, 294, 392, 494, 659, 784].reduce((sum, frequency, index) => (
        sum + dampedSine(t, 0.06 + index * 0.16, frequency, 1.35, 0.2)
        + dampedSine(t, 0.065 + index * 0.16, frequency * 2.01, 4.2, 0.05)
      ), chirp(t, 0.02, 1.8, 55, 132, 0.2))
    )),
  },
  {
    id: 'sfx-win-major-01', duration: 3.15, seed: 0x57494e35,
    description: 'Broad grounded harmonic recovery sequence for a committed major return.',
    render: (duration, seed) => renderMono(duration, seed, (t) => (
      [110, 165, 220, 294, 392, 494, 659, 784, 988].reduce((sum, frequency, index) => (
        sum + dampedSine(t, 0.05 + index * 0.18, frequency, 1.05, 0.185)
        + dampedSine(t, 0.058 + index * 0.18, frequency * 1.5, 3.8, 0.045)
      ), chirp(t, 0.02, 2.35, 46, 147, 0.24) + dampedSine(t, 1.86, 73, 1.5, 0.24))
    )),
  },
  {
    id: 'sfx-core-activation-01', duration: 1.42, seed: 0x434f5245,
    description: 'Signal Core charge-up and containment lock.',
    render: (duration, seed) => renderMono(duration, seed, (t) => (
      chirp(t, 0.02, 1.05, 86, 208, 0.34)
      + [0.23, 0.46, 0.69].reduce((sum, start, index) => sum + dampedSine(t, start, 520 + index * 130, 10, 0.17), 0)
      + dampedSine(t, 0.94, 132, 5, 0.34)
      + dampedSine(t, 0.955, 780, 14, 0.08)
    )),
  },
  {
    id: 'sfx-relay-alpha-01', duration: 1.52, seed: 0x414c5048,
    description: 'Clean three-stage Relay Alpha containment identity.',
    render: (duration, seed) => renderMono(duration, seed, (t) => (
      [349, 440, 587].reduce((sum, frequency, index) => sum + dampedSine(t, 0.12 + index * 0.22, frequency, 2.25, 0.3), 0)
      + chirp(t, 0.12, 0.92, 118, 236, 0.15)
      + dampedSine(t, 0.86, 880, 5.4, 0.16)
    )),
  },
  {
    id: 'sfx-relay-bravo-01', duration: 1.52, seed: 0x42524156,
    description: 'Low mechanical Relay Bravo recovery identity.',
    render: (duration, seed) => renderMono(duration, seed, (t) => (
      [147, 220, 294].reduce((sum, frequency, index) => sum + dampedSine(t, 0.08 + index * 0.19, frequency, 2.4, 0.34), 0)
      + dampedSine(t, 0.7, 74, 3.5, 0.38)
      + dampedSine(t, 0.715, 468, 12, 0.08)
    )),
  },
  {
    id: 'sfx-feature-retrigger-01', duration: 1.3, seed: 0x52545247,
    description: 'Feature extension contact sequence and secured-spin confirmation.',
    render: (duration, seed) => renderMono(duration, seed, (t) => (
      [330, 440, 550, 660].reduce((sum, frequency, index) => sum + dampedSine(t, 0.08 + index * 0.14, frequency, 3.1, 0.24), 0)
      + dampedSine(t, 0.72, 92, 4.2, 0.28)
    )),
  },
  {
    id: 'sfx-feature-complete-01', duration: 2.1, seed: 0x434f4d50,
    description: 'Grounded relay shutdown and completed-operation confirmation.',
    render: (duration, seed) => renderMono(duration, seed, (t) => (
      [392, 330, 262, 196].reduce((sum, frequency, index) => sum + dampedSine(t, 0.08 + index * 0.18, frequency, 2.15, 0.22), 0)
      + dampedSine(t, 0.84, 78, 2.2, 0.34)
      + dampedSine(t, 0.86, 624, 8.5, 0.07)
    )),
  },
];

async function encodeOgg(wavPath, oggPath, quality) {
  let failure;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath,
      '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
      '-c:a', 'libvorbis', '-q:a', String(quality), oggPath,
    ], { encoding: 'utf8' });
    if (result.status === 0) return;
    failure = result.error?.message || result.stderr || result.stdout || `exit status ${String(result.status)}`;
  }
  throw new Error(`ffmpeg failed for ${oggPath} after three attempts: ${failure}`);
}

async function writeIfChanged(path, content) {
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
  try {
    const current = await readFile(path);
    if (current.equals(next)) return false;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await writeFile(path, next);
  return true;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'defuse-protocol-audio-'));
  const metadata = [];
  try {
    for (const definition of definitions) {
      const channels = definition.render(definition.duration, definition.seed);
      const wav = writeWav(channels);
      const wavPath = join(temporaryDirectory, `${definition.id}.wav`);
      const temporaryOggPath = join(temporaryDirectory, `${definition.id}.ogg`);
      const runtimeOggPath = join(OUTPUT_DIR, `${definition.id}.ogg`);
      await writeFile(wavPath, wav);
      await encodeOgg(wavPath, temporaryOggPath, definition.quality ?? SFX_QUALITY);
      const encoded = await readFile(temporaryOggPath);
      await writeIfChanged(runtimeOggPath, encoded);
      metadata.push({
        id: definition.id,
        path: `src/assets/audio/${definition.id}.ogg`,
        durationSeconds: definition.duration,
        sampleRate: SAMPLE_RATE,
        channels: channels.length,
        seed: `0x${definition.seed.toString(16).padStart(8, '0')}`,
        vorbisQuality: definition.quality ?? SFX_QUALITY,
        description: definition.description,
        bytes: encoded.byteLength,
        sha256: createHash('sha256').update(encoded).digest('hex'),
      });
    }
    await writeIfChanged(join(OUTPUT_DIR, 'generated-audio.json'), `${JSON.stringify({
      generatorVersion: 2,
      createdBy: CREATOR,
      createdOn: CREATED_ON,
      format: 'Ogg Vorbis q5 from deterministic 44.1 kHz PCM synthesis',
      assets: metadata,
    }, null, 2)}\n`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

await main();
