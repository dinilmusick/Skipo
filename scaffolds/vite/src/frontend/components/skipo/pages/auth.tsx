import { LuthOidcGate, type LuthOidcGateProps } from '@ultrst-armada/floks/auth';

/** Generated apps always authenticate through the shared Kloks/Luth BFF. */
export function AuthPage(props: LuthOidcGateProps) {
  return <LuthOidcGate {...props} />;
}
