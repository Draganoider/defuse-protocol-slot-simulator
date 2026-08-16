import { useEffect, useMemo, useState } from 'react';
import {
  clearDiagnosticEvents,
  formatDiagnosticEvents,
  readDiagnosticEvents,
  subscribeDiagnosticEvents,
  type DiagnosticEvent,
} from '../diagnostics/diagnostic-log';

export function DiagnosticsPanel({ onClose }: { readonly onClose: () => void }) {
  const [events, setEvents] = useState<readonly DiagnosticEvent[]>(readDiagnosticEvents);
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => subscribeDiagnosticEvents(setEvents), []);
  const text = useMemo(() => formatDiagnosticEvents(events), [events]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('Copied. Paste this log into the Codex conversation after a reload.');
    } catch {
      setCopyStatus('Clipboard access was blocked. Select the log text and copy it manually.');
    }
  };

  return (
    <div className="dp-overlay" role="dialog" aria-modal="true" aria-labelledby="diagnostics-title">
      <section className="dp-dialog dp-diagnostics">
        <button className="dp-close" type="button" aria-label="Close diagnostics" onClick={onClose}>×</button>
        <p className="dp-kicker">Local crash evidence</p>
        <h2 id="diagnostics-title">Diagnostics</h2>
        <p>This bounded log stays on this device and records technical game events only. After a tab crash, reload and copy it before clearing.</p>
        <div className="dp-diagnostics__summary"><strong>{events.length}</strong><span>events retained · maximum 240</span></div>
        <textarea aria-label="Diagnostic log" readOnly spellCheck={false} value={text} />
        <div className="dp-diagnostics__actions">
          <button type="button" onClick={() => void copy()}>Copy diagnostic log</button>
          <button type="button" onClick={clearDiagnosticEvents}>Clear local log</button>
        </div>
        {copyStatus && <p className="dp-diagnostics__status" role="status">{copyStatus}</p>}
      </section>
    </div>
  );
}
