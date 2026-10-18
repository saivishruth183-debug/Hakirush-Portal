import { useCallback, useRef, useState } from 'react';

/**
 * Prevents double presses: while the handler's promise is pending (or for `cooldownMs` after a
 * synchronous handler) further presses are ignored. `busy` is true while a promise is pending.
 */
export function usePressGuard<A extends unknown[]>(
  handler: ((...args: A) => unknown) | undefined,
  cooldownMs = 400,
): { onPress: (...args: A) => void; busy: boolean } {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);

  const onPress = useCallback(
    (...args: A) => {
      if (!handler || locked.current) return;
      locked.current = true;
      let result: unknown;
      try {
        result = handler(...args);
      } catch (e) {
        locked.current = false;
        throw e;
      }
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        setBusy(true);
        (result as Promise<unknown>).then(
          () => {
            locked.current = false;
            setBusy(false);
          },
          () => {
            locked.current = false;
            setBusy(false);
          },
        );
      } else {
        setTimeout(() => {
          locked.current = false;
        }, cooldownMs);
      }
    },
    [handler, cooldownMs],
  );

  return { onPress, busy };
}
