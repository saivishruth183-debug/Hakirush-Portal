// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*', 'android/*', 'ios/*'],
  },
  {
    rules: {
      // Web-only APIs are not available in the native app.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react-dom', message: 'Native app: react-dom is not available.' },
            { name: 'react-router-dom', message: 'Use expo-router.' },
            { name: 'lucide-react', message: 'Use @expo/vector-icons.' },
            { name: 'framer-motion', message: 'Not supported in React Native.' },
            { name: 'recharts', message: 'Not supported in React Native.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use SecureStore (secrets) or React Query cache.' },
        { name: 'sessionStorage', message: 'Not available in React Native.' },
        { name: 'document', message: 'Not available in React Native.' },
        { name: 'window', message: 'Not available in React Native.' },
      ],
    },
  },
]);
