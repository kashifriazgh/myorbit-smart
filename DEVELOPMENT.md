# Development Performance Optimization

This project includes several optimized development scripts to improve build times and reduce file watching overhead.

## Available Development Scripts

### Standard Development

```bash
npm run dev              # Standard Next.js development server
npm run dev:clean        # Clean and start development server
npm run dev:fast         # Fast development with turbo on port 3001
npm run dev:turbo        # Development with turbo mode
```

### Selective Development (Recommended for Performance)

```bash
# Watch only specific directories
npm run dev:selective           # Watch components, lib, and main page
npm run dev:components-only     # Watch only app/components directory
npm run dev:lib-only           # Watch only app/lib directory
npm run dev:pages-only         # Watch only app directory

# Custom selective watching
node scripts/dev-selective.js app/components app/lib app/page.tsx
```

## Performance Optimizations

### 1. File Watching Optimizations

- **Ignored Directories**: The development server now ignores unnecessary directories like `node_modules`, `.git`, `.next`, `public`, etc.
- **Watchman Configuration**: Uses `.watchmanconfig` for optimized file watching
- **Development Ignore**: Uses `.devignore` file to exclude files from development watching

### 2. Next.js Configuration Optimizations

- **Disabled Source Maps**: Faster builds in development
- **Optimized Webpack**: Custom watch options with polling and aggregation
- **Package Import Optimization**: Optimized imports for MUI components
- **Turbo Mode**: Uses Next.js turbo for faster builds

### 3. Environment Optimizations

- **Disabled ESLint**: Faster builds by skipping ESLint in development
- **Disabled Telemetry**: Reduces overhead
- **Custom Watch Options**: Optimized polling and aggregation timeouts

## Usage Recommendations

### For Component Development

```bash
npm run dev:components-only
```

This is ideal when you're primarily working on React components.

### For Library/Utility Development

```bash
npm run dev:lib-only
```

Use this when working on utility functions, contexts, or database operations.

### For Full App Development

```bash
npm run dev:selective
```

This provides a good balance between performance and functionality.

### For Maximum Performance

```bash
npm run dev:fast
```

Uses turbo mode on a different port for maximum speed.

## File Structure Impact

The optimizations focus on watching only essential directories:

- `app/components/` - React components
- `app/lib/` - Utility functions and contexts
- `app/page.tsx` - Main application entry point

Files ignored during development:

- Documentation files (`.md`)
- Build artifacts (`.next/`, `dist/`, `build/`)
- Dependencies (`node_modules/`)
- Logs and temporary files
- Editor configuration files

## Troubleshooting

If you encounter issues with selective watching:

1. **Missing Changes**: If changes aren't reflected, try the full development server:

   ```bash
   npm run dev
   ```

2. **Performance Issues**: Ensure you're using the turbo mode:

   ```bash
   npm run dev:turbo
   ```

3. **Custom Watching**: For specific directories, use the custom script:
   ```bash
   node scripts/dev-selective.js path/to/directory
   ```

## Configuration Files

- `.watchmanconfig` - Watchman file watching configuration
- `.devignore` - Files to ignore during development
- `next.config.ts` - Next.js configuration with optimizations
- `scripts/dev-selective.js` - Custom development script
