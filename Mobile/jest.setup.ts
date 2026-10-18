/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Global Jest setup (jest-expo preset). Native modules are replaced with small in-memory fakes.
 * Tests can reach the fakes via `require('expo-secure-store').__store` etc.
 */
import 'react-native-gesture-handler/jestSetup';

// ---- expo-secure-store: in-memory store with optional artificial write delay ----
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  const control = { writeDelayMs: 0, failReads: false };
  const delay = () => (control.writeDelayMs ? new Promise((r) => setTimeout(r, control.writeDelayMs)) : Promise.resolve());
  return {
    __store: store,
    __control: control,
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    isAvailableAsync: jest.fn(async () => true),
    getItemAsync: jest.fn(async (key: string) => {
      if (control.failReads) throw new Error('keystore unavailable');
      return store.has(key) ? store.get(key)! : null;
    }),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      await delay();
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// ---- NetInfo (official mock) ----
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));

// ---- Safe area (official mock) ----
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// ---- Reanimated (only pulled in transitively) ----
// The reanimated mock loads react-native-worklets, whose native module is absent in Jest.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// ---- expo-file-system: tiny fake of the object API used by services/api/download.ts ----
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const join = (...parts: (string | { uri: string })[]) =>
    parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/').replace(/\/+/g, '/');
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(...parts);
    }
    get exists() {
      return dirs.has(this.uri);
    }
    create() {
      dirs.add(this.uri);
    }
    delete() {
      dirs.delete(this.uri);
      for (const k of [...files.keys()]) if (k.startsWith(this.uri + '/')) files.delete(k);
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(...parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, '');
    }
    write(content: string) {
      files.set(this.uri, content);
    }
    delete() {
      files.delete(this.uri);
    }
    static downloadFileAsync = jest.fn(async (_url: string, destination: File) => {
      files.set(destination.uri, 'downloaded');
      return destination;
    });
  }
  return { __files: files, __dirs: dirs, Directory, File, Paths: { cache: new Directory('file:///cache'), document: new Directory('file:///docs') } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

// ---- expo-image: plain View that forwards onError so tests can simulate load failures ----
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  const Image = (props: Record<string, unknown>) => {
    const { onError, testID } = props as { onError?: () => void; testID?: string };
    return require('react').createElement(View, { testID: testID ?? 'expo-image', onError });
  };
  Image.clearMemoryCache = jest.fn(async () => true);
  Image.clearDiskCache = jest.fn(async () => true);
  return { Image };
});

// Configured API base URL for tests.
process.env.EXPO_PUBLIC_API_URL = 'https://api.test.local';
