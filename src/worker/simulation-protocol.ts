import { runSimulation, type SimulationError, type SimulationReport, type SimulationRequest } from '../engine';

export interface SimulationWorkerRequest {
  readonly type: 'simulate';
  readonly requestId: string;
  readonly payload: SimulationRequest;
}

export type SimulationWorkerResponse =
  | { readonly type: 'complete'; readonly requestId: string; readonly report: SimulationReport }
  | { readonly type: 'error'; readonly requestId: string; readonly error: SimulationError };

/** Pure request boundary shared by the Web Worker and deterministic parity tests. */
export function handleSimulationWorkerRequest(message: SimulationWorkerRequest): SimulationWorkerResponse {
  try {
    return {
      type: 'complete',
      requestId: message.requestId,
      report: runSimulation(message.payload),
    };
  } catch (caught) {
    return {
      type: 'error',
      requestId: message.requestId,
      error: {
        code: caught instanceof Error && caught.name === 'ConfigurationValidationError' ? 'INVALID_CONFIG' : 'SIMULATION_ERROR',
        message: caught instanceof Error ? caught.message : 'Unknown simulation error.',
        ...(caught instanceof Error && 'issues' in caught ? { issues: (caught as { issues: SimulationError['issues'] }).issues } : {}),
      },
    };
  }
}
