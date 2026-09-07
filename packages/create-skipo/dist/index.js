#!/usr/bin/env node

// src/index.ts
import { parseArgs } from "util";

// src/generators/nextjs.ts
import { promises as fs } from "fs";
import { join, dirname } from "path";

// src/generators/nextjs-templates.ts
var nextjsTemplates = {
  packageJson: (projectName) => JSON.stringify({
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
  authRouteTs: () => `import { BaseAccountProvider, LocalAccountProvider } from '@skipo/backend';

export async function GET(request: Request) {
  // Auth logic using LocalAccountProvider
  return new Response('Auth API Route');
}
`,
  eventsRouteTs: () => `// import { sseHelper } from '@skipo/backend';

export async function GET(request: Request) {
  // SSE helper usage
  return new Response('SSE Endpoint');
}
`,
  workspaceRouteTs: () => `// import { WorkspaceFS } from '@skipo/backend';

export async function GET(request: Request) {
  // WorkspaceFS usage
  return new Response('Workspace API');
}
`,
  customComponentTsx: () => `import { BaseButton } from '@skipo/ui';

export function CustomButton(props: any) {
  return <BaseButton {...props} />;
}
`,
  createAdminTs: () => `console.log('Create admin script');
`,
  validateTs: () => `// import { validate } from 'skipo-validate';
console.log('Validate script');
`,
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

// src/generators/nextjs.ts
async function writeFile(path, content) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, "utf-8");
}
async function generateNextjs(projectName, _skipGit, _skipInstall) {
  const projectDir = join(process.cwd(), projectName);
  await fs.mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, "package.json"), nextjsTemplates.packageJson(projectName));
  await writeFile(join(projectDir, "tsconfig.json"), nextjsTemplates.tsconfigJson());
  await writeFile(join(projectDir, "next.config.js"), nextjsTemplates.nextConfigJs());
  await writeFile(join(projectDir, ".gitignore"), nextjsTemplates.gitignore());
  await writeFile(join(projectDir, "src", "app", "globals.css"), "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
  await writeFile(join(projectDir, "src", "app", "layout.tsx"), nextjsTemplates.layoutTsx());
  await writeFile(join(projectDir, "src", "app", "page.tsx"), nextjsTemplates.pageTsx());
  await writeFile(join(projectDir, "src", "app", "login", "page.tsx"), nextjsTemplates.loginPageTsx());
  await writeFile(join(projectDir, "src", "app", "admin", "login", "page.tsx"), nextjsTemplates.adminLoginPageTsx());
  await writeFile(join(projectDir, "src", "app", "admin", "page.tsx"), nextjsTemplates.adminPageTsx());
  await writeFile(join(projectDir, "src", "app", "api", "auth", "[...route]", "route.ts"), nextjsTemplates.authRouteTs());
  await writeFile(join(projectDir, "src", "app", "api", "events", "route.ts"), nextjsTemplates.eventsRouteTs());
  await writeFile(join(projectDir, "src", "app", "api", "workspace", "route.ts"), nextjsTemplates.workspaceRouteTs());
  await writeFile(join(projectDir, "src", "components", "CustomButton.tsx"), nextjsTemplates.customComponentTsx());
  await writeFile(join(projectDir, "scripts", "create-admin.ts"), nextjsTemplates.createAdminTs());
  await writeFile(join(projectDir, "scripts", "validate.ts"), nextjsTemplates.validateTs());
  await writeFile(join(projectDir, ".skipo", "agent-state.json"), nextjsTemplates.agentStateJson());
  console.log("Next.js project setup complete.");
}

// src/generators/react-vite.ts
import { promises as fs2 } from "fs";
import { join as join2 } from "path";
async function generateReactVite(projectName, _skipGit, _skipInstall) {
  const projectDir = join2(process.cwd(), projectName);
  await fs2.mkdir(projectDir, { recursive: true });
  const pkgJson = {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      "dev": "vite",
      "build": "tsc -b && vite build",
      "build:serverless": "esbuild api/index.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js",
      "preview": "vite preview"
    },
    dependencies: {
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "@skipo/core": "latest",
      "@skipo/ui": "latest",
      "@skipo/systems": "latest"
    },
    devDependencies: {
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      "esbuild": "^0.25.0",
      "typescript": "^5.5.3",
      "vite": "^5.4.1"
    }
  };
  await fs2.writeFile(
    join2(projectDir, "package.json"),
    JSON.stringify(pkgJson, null, 2),
    "utf-8"
  );
  const gitignoreContent = `.DS_Store
*.log
.gemini/
*.tmp
node_modules/
/dist/
.turbo/
`;
  await fs2.writeFile(
    join2(projectDir, ".gitignore"),
    gitignoreContent,
    "utf-8"
  );
  const vercelJson = {
    rewrites: [
      { source: "/api/(.*)", destination: "/api" },
      { source: "/(.*)", destination: "/index.html" }
    ]
  };
  await fs2.writeFile(
    join2(projectDir, "vercel.json"),
    JSON.stringify(vercelJson, null, 2),
    "utf-8"
  );
  console.log("React+Vite project setup complete.");
}

// src/generators/electron.ts
import { promises as fs3 } from "fs";
import { join as join3 } from "path";
async function generateElectron(projectName, _skipGit, _skipInstall) {
  const projectDir = join3(process.cwd(), projectName);
  await fs3.mkdir(projectDir, { recursive: true });
  const pkgJson = {
    name: projectName,
    version: "0.1.0",
    private: true,
    main: "main.js",
    scripts: {
      "start": "electron ."
    },
    dependencies: {
      "@skipo/core": "latest"
    },
    devDependencies: {
      "electron": "latest"
    }
  };
  await fs3.writeFile(
    join3(projectDir, "package.json"),
    JSON.stringify(pkgJson, null, 2),
    "utf-8"
  );
  const gitignoreContent = `.DS_Store
*.log
.gemini/
*.tmp
node_modules/
/dist/
.turbo/
`;
  await fs3.writeFile(
    join3(projectDir, ".gitignore"),
    gitignoreContent,
    "utf-8"
  );
  console.log("Electron project setup complete (stub).");
}

// src/index.ts
import * as readline from "readline/promises";
async function main() {
  const { values, positionals } = parseArgs({
    options: {
      template: {
        type: "string",
        short: "t"
      },
      "no-git": {
        type: "boolean"
      },
      "no-install": {
        type: "boolean"
      }
    },
    allowPositionals: true
  });
  let projectName = positionals[0];
  let template = values.template;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  if (!projectName) {
    projectName = await rl.question("Project name? (skipo-app): ");
    if (!projectName) {
      projectName = "skipo-app";
    }
  }
  if (!template) {
    template = await rl.question("Template? (nextjs | react-vite | electron): ");
    if (!template) {
      template = "nextjs";
    }
  }
  rl.close();
  console.log(`Creating project ${projectName} with template ${template}...`);
  const skipGit = values["no-git"] ?? false;
  const skipInstall = values["no-install"] ?? false;
  try {
    switch (template) {
      case "nextjs":
        await generateNextjs(projectName, skipGit, skipInstall);
        break;
      case "react-vite":
        await generateReactVite(projectName, skipGit, skipInstall);
        break;
      case "electron":
        await generateElectron(projectName, skipGit, skipInstall);
        break;
      default:
        console.error(`Unknown template: ${template}`);
        process.exit(1);
    }
    console.log("Done!");
  } catch (error) {
    console.error("Failed to generate project:", error);
    process.exit(1);
  }
}
main();
