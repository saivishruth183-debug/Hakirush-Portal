import { useNetInfo } from '@react-native-community/netinfo';

/**
 * `isOffline` is true only when the OS reports no connection (or internet explicitly unreachable).
 * Unknown states (null) count as online so we never block the UI on a guess.
 */
export function useNetworkStatus(): { isOffline: boolean } {
  const net = useNetInfo();
  const isOffline = net.isConnected === false || net.isInternetReachable === false;
  return { isOffline };
}
