/**
 * Test-only expo-router replacement for rendering feature screens without a navigator:
 *   jest.mock('expo-router', () => require('@/features/employee/testing/routerMock').createExpoRouterMock());
 */
export const mockRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
};

export const mockParams: { current: Record<string, string> } = { current: {} };

export function createExpoRouterMock() {
  const actual = jest.requireActual('expo-router');
  const React = jest.requireActual('react');
  const Screen = () => null;
  return {
    ...actual,
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams.current,
    useIsFocused: () => true,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
    Stack: Object.assign(() => null, { Screen }),
  };
}
