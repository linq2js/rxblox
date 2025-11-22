# Build Configuration Fix

## Problem

The package declared sub-exports in `package.json` but only built the main entry point:
- ❌ `dist/react/index.js` was missing (only `.d.ts` existed)
- ❌ `dist/immer/index.js` was missing (only `.d.ts` existed)
- ✅ `dist/rextive.js` existed

This caused import errors:
```
Module not found: Error: Can't resolve 'rextive/react'
```

## Root Cause

**vite.config.ts** only configured a single entry point:
```typescript
// ❌ OLD - Single entry
build: {
  lib: {
    entry: resolve(__dirname, "src/index.ts"),
    // ...
  }
}
```

## Solution

### 1. Configure Multiple Entry Points

Updated **vite.config.ts** to build all sub-exports:

```typescript
// ✅ NEW - Multiple entries
build: {
  lib: {
    entry: {
      rextive: resolve(__dirname, "src/index.ts"),
      "react/index": resolve(__dirname, "src/react/index.ts"),
      "immer/index": resolve(__dirname, "src/immer/index.ts"),
    },
    formats: ["es"], // ESM only (modern approach)
  },
  rollupOptions: {
    output: {
      entryFileNames: (chunkInfo) => {
        if (chunkInfo.name === "rextive") {
          return "rextive.js";
        }
        return "[name].js"; // Preserves path: react/index.js, immer/index.js
      },
    },
  },
}
```

### 2. Modernize Package Exports

Updated **package.json** to use ESM-only exports:

```json
{
  "type": "module",
  "main": "./dist/rextive.js",
  "module": "./dist/rextive.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/rextive.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "default": "./dist/react/index.js"
    },
    "./immer": {
      "types": "./dist/immer/index.d.ts",
      "default": "./dist/immer/index.js"
    }
  }
}
```

**Changes:**
- ❌ Removed UMD build (`rextive.umd.js`)
- ✅ ESM-only (modern, better tree-shaking)
- ✅ Simplified exports with `"default"` condition

## Build Output

### Before
```
dist/
  ├── rextive.js ✅
  ├── rextive.umd.js ✅
  ├── index.d.ts ✅
  ├── react/
  │   ├── index.d.ts ✅
  │   └── index.js ❌ MISSING!
  └── immer/
      ├── index.d.ts ✅
      └── index.js ❌ MISSING!
```

### After
```
dist/
  ├── rextive.js ✅
  ├── index.d.ts ✅
  ├── react/
  │   ├── index.d.ts ✅
  │   └── index.js ✅ FIXED!
  └── immer/
      ├── index.d.ts ✅
      └── index.js ✅ FIXED!
```

## Verification

```bash
# Rebuild
npm run build

# Check outputs
ls -la dist/
ls -la dist/react/
ls -la dist/immer/

# Test imports
node -e "import('rextive').then(console.log)"
node -e "import('rextive/react').then(console.log)"
node -e "import('rextive/immer').then(console.log)"
```

## Breaking Changes

### Removed UMD Support

If you were using UMD imports:
```html
<!-- ❌ OLD: UMD (no longer supported) -->
<script src="node_modules/rextive/dist/rextive.umd.js"></script>
```

**Migration:**
```html
<!-- ✅ NEW: Use ESM -->
<script type="module">
  import { signal } from 'rextive';
</script>
```

Or use a bundler (Vite, Webpack, etc.) which handles ESM automatically.

### Why Remove UMD?

1. **Modern Standard**: ESM is the standard module format
2. **Better Tree-Shaking**: Bundlers can eliminate dead code
3. **Smaller Bundles**: No dual format overhead
4. **Simplified Build**: Easier to maintain
5. **Industry Trend**: Most modern libraries are ESM-only

## Impact

- ✅ **No impact** if using modern bundlers (Vite, Webpack 5+, Rollup)
- ✅ **No impact** if using Node.js 14+ with ESM
- ⚠️ **Breaking** if using UMD directly in browsers
- ⚠️ **Breaking** if using CommonJS `require()` (migrate to ESM)

## Future Considerations

If UMD support is needed, we can:
1. Keep separate UMD build for main entry only
2. Use different build tool for UMD (Rollup + Vite hybrid)
3. Generate UMD from ESM using a post-build step

For now, **ESM-only is recommended** for modern development.

