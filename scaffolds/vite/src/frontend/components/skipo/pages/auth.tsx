import { LuthAuthPage, type LuthAuthPageProps } from '@ultrst-armada/floks/auth';

export function AuthPage(props: Omit<LuthAuthPageProps, 'ecosystemId'>) {
  return <LuthAuthPage {...props} ecosystemId="ultrst-armada" />;
}
