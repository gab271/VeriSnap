// Public route: renders the authentication screen. The auth gate in _layout.tsx
// makes this the only reachable screen while signed out.
import { SignInScreen } from '@/screens/SignInScreen';

export default function SignIn() {
  return <SignInScreen />;
}
