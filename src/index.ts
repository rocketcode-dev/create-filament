#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ProjectConfig {
  name: string;
  template: 'minimal' | 'api' | 'full';
  features: {
    docker: boolean;
    dockerCompose: boolean;
    ci: 'github' | 'gitlab' | 'none';
    openapi: boolean;
    auth: boolean;
    observability: boolean;
  };
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  git: boolean;
  gitCommit: boolean;
  install: boolean;
}

const TEMPLATES_DIR = resolve(__dirname, '../templates');

function printBanner() {
  console.log(chalk.cyan(`
   _____ _ _                            _   
  |  ___(_) | __ _ _ __ ___   ___ _ __ | |_ 
  | |_  | | |/ _\` | '_ \` _ \\ / _ \\ '_ \\| __|
  |  _| | | | (_| | | | | | |  __/ | | | |_ 
  |_|   |_|_|\\__,_|_| |_| |_|\\___|_| |_|\\__|
  `));
  console.log(chalk.gray('  A TypeScript API framework with metadata-driven middleware\n'));
}

async function promptForConfig(projectName?: string): Promise<ProjectConfig> {
  const questions: prompts.PromptObject[] = [];

  if (!projectName) {
    questions.push({
      type: 'text',
      name: 'name',
      message: 'Project name:',
      initial: 'my-api',
      validate: (value) => {
        if (!value) return 'Project name is required';
        if (!/^[a-z0-9-_]+$/.test(value)) {
          return 'Project name can only contain lowercase letters, numbers, hyphens, and underscores';
        }
        return true;
      }
    });
  }

  questions.push(
    {
      type: 'select',
      name: 'template',
      message: 'Choose a template:',
      choices: [
        { title: 'minimal    - Core framework + tooling', value: 'minimal' },
        { title: 'api        - + Auth + RBAC + OpenAPI + Redis', value: 'api' },
        { title: 'full       - + Observability + Analytics + CI/CD', value: 'full' }
      ],
      initial: 0
    },
    {
      type: (prev) => prev === 'minimal' ? 'multiselect' : null,
      name: 'additionalFeatures',
      message: 'Additional features:',
      choices: [
        { title: 'Docker support', value: 'docker', selected: true },
        { title: 'Docker Compose (app + Redis)', value: 'dockerCompose' },
        { title: 'GitHub Actions CI/CD', value: 'ci-github', selected: true },
        { title: 'OpenAPI/Swagger generation', value: 'openapi', selected: true },
        { title: 'Authentication (JWT + OAuth + Sessions)', value: 'auth' },
        { title: 'Observability (OpenTelemetry + Metrics)', value: 'observability' }
      ],
      instructions: 'Space to select, Enter to continue'
    },
    {
      type: 'select',
      name: 'packageManager',
      message: 'Package manager:',
      choices: [
        { title: 'npm', value: 'npm' },
        { title: 'pnpm', value: 'pnpm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'bun', value: 'bun' }
      ],
      initial: 0
    },
    {
      type: 'confirm',
      name: 'git',
      message: 'Initialize git repository?',
      initial: true
    },
    {
      type: (prev) => prev ? 'confirm' : null,
      name: 'gitCommit',
      message: 'Create initial commit?',
      initial: true
    }
  );

  const answers = await prompts(questions, {
    onCancel: () => {
      console.log(chalk.red('\n✖ Operation cancelled'));
      process.exit(0);
    }
  });

  // Parse features based on template and additional selections
  let features = {
    docker: false,
    dockerCompose: false,
    ci: 'none' as 'github' | 'gitlab' | 'none',
    openapi: false,
    auth: false,
    observability: false
  };

  if (answers.template === 'api' || answers.template === 'full') {
    features.docker = true;
    features.dockerCompose = true;
    features.ci = 'github';
    features.openapi = true;
    features.auth = true;
  }

  if (answers.template === 'full') {
    features.observability = true;
  }

  // Override with additional features for minimal template
  if (answers.template === 'minimal' && answers.additionalFeatures) {
    features.docker = answers.additionalFeatures.includes('docker');
    features.dockerCompose = answers.additionalFeatures.includes('dockerCompose');
    features.ci = answers.additionalFeatures.includes('ci-github') ? 'github' : 'none';
    features.openapi = answers.additionalFeatures.includes('openapi');
    features.auth = answers.additionalFeatures.includes('auth');
    features.observability = answers.additionalFeatures.includes('observability');
  }

  return {
    name: projectName || answers.name,
    template: answers.template,
    features,
    packageManager: answers.packageManager,
    git: answers.git,
    gitCommit: answers.gitCommit,
    install: true
  };
}

function createProjectStructure(projectPath: string, config: ProjectConfig) {
  const spinner = ora('Creating project structure...').start();

  try {
    // Create base directories
    mkdirSync(projectPath, { recursive: true });
    mkdirSync(resolve(projectPath, 'src'), { recursive: true });
    mkdirSync(resolve(projectPath, 'src/meta'), { recursive: true });
    mkdirSync(resolve(projectPath, 'src/middleware'), { recursive: true });
    mkdirSync(resolve(projectPath, 'src/routes'), { recursive: true });
    mkdirSync(resolve(projectPath, 'src/handlers'), { recursive: true });
    mkdirSync(resolve(projectPath, 'src/config'), { recursive: true });
    mkdirSync(resolve(projectPath, 'tests/integration'), { recursive: true });
    mkdirSync(resolve(projectPath, 'tests/unit'), { recursive: true });

    spinner.succeed('Created project structure');
    return true;
  } catch (error) {
    spinner.fail('Failed to create project structure');
    console.error(error);
    return false;
  }
}

function copyTemplateFiles(projectPath: string, config: ProjectConfig) {
  const spinner = ora('Copying template files...').start();

  try {
    const templatePath = resolve(TEMPLATES_DIR, config.template);
    
    // Copy entire src directory from template
    if (existsSync(templatePath)) {
      const templateSrc = resolve(templatePath, 'src');
      const projectSrc = resolve(projectPath, 'src');
      
      if (existsSync(templateSrc)) {
        // Remove empty src directory created by createProjectStructure
        if (existsSync(projectSrc)) {
          execSync(`rm -rf ${projectSrc}`);
        }
        // Copy template src to project
        cpSync(templateSrc, projectSrc, { recursive: true });
      }
      
      // Copy tests directory from template
      const templateTests = resolve(templatePath, 'tests');
      const projectTests = resolve(projectPath, 'tests');
      
      if (existsSync(templateTests)) {
        // Remove empty tests directory created by createProjectStructure
        if (existsSync(projectTests)) {
          execSync(`rm -rf ${projectTests}`);
        }
        // Copy template tests to project
        cpSync(templateTests, projectTests, { recursive: true });
      }
    }

    spinner.succeed('Copied template files');
    return true;
  } catch (error) {
    spinner.fail('Failed to copy template files');
    console.error(error);
    return false;
  }
}

function generatePackageJson(projectPath: string, config: ProjectConfig) {
  const spinner = ora('Generating package.json...').start();

  try {
    const dependencies: Record<string, string> = {
      'filamentjs': '^0.1.0'
    };

    const devDependencies: Record<string, string> = {
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0',
      'tsx': '^4.7.0',
      'eslint': '^9.0.0',
      '@typescript-eslint/parser': '^8.0.0',
      '@typescript-eslint/eslint-plugin': '^8.0.0',
      'prettier': '^3.2.4',
      'husky': '^9.0.0',
      'lint-staged': '^15.2.0',
      '@commitlint/cli': '^19.0.0',
      '@commitlint/config-conventional': '^19.0.0',
      'depcheck': '^1.4.7',
      'test-battery': '^3.2.1'
    };

    // Add dependencies based on features
    if (config.features.auth) {
      dependencies['redis'] = '^4.6.0';
      dependencies['jsonwebtoken'] = '^9.0.2';
      devDependencies['@types/jsonwebtoken'] = '^9.0.5';
    }

    if (config.features.openapi) {
      dependencies['swagger-ui-express'] = '^5.0.0';
      devDependencies['@types/swagger-ui-express'] = '^4.1.6';
    }

    if (config.features.observability) {
      dependencies['@opentelemetry/api'] = '^1.9.0';
      dependencies['@opentelemetry/sdk-node'] = '^0.54.0';
      dependencies['prom-client'] = '^15.1.0';
    }

    // Always include pino
    dependencies['pino'] = '^8.17.0';
    dependencies['pino-pretty'] = '^10.3.0';

    const packageJson = {
      name: config.name,
      version: '1.0.0',
      description: 'A Filament API application',
      type: 'module',
      scripts: {
        dev: 'tsx watch src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
        test: 'node --test --experimental-test-coverage tests/**/*.test.ts',
        'test:watch': 'node --test --watch tests/**/*.test.ts',
        lint: 'eslint src/**/*.ts',
        'lint:fix': 'eslint src/**/*.ts --fix',
        format: 'prettier --write src/**/*.ts',
        'type-check': 'tsc --noEmit',
        prepare: 'husky',
        depcheck: 'depcheck'
      } as Record<string, string>,
      dependencies,
      devDependencies
    };

    // Add docker scripts if enabled
    if (config.features.docker) {
      packageJson.scripts['docker:build'] = 'docker build -t ' + config.name + ' .';
      packageJson.scripts['docker:run'] = 'docker run -p 3000:3000 ' + config.name;
    }

    if (config.features.dockerCompose) {
      packageJson.scripts['docker:up'] = 'docker-compose up';
      packageJson.scripts['docker:down'] = 'docker-compose down';
    }

    writeFileSync(
      resolve(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    spinner.succeed('Generated package.json');
    return true;
  } catch (error) {
    spinner.fail('Failed to generate package.json');
    console.error(error);
    return false;
  }
}

function generateConfigFiles(projectPath: string, config: ProjectConfig) {
  const spinner = ora('Generating configuration files...').start();

  try {
    // TypeScript config
    const tsConfig = {
      compilerOptions: {
        declaration: true,
        declarationMap: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        lib: ['ES2022'],
        module: 'ES2022',
        moduleResolution: 'node',
        outDir: './dist',
        paths: {
          '@/*': ['./src/*']
        },
        resolveJsonModule: true,
        rootDir: './src',
        skipLibCheck: true,
        sourceMap: true,
        strict: true,
        target: 'ES2022',
        types: ["node"]
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests']
    };

    writeFileSync(
      resolve(projectPath, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );

    // ESLint config (flat config for ESLint 9+)
    const eslintConfig = `import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
];
`;

    writeFileSync(
      resolve(projectPath, 'eslint.config.js'),
      eslintConfig
    );

    // Prettier config
    const prettierConfig = {
      semi: true,
      trailingComma: 'es5',
      singleQuote: true,
      printWidth: 100,
      tabWidth: 2
    };

    writeFileSync(
      resolve(projectPath, '.prettierrc'),
      JSON.stringify(prettierConfig, null, 2)
    );

    // .gitignore
    const gitignore = `node_modules/
dist/
*.log
.env
.DS_Store
coverage/
.vscode/
.idea/
*.swp
*.swo
`;

    writeFileSync(resolve(projectPath, '.gitignore'), gitignore);

    // .env.example
    let envExample = `# Server
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
`;

    if (config.features.auth) {
      envExample += `
# Authentication
JWT_SECRET=your-secret-here-change-in-production
JWT_EXPIRY=7d

# Redis
REDIS_URL=redis://localhost:6379
`;
    }

    if (config.features.observability) {
      envExample += `
# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
`;
    }

    writeFileSync(resolve(projectPath, '.env.example'), envExample);

    // Husky and lint-staged
    const huskyPath = resolve(projectPath, '.husky');
    mkdirSync(huskyPath, { recursive: true });

    const preCommitHook = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
`;

    writeFileSync(resolve(huskyPath, 'pre-commit'), preCommitHook);

    const commitMsgHook = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit $1
`;

    writeFileSync(resolve(huskyPath, 'commit-msg'), commitMsgHook);

    // Make hooks executable
    try {
      execSync(`chmod +x ${resolve(huskyPath, 'pre-commit')}`);
      execSync(`chmod +x ${resolve(huskyPath, 'commit-msg')}`);
    } catch (e) {
      // Ignore on Windows
    }

    // lint-staged config
    const lintStagedConfig = {
      '*.ts': [
        'eslint --fix',
        'prettier --write'
      ]
    };

    writeFileSync(
      resolve(projectPath, '.lintstagedrc'),
      JSON.stringify(lintStagedConfig, null, 2)
    );

    // commitlint config
    const commitlintConfig = `export default { extends: ['@commitlint/config-conventional'] };`;

    writeFileSync(resolve(projectPath, 'commitlint.config.js'), commitlintConfig);

    spinner.succeed('Generated configuration files');
    return true;
  } catch (error) {
    spinner.fail('Failed to generate configuration files');
    console.error(error);
    return false;
  }
}

function generateDockerFiles(projectPath: string, config: ProjectConfig) {
  if (!config.features.docker && !config.features.dockerCompose) {
    return true;
  }

  const spinner = ora('Generating Docker files...').start();

  try {
    if (config.features.docker) {
      const dockerfile = `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built files
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
`;

      writeFileSync(resolve(projectPath, 'Dockerfile'), dockerfile);

      const dockerignore = `node_modules
dist
*.log
.env
.git
.github
.vscode
.idea
*.md
tests
coverage
`;

      writeFileSync(resolve(projectPath, '.dockerignore'), dockerignore);
    }

    if (config.features.dockerCompose) {
      let composeServices: any = {
        app: {
          build: '.',
          ports: ['3000:3000'],
          environment: [
            'NODE_ENV=production',
            'LOG_LEVEL=info'
          ],
          depends_on: [],
          restart: 'unless-stopped'
        }
      };

      if (config.features.auth) {
        composeServices.app.environment.push('REDIS_URL=redis://redis:6379');
        composeServices.app.depends_on.push('redis');

        composeServices.redis = {
          image: 'redis:7-alpine',
          ports: ['6379:6379'],
          volumes: ['redis-data:/data'],
          restart: 'unless-stopped'
        };
      }

      const dockerCompose = {
        version: '3.8',
        services: composeServices,
        volumes: config.features.auth ? { 'redis-data': {} } : undefined
      };

      writeFileSync(
        resolve(projectPath, 'docker-compose.yml'),
        JSON.stringify(dockerCompose, null, 2)
      );
    }

    spinner.succeed('Generated Docker files');
    return true;
  } catch (error) {
    spinner.fail('Failed to generate Docker files');
    console.error(error);
    return false;
  }
}

function generateCIFiles(projectPath: string, config: ProjectConfig) {
  if (config.features.ci === 'none') {
    return true;
  }

  const spinner = ora('Generating CI/CD files...').start();

  try {
    if (config.features.ci === 'github') {
      const githubPath = resolve(projectPath, '.github/workflows');
      mkdirSync(githubPath, { recursive: true });

      const ciWorkflow = `name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Type check
      run: npm run type-check
    
    - name: Run tests
      run: npm test
    
    - name: Check dependencies
      run: npm run depcheck
    
    - name: Build
      run: npm run build
`;

      let dockerJob = '';
      if (config.features.docker) {
        dockerJob = `
  docker:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Build Docker image
      run: docker build -t ${config.name}:latest .
`;
      }

      writeFileSync(
        resolve(githubPath, 'ci.yml'),
        ciWorkflow + dockerJob
      );
    }

    spinner.succeed('Generated CI/CD files');
    return true;
  } catch (error) {
    spinner.fail('Failed to generate CI/CD files');
    console.error(error);
    return false;
  }
}

function generateREADME(projectPath: string, config: ProjectConfig) {
  const spinner = ora('Generating documentation...').start();

  try {
    const readme = `# ${config.name}

A Filament API application.

## Quick Start

\`\`\`bash
# Install dependencies
${config.packageManager} install

# Start development server
${config.packageManager} run dev

# Server running at http://localhost:3000
\`\`\`

## Available Scripts

- \`${config.packageManager} run dev\` - Start with hot reload
- \`${config.packageManager} test\` - Run tests
- \`${config.packageManager} run build\` - Build for production
- \`${config.packageManager} start\` - Run production build
- \`${config.packageManager} run lint\` - Lint code
- \`${config.packageManager} run format\` - Format code
${config.features.docker ? `- \`${config.packageManager} run docker:build\` - Build Docker image\n` : ''}${config.features.dockerCompose ? `- \`${config.packageManager} run docker:up\` - Run with Docker Compose\n` : ''}
## Project Structure

\`\`\`text
${config.name}/
├── src/
│   ├── meta/           # Metadata interface and defaults
│   ├── middleware/     # Middleware functions
│   ├── routes/         # Route definitions
│   ├── handlers/       # Post-request handlers
│   ├── config/         # Application configuration
│   └── index.ts        # Entry point
├── tests/
│   ├── integration/    # Integration tests
│   └── unit/          # Unit tests
${config.features.docker ? '├── Dockerfile\n' : ''}${config.features.dockerCompose ? '├── docker-compose.yml\n' : ''}└── package.json
\`\`\`

## Endpoints

- \`GET /health\` - Health check

${config.features.auth ? `
## Authentication

This project includes JWT and OAuth middleware. See \`src/middleware/\` for implementation.

Configure in \`.env\`:

\`\`\`bash
JWT_SECRET=your-secret-here
REDIS_URL=redis://localhost:6379
\`\`\`
` : ''}

${config.features.openapi ? `
## API Documentation

OpenAPI documentation available at: [http://localhost:3000/docs](http://localhost:3000/docs)
` : ''}

${config.features.observability ? `
## Observability

This project includes OpenTelemetry tracing and Prometheus metrics.

Metrics endpoint: [http://localhost:3000/metrics](http://localhost:3000/metrics)
` : ''}

## Database Integration

Filament doesn't include a database ORM by design. Choose what works for you:

### Recommended Options

**Prisma** (TypeScript-first, great DX)

\`\`\`bash
${config.packageManager} install prisma @prisma/client
npx prisma init
\`\`\`

**Drizzle** (Lightweight, SQL-like)

\`\`\`bash
${config.packageManager} install drizzle-orm
\`\`\`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for integration examples.

## Development

1. Copy \`.env.example\` to \`.env\` and configure
2. Run \`${config.packageManager} run dev\`
3. Make changes - server auto-reloads

## Production

\`\`\`bash
${config.packageManager} run build
${config.packageManager} start
\`\`\`

${config.features.docker ? `
Or with Docker:

\`\`\`bash
docker build -t ${config.name} .
docker run -p 3000:3000 ${config.name}
\`\`\`
` : ''}

## Testing

\`\`\`bash
${config.packageManager} test
\`\`\`

## License

ISC
`.replace(/\n{2,}/g, '\n\n');

    writeFileSync(resolve(projectPath, 'README.md'), readme);

    // Generate ARCHITECTURE.md
    const architecture = `# Architecture

## Metadata-Driven Design

This Filament application uses metadata to control middleware behavior.

### Metadata Interface

See \`src/meta/index.ts\` for your metadata interface definition.

### How It Works

1. Define default metadata in \`src/meta/defaults.ts\`
2. Override per-endpoint in route definitions
3. Middleware inspects \`req.endpointMeta\` to decide behavior

Example:

\`\`\`typescript
// src/routes/users.ts
app.get('/users', 
  { requiresAuth: true, rateLimit: 50 },
  async (req, res) => {
    res.json({ users: [] });
  }
);

// src/middleware/auth.ts
app.use(async (req, res, next) => {
  if (req.endpointMeta.requiresAuth) {
    // Perform authentication
  }
  await next();
});
\`\`\`

## Request Lifecycle

1. Incoming request
2. Route matching → \`req.endpointMeta\` populated
3. Middleware chain executes
4. Route handler executes
5. Response transformers (success)
6. Error handlers (if error)
7. Finalizers (always)
8. Response sent

## Adding Routes

1. Create route file in \`src/routes/\`
2. Export a mount function
3. Import and call in \`src/routes/index.ts\`

## Adding Middleware

1. Create middleware file in \`src/middleware/\`
2. Middleware should check \`req.endpointMeta\` for configuration
3. Export and register in \`src/index.ts\`

## Database Integration

Example with Prisma:

\`\`\`typescript
// src/db/index.ts
import { PrismaClient } from '@prisma/client';
export const db = new PrismaClient();

// src/routes/users.ts
import { db } from '../db';

app.get('/users', PUBLIC, async (req, res) => {
  const users = await db.user.findMany();
  res.json({ users });
});
\`\`\`

## Testing

Tests use Node's native test runner with test-battery for assertions.

Example:

\`\`\`typescript
import { describe, it } from 'node:test';
import { expect } from 'test-battery';

describe('Users API', () => {
  it('should list users', async () => {
    // Test implementation
  });
});
\`\`\`
`.replace(/\n{2,}/g, '\n\n');

    writeFileSync(resolve(projectPath, 'ARCHITECTURE.md'), architecture);

    spinner.succeed('Generated documentation');
    return true;
  } catch (error) {
    spinner.fail('Failed to generate documentation');
    console.error(error);
    return false;
  }
}

function installDependencies(projectPath: string, config: ProjectConfig) {
  if (!config.install) {
    return true;
  }

  const spinner = ora('Installing dependencies...').start();

  try {
    const commands: Record<string, string> = {
      npm: 'npm install',
      pnpm: 'pnpm install',
      yarn: 'yarn',
      bun: 'bun install'
    };

    execSync(commands[config.packageManager], {
      cwd: projectPath,
      stdio: 'pipe'
    });

    spinner.succeed('Installed dependencies');
    return true;
  } catch (error) {
    spinner.fail('Failed to install dependencies');
    console.error('\nYou can install dependencies manually by running:');
    console.error(chalk.cyan(`  cd ${config.name} && ${config.packageManager} install\n`));
    return false;
  }
}

function initializeGit(projectPath: string, config: ProjectConfig) {
  if (!config.git) {
    return true;
  }

  const spinner = ora('Initializing git repository...').start();

  try {
    execSync('git init', { cwd: projectPath, stdio: 'pipe' });
    execSync('git add .', { cwd: projectPath, stdio: 'pipe' });

    if (config.gitCommit) {
      execSync('git commit -m "feat: initial commit from create-filament"', {
        cwd: projectPath,
        stdio: 'pipe'
      });
      spinner.succeed('Initialized git repository with initial commit');
    } else {
      spinner.succeed('Initialized git repository');
    }

    return true;
  } catch (error) {
    spinner.fail('Failed to initialize git repository');
    return false;
  }
}

function printNextSteps(config: ProjectConfig) {
  console.log(chalk.green('\n🎉 Success! Created ' + config.name + '\n'));

  console.log('Next steps:\n');
  console.log(chalk.cyan('  cd ' + config.name));
  
  if (!config.install) {
    console.log(chalk.cyan(`  ${config.packageManager} install`));
  }

  console.log(chalk.cyan(`  ${config.packageManager} run dev`));

  console.log('\nYour app will be running at ' + chalk.cyan('http://localhost:3000'));

  console.log('\nCommands:');
  console.log(`  ${chalk.cyan(config.packageManager + ' run dev')}          Start development server`);
  console.log(`  ${chalk.cyan(config.packageManager + ' test')}             Run tests`);
  console.log(`  ${chalk.cyan(config.packageManager + ' run build')}        Build for production`);

  if (config.features.docker) {
    console.log(`  ${chalk.cyan(config.packageManager + ' run docker:build')} Build Docker image`);
  }

  console.log('\nDocumentation:');
  console.log('  README.md            Getting started guide');
  console.log('  ARCHITECTURE.md      Project structure explained');

  console.log(chalk.gray('\nHappy coding! 🔥\n'));
}

async function main() {
  printBanner();

  const args = process.argv.slice(2);
  const projectName = args[0];

  // Check if directory exists
  if (projectName && existsSync(projectName)) {
    console.error(chalk.red(`\n✖ Directory "${projectName}" already exists\n`));
    process.exit(1);
  }

  const config = await promptForConfig(projectName);
  const projectPath = resolve(process.cwd(), config.name);

  // Check again after prompts
  if (existsSync(projectPath)) {
    console.error(chalk.red(`\n✖ Directory "${config.name}" already exists\n`));
    process.exit(1);
  }

  // Execute all steps
  const steps = [
    () => createProjectStructure(projectPath, config),
    () => copyTemplateFiles(projectPath, config),
    () => generatePackageJson(projectPath, config),
    () => generateConfigFiles(projectPath, config),
    () => generateDockerFiles(projectPath, config),
    () => generateCIFiles(projectPath, config),
    () => generateREADME(projectPath, config),
    () => installDependencies(projectPath, config),
    () => initializeGit(projectPath, config)
  ];

  for (const step of steps) {
    if (!step()) {
      console.error(chalk.red('\n✖ Setup failed\n'));
      process.exit(1);
    }
  }

  printNextSteps(config);
}

main().catch((error) => {
  console.error(chalk.red('\n✖ An error occurred:\n'));
  console.error(error);
  process.exit(1);
});
