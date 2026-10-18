import { useIsFocused } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

function subscribeAppState(onChange: () => void): () => void {
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
const getAppStateActive = () => AppState.currentState === 'active';

/**
 * Re-renders every `intervalMs` while the screen is focused AND the app is in the foreground,
 * returning the device time in ms. Nothing runs in the background; pair it with
 * attendanceTimer.computeWorkedMs (server-derived values) — no stopwatch accumulates on device.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const isFocused = useIsFocused();
  const appActive = useSyncExternalStore(subscribeAppState, getAppStateActive, getAppStateActive);
  const [now, setNow] = useState(() => Date.now());
  const running = enabled && isFocused && appActive;

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const immediate = setTimeout(tick, 0); // refresh right after resuming
    const interval = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [running, intervalMs]);

  return now;
}
