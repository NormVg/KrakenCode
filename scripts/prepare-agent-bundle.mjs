/**
 * Pre-build script: copies the agent directory and its runtime dependencies
 * into resources/ so they get bundled by electron-builder's extraResources.
 *
 * pnpm uses symlinks for node_modules, which electron-builder cannot pack
 * directly. This script resolves them and copies real files.
 *
 * Run automatically before `build:mac`, `build:win`, `build:linux`.
 */

import { cpSync, mkdirSync, existsSync, rmSync, readlinkSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const resourcesDir = join(projectRoot, 'resources')

/** Resolve a pnpm symlink to its real path. */
function resolveSymlink(p) {
  try {
    const link = readlinkSync(p)
    const resolved = resolve(dirname(p), link)
    return resolved
  } catch {
    return p
  }
}

/** Copy a directory, excluding unnecessary files. */
function copyDir(src, dest, exclude = []) {
  if (!existsSync(src)) {
    console.warn(`  [warn] Source not found: ${src}`)
    return
  }
  const realSrc = resolveSymlink(src)
  cpSync(realSrc, dest, {
    recursive: true,
    filter: (source) => {
      const rel = source.slice(realSrc.length)
      return !exclude.some((pattern) => {
        if (pattern.startsWith('*.')) {
          return source.endsWith(pattern.slice(1))
        }
        return rel.includes(pattern)
      })
    }
  })
}

console.log('[prepare-agent-bundle] Staging agent + dependencies into resources/')

// ─── Clean previous staging ──────────────────────────────────────────────────
const stagedNodeModules = join(resourcesDir, 'node_modules')
if (existsSync(stagedNodeModules)) {
  rmSync(stagedNodeModules, { recursive: true })
}
const stagedAgent = join(resourcesDir, 'agent')
if (existsSync(stagedAgent)) {
  rmSync(stagedAgent, { recursive: true })
}

// ─── Copy agent directory (source + eve cache, no node_modules) ─────────────
console.log('[prepare-agent-bundle] Copying agent/ → resources/agent/')
copyDir(
  join(projectRoot, 'agent'),
  stagedAgent,
  ['node_modules', '.DS_Store']
)

// ─── Copy eve ────────────────────────────────────────────────────────────────
console.log('[prepare-agent-bundle] Copying eve → resources/node_modules/eve/')
copyDir(
  join(projectRoot, 'node_modules', 'eve'),
  join(stagedNodeModules, 'eve'),
  ['docs', 'CHANGELOG.md', 'LICENSE', 'NOTICE', 'README.md', '.DS_Store']
)

// ─── Copy ai ─────────────────────────────────────────────────────────────────
console.log('[prepare-agent-bundle] Copying ai → resources/node_modules/ai/')
copyDir(
  join(projectRoot, 'node_modules', 'ai'),
  join(stagedNodeModules, 'ai'),
  ['.DS_Store']
)

// ─── Copy ai-sdk-ollama ──────────────────────────────────────────────────────
console.log('[prepare-agent-bundle] Copying ai-sdk-ollama → resources/node_modules/ai-sdk-ollama/')
copyDir(
  join(projectRoot, 'node_modules', 'ai-sdk-ollama'),
  join(stagedNodeModules, 'ai-sdk-ollama'),
  ['.DS_Store']
)

// ─── Copy zod (required by ai and eve at runtime) ────────────────────────────
const zodPath = join(projectRoot, 'node_modules', 'zod')
if (existsSync(zodPath)) {
  console.log('[prepare-agent-bundle] Copying zod → resources/node_modules/zod/')
  copyDir(zodPath, join(stagedNodeModules, 'zod'), ['.DS_Store'])
}

// ─── Copy eve's transitive runtime deps that are NOT bundled by eve itself ───
// eve bundles most deps in its dist/, but some are external:
// - better-sqlite3 (native module, already rebuilt by electron-rebuild)
// - dotenv
// - drizzle-orm
const transitiveDeps = ['better-sqlite3', 'dotenv', 'drizzle-orm']
for (const dep of transitiveDeps) {
  const depPath = join(projectRoot, 'node_modules', dep)
  if (existsSync(depPath)) {
    console.log(`[prepare-agent-bundle] Copying ${dep} → resources/node_modules/${dep}/`)
    copyDir(depPath, join(stagedNodeModules, dep), ['.DS_Store', 'docs'])
  }
}

console.log('[prepare-agent-bundle] Done. resources/ is ready for packaging.')
