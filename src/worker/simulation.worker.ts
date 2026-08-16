import {
  handleSimulationWorkerRequest,
  type SimulationWorkerRequest,
  type SimulationWorkerResponse,
} from './simulation-protocol';

export type { SimulationWorkerRequest, SimulationWorkerResponse } from './simulation-protocol';

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const message = event.data;
  if (!message || message.type !== 'simulate' || typeof message.requestId !== 'string') return;
  const response: SimulationWorkerResponse = handleSimulationWorkerRequest(message);
  workerScope.postMessage(response);
};

