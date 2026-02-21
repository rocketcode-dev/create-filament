# create-filament

Scaffold a new Filament application with best practices built-in.

## Usage

```bash
# Interactive mode

npm create filament@latest

# With project name

npm create filament@latest my-api

# Non-interactive with options

npm create filament@latest my-api --template=full --docker --ci=github
```

## Templates

### Minimal

Core framework with essential tooling:

- ✅ Filament framework
- ✅ TypeScript with strict mode
- ✅ ESLint + Prettier
- ✅ Husky + lint-staged + commitlint
- ✅ Pino logging
- ✅ Node test runner + test-battery
- ✅ Example endpoints
- ✅ Graceful shutdown handling

### API

Everything in Minimal plus:

- ✅ JWT authentication middleware
- ✅ OAuth middleware examples
- ✅ Role-based access control (RBAC)
- ✅ Session management (Redis-backed)
- ✅ Rate limiting (Redis-backed)
- ✅ OpenAPI/Swagger generation
- ✅ Request validation examples
- ✅ Docker + Docker Compose (app + Redis)

### Full

Everything in API plus:

- ✅ OpenTelemetry distributed tracing
- ✅ Prometheus metrics endpoint
- ✅ Analytics event collection
- ✅ Complete CI/CD pipeline (GitHub Actions)
- ✅ Production-ready Docker setup
- ✅ More comprehensive examples

## Command-Line Options

```bash
Options:
  --template=<minimal|api|full>  Choose template (default: interactive)
  --docker                       Include Dockerfile
  --docker-compose              Include docker-compose.yml
  --ci=<github|gitlab|none>     CI/CD workflow
  --pm=<npm|pnpm|yarn|bun>      Package manager (default: npm)
  --git                          Initialize git repository
  --no-git-commit               Skip initial commit

  --no-install                  Skip dependency installation
```

## What Gets Generated

### Project Structure

```text
my-api/
├── src/
│   ├── meta/           # Metadata interface and defaults
│   │   ├── index.ts    # AppMeta interface definition
│   │   └── defaults.ts # Default metadata + presets
│   ├── middleware/     # Middleware functions
│   │   └── index.ts    # Middleware registration
│   ├── routes/         # Route definitions
│   │   └── index.ts    # Route registration
│   ├── handlers/       # Post-request handlers
│   │   ├── errors.ts   # Error handlers
│   │   ├── transforms.ts # Response transformers
│   │   └── finalizers.ts # Finalizers (always run)
│   ├── config/         # Application configuration
│   │   └── app.ts      # App config + validation
│   └── index.ts        # Entry point
├── tests/
│   ├── integration/    # Integration tests
│   └── unit/          # Unit tests
├── .github/
│   └── workflows/
│       └── ci.yml      # CI/CD pipeline (if --ci=github)
├── .husky/             # Git hooks
│   ├── pre-commit      # Runs lint-staged
│   └── commit-msg      # Runs commitlint
├── Dockerfile          # Multi-stage Docker build (if --docker)
├── docker-compose.yml  # Local dev environment (if --docker-compose)
├── .dockerignore
├── .gitignore
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── .lintstagedrc
├── commitlint.config.js
├── tsconfig.json
├── package.json
├── README.md
└── ARCHITECTURE.md
```

### Quality Management Tools

Every generated project includes:

**Linting & Formatting:**

- ESLint with TypeScript support
- Prettier for code formatting
- Pre-commit hooks to enforce quality

**Git Hygiene:**

- Husky for git hooks
- lint-staged (run linters only on staged files)
- commitlint (enforce conventional commits)

**Testing:**

- Node.js native test runner
- test-battery for assertions
- Test coverage reporting

**Dependency Management:**

- depcheck to find unused dependencies
- Configured in package.json scripts

**Type Safety:**

- TypeScript strict mode
- Path aliases configured (@/\* → src/\*)

## Generated Scripts

```json
{
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "node --test tests/**/*.test.ts",
  "test:watch": "node --test --watch tests/**/*.test.ts",
  "lint": "eslint src/**/*.ts",
  "lint:fix": "eslint src/**/*.ts --fix",
  "format": "prettier --write src/**/*.ts",
  "type-check": "tsc --noEmit",
  "depcheck": "depcheck",
  "docker:build": "docker build -t <name> .",
  "docker:run": "docker run -p 3000:3000 <name>",
  "docker:up": "docker-compose up",
  "docker:down": "docker-compose down"
}
```

## Environment Variables

Generated `.env.example`:

```bash
# Server

PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Authentication (API+ templates)

JWT_SECRET=your-secret-here
JWT_EXPIRY=7d
REDIS_URL=redis://localhost:6379

# OpenTelemetry (Full template)

OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Docker Support

### Dockerfile Features

- Multi-stage build (builder + runtime)
- Minimal Alpine Linux base image
- Non-root user for security
- Health check built-in
- Optimized layer caching

### docker-compose.yml

Includes services based on template:

- **app**: Your Filament application
- **redis**: For sessions, caching, rate limiting (API+)

## CI/CD

### GitHub Actions

Generated CI workflow runs on every push/PR:

1. Install dependencies
2. Run linter
3. Run type checker
4. Run tests
5. Run depcheck
6. Build project
7. Build Docker image (if enabled)

## Database Integration

Filament doesn't include a database ORM by design. The generated README includes examples for:

- Prisma
- Drizzle
- Kysely
- Raw SQL with node-postgres

## Development Experience

### First Run

```bash
cd my-api
npm install  # if not already run
npm run dev
```

Output:

```text
🔥 Filament server running on http://localhost:3000
   Environment: development
   Log level: info
```

### Hot Reload

Uses `tsx watch` for instant restarts on file changes.

### Logging

Structured JSON logging with Pino:

- Beautiful formatting in development (pino-pretty)
- JSON output in production
- Configurable log levels per endpoint

## Metadata-Driven Architecture

The scaffold teaches Filament's metadata-driven approach from the start:

### Metadata Interface

```typescript
export interface AppMeta extends FrameworkMeta {
  requiresAuth: boolean;
  rateLimit: number;
  logging: { level: string };
  tags: string[];
}
```

### Metadata Presets

```typescript
export const PUBLIC = { requiresAuth: false, rateLimit: 100 };
export const AUTHENTICATED = { requiresAuth: true, rateLimit: 50 };
```

### Usage in Routes

```typescript
app.get('/users', PUBLIC, handler);
app.post('/admin', AUTHENTICATED, handler);
```

### Middleware Checks Metadata

```typescript
app.use(async (req, res, next) => {
  if (req.endpointMeta.requiresAuth) {
    // Perform authentication
  }
  await next();
});
```

## Post-Request Handlers

Every template includes examples of:

### Error Handlers

```typescript
app.onError(async (err, req, res) => {
  logger.error({ error: err.message });
  res.status(500).json({ error: 'Internal Server Error' });
});
```

### Response Transformers

```typescript
app.onTransform(async (req, res) => {
  if (req.endpointMeta.tags.includes('api')) {
    res.setHeader('X-API-Version', '1.0');
  }
});
```

### Finalizers

```typescript
app.onFinalize(async (req, res) => {
  const duration = Date.now() - req._startTime;
  logger.info({ duration, status: res.statusCode });
});
```

## Graceful Shutdown

All templates include proper signal handling:

```typescript
process.on('SIGTERM', async () => {
  await app.close();
  process.exit(0);
});
```

## Best Practices Built-In

1. **Type Safety**: Strict TypeScript configuration
2. **Code Quality**: ESLint + Prettier + pre-commit hooks
3. **Git Hygiene**: Conventional commits enforced
4. **Testing**: Node test runner ready to use
5. **Security**: Non-root Docker user, helmet headers
6. **Observability**: Structured logging, request IDs
7. **Performance**: Rate limiting, caching patterns
8. **Maintainability**: Clear separation of concerns

## Extending Your Project

### Adding a New Route

1. Create route file in `src/routes/<name>.ts`
2. Export a registration function
3. Import and call in `src/routes/index.ts`

### Adding Middleware

1. Create middleware file in `src/middleware/<name>.ts`
2. Check `req.endpointMeta` for configuration
3. Register in `src/middleware/index.ts`

### Adding Metadata Fields

1. Add to `AppMeta` interface in `src/meta/index.ts`
2. Update `defaultMeta` in `src/meta/defaults.ts`
3. Create presets for common combinations

## Requirements

- Node.js 20+
- npm, pnpm, yarn, or bun
- Docker (optional, for containerization)

## Development

```bash
# Clone create-filament repo

git clone https://github.com/rocketcode-dev/create-filament

# Install dependencies

npm install

# Build CLI

npm run build

# Test locally

node dist/index.js my-test-app
```

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

ISC

## Related

- [Filament](https://github.com/rocketcode-dev/filament) - The framework
- [Filament Examples](https://github.com/rocketcode-dev/filament/tree/main/examples)
- [Documentation](https://filament.dev)
