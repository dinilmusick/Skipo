/**
 * @fileoverview Next.js template strings.
 */

export const nextjsTemplates = {
  packageJson: (projectName: string) => JSON.stringify({
    name: projectName,
    version: "0.1.0",
    private: true,
    scripts: {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint"
    },
    dependencies: {
      "react": "^18",
      "react-dom": "^18",
      "next": "^14",
      "@skipo/core": "latest",
      "@skipo/ui": "latest",
      "@skipo/backend": "latest",
      "@skipo/systems": "latest",
      "@skipo/validate": "latest"
    },
    devDependencies: {
      "typescript": "^5",
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      "postcss": "^8",
      "tailwindcss": "^3.4.1"
    }
  }, null, 2),

  tsconfigJson: () => JSON.stringify({
    "compilerOptions": {
      "lib": ["dom", "dom.iterable", "esnext"],
      "allowJs": true,
      "skipLibCheck": true,
      "strict": true,
      "noEmit": true,
      "esModuleInterop": true,
      "module": "esnext",
      "moduleResolution": "bundler",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "jsx": "preserve",
      "incremental": true,
      "plugins": [{ "name": "next" }],
      "paths": {
        "@/*": ["./src/*"]
      }
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules"]
  }, null, 2),

  nextConfigJs: () => `/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
`,

  layoutTsx: () => `import { SkipoThemeProvider } from '@skipo/ui';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SkipoThemeProvider>
          {children}
        </SkipoThemeProvider>
      </body>
    </html>
  );
}
`,

  pageTsx: () => `import { PageContainer, BaseButton, BaseCard, BaseBadge } from '@skipo/ui';

export default function Home() {
  return (
    <PageContainer>
      <BaseCard>
        <h1>Welcome to Skipo</h1>
        <BaseBadge>New</BaseBadge>
        <BaseButton>Get Started</BaseButton>
      </BaseCard>
    </PageContainer>
  );
}
`,

  loginPageTsx: () => `import { BaseCard } from '@skipo/ui';
// import { useAuth } from '@skipo/backend/hooks'; // Assuming hooks exist

export default function Login() {
  return (
    <BaseCard>
      <h2>Login</h2>
      {/* Auth components go here */}
    </BaseCard>
  );
}
`,

  adminLoginPageTsx: () => `import { BaseCard } from '@skipo/ui';

export default function AdminLogin() {
  return (
    <BaseCard>
      <h2>Admin Login</h2>
    </BaseCard>
  );
}
`,

  adminPageTsx: () => `import { PageContainer } from '@skipo/ui';

export default function AdminDashboard() {
  return (
    <PageContainer>
      <h2>Admin Dashboard</h2>
    </PageContainer>
  );
}
`,

  authRouteTs: () => `import { NextRequest, NextResponse } from 'next/server';
import { createSecureRoute } from '@/lib/api-governance';

export const GET = createSecureRoute({
  rateLimitTier: 'AUTHENTICATION',
  public: true,
  async handler(req: NextRequest) {
    return NextResponse.json({ message: 'Auth API Route' });
  }
});
`,

  eventsRouteTs: () => `import { NextRequest, NextResponse } from 'next/server';
import { createSecureRoute } from '@/lib/api-governance';

export const GET = createSecureRoute({
  rateLimitTier: 'CHEAP_READ',
  public: false,
  async handler(req: NextRequest) {
    return NextResponse.json({ message: 'Events Endpoint' });
  }
});
`,

  workspaceRouteTs: () => `import { NextRequest, NextResponse } from 'next/server';
import { createSecureRoute } from '@/lib/api-governance';

export const GET = createSecureRoute({
  rateLimitTier: 'NORMAL_MUTATION',
  public: false,
  async handler(req: NextRequest) {
    return NextResponse.json({ message: 'Workspace API' });
  }
});
`,

  customComponentTsx: () => `import { BaseButton } from '@skipo/ui';

export function CustomButton(props: any) {
  return <BaseButton {...props} />;
}
`,

  createAdminTs: () => `console.log('Create admin script');\n`,

  validateTs: () => `// import { validate } from 'skipo-validate';
console.log('Validate script');\n`,

  agentStateJson: () => JSON.stringify({ turnCounter: 0 }, null, 2),

  gitignore: () => `.DS_Store
*.log
.gemini/
*.tmp
node_modules/
/dist/
/.next/
.turbo/
`
};
