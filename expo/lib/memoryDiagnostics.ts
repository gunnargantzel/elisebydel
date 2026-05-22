import { AppState, Platform } from 'react-native';
import { logInfo, logWarn } from '@/lib/appLogger';

const AUTO_RESTART_WINDOW_MS = 5 * 60 * 1000;
const MAX_AUTO_RESTARTS_IN_WINDOW = 3;

let renderProcessGoneCount = 0;
let autoRestartTimestamps: number[] = [];

export function getRenderProcessGoneCount(): number {
  return renderProcessGoneCount;
}

export function recordRenderProcessGone(didCrash?: boolean): {
  count: number;
  autoRestartsInWindow: number;
  shouldAutoRecover: boolean;
} {
  const now = Date.now();
  renderProcessGoneCount += 1;
  autoRestartTimestamps.push(now);
  autoRestartTimestamps = autoRestartTimestamps.filter(
    (ts) => now - ts < AUTO_RESTART_WINDOW_MS,
  );

  const autoRestartsInWindow = autoRestartTimestamps.length;
  const shouldAutoRecover = autoRestartsInWindow <= MAX_AUTO_RESTARTS_IN_WINDOW;

  logWarn('memory', 'WebView render process gone', {
    didCrash: didCrash ?? null,
    renderProcessGoneCount,
    autoRestartsInWindow,
    shouldAutoRecover,
    appState: AppState.currentState,
    platform: Platform.OS,
  });

  return {
    count: renderProcessGoneCount,
    autoRestartsInWindow,
    shouldAutoRecover,
  };
}

export function logMemorySnapshot(reason: string, extra?: Record<string, unknown>): void {
  logInfo('memory', reason, {
    renderProcessGoneCount,
    appState: AppState.currentState,
    platform: Platform.OS,
    ...extra,
  });
}
