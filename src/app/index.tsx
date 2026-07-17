// Authenticated home = the Secure Camera capture flow. The auth gate in
// _layout.tsx guarantees a signed-in user before this screen renders.
import { CaptureScreen } from '@/screens/CaptureScreen';

export default function Home() {
  return <CaptureScreen />;
}
