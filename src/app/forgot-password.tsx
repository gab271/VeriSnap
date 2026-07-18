// Public route: password recovery by emailed code.
import { useRouter } from 'expo-router';

import { ForgotPasswordScreen } from '@/screens/ForgotPasswordScreen';

export default function ForgotPassword() {
  const router = useRouter();
  return <ForgotPasswordScreen onDone={() => router.back()} />;
}
