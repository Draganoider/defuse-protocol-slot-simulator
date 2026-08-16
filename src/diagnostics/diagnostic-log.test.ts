import { describe, expect, it } from 'vitest';
import { appendDiagnosticEvent, parseDiagnosticEvents, type DiagnosticEvent } from './diagnostic-log';

function event(sequence: number): DiagnosticEvent {
  return { sequence, at: '2026-08-16T00:00:00.000Z', type: 'test', details: { sequence } };
}

describe('diagnostic log records', () => {
  it('rejects malformed persisted values', () => {
    expect(parseDiagnosticEvents(null)).toEqual([]);
    expect(parseDiagnosticEvents([{ sequence: 'one', type: 'bad' }, event(2)])).toEqual([event(2)]);
  });

  it('retains only the most recent 240 bounded events', () => {
    let events: DiagnosticEvent[] = [];
    for (let sequence = 1; sequence <= 300; sequence += 1) events = appendDiagnosticEvent(events, event(sequence));
    expect(events).toHaveLength(240);
    expect(events[0]?.sequence).toBe(61);
    expect(events.at(-1)?.sequence).toBe(300);
  });
});
