# Asset records

This directory stores public, sanitized asset briefs, prompt records, and the machine-readable provenance manifest. It must not contain third-party reference boards, credentials, private source URLs, purchase receipts, personal data, or unreviewed generation dumps.

No runtime media asset may be committed without a matching approved entry in `manifest.json`.

The current approved set contains the complete visual symbol family, three Pelagos environment states, and twenty deterministically synthesized audio assets. Audio seeds, durations, channel layouts, byte sizes, and hashes are recorded in `src/assets/audio/generated-audio.json`; the public family brief and generation record live in this directory.
