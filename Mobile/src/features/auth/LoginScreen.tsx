import { useRef, useState } from 'react';
import { Image, StyleSheet, View, type TextInput } from 'react-native';

import { AppText, Button, Card, Icon, Screen, TextField } from '@/components';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { isApiError } from '@/services/api/errors';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';

import { loginErrorMessage } from './loginErrors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email/password sign-in. Navigation after success is handled by the (auth) layout guard. */
export function LoginScreen() {
  const theme = useTheme();
  const { login, signOutReason, clearSignOutReason } = useSession();
  const { isOffline } = useNetworkStatus();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (submitting) return;
    const trimmed = email.trim();
    const eErr = !trimmed ? 'Enter your email address.' : !EMAIL_RE.test(trimmed) ? 'Enter a valid email address.' : null;
    const pErr = !password ? 'Enter your password.' : null;
    setEmailError(eErr);
    setPasswordError(pErr);
    setFormError(null);
    if (eErr || pErr) return;
    clearSignOutReason();
    setSubmitting(true);
    try {
      await login(trimmed, password);
      setPassword('');
    } catch (e) {
      if (!(isApiError(e) && e.kind === 'cancelled')) setFormError(loginErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const banner = formError ?? signOutReason;

  return (
    <Screen edges={['top', 'bottom']} keyboardAvoiding showOfflineBanner={false} contentContainerStyle={styles.content}>
      <View style={[styles.brand, { gap: theme.spacing.md, marginBottom: theme.spacing.xl }]}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel="Hakirush logo"
        />
        <AppText variant="display" align="center">
          Sign in
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Use the email and password provided by your administrator.
        </AppText>
      </View>

      <Card style={{ gap: theme.spacing.lg }}>
        {banner ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[styles.banner, { backgroundColor: theme.colors.dangerBg, borderRadius: theme.radii.md, padding: theme.spacing.md }]}
          >
            <Icon name="alert-circle" color="danger" />
            <AppText variant="body" color="danger" style={styles.flex} testID="login-error">
              {banner}
            </AppText>
          </View>
        ) : null}
        {isOffline ? (
          <AppText variant="secondary" color="warning">
            You appear to be offline. Connect to the internet to sign in.
          </AppText>
        ) : null}
        <TextField
          testID="login-email"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={emailError}
          disabled={submitting}
        />
        <TextField
          testID="login-password"
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={passwordError}
          disabled={submitting}
        />
        <Button testID="login-submit" label={submitting ? 'Signing in…' : 'Sign in'} onPress={submit} loading={submitting} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center' },
  logo: { width: 120, height: 120 },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
