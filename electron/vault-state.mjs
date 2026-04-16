import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const DESKTOP_STATE_FILE = 'desktop-state.json'
const MAX_RECENT_VAULTS = 8
const VAULT_META_DIR = '.errata'
const STORIES_DIR_NAME = 'stories'

export function createVaultState(app) {
  function getGlobalDataDir() {
    return process.env.GLOBAL_DATA_DIR?.trim() || join(app.getPath('userData'), 'data')
  }

  function getDesktopStatePath() {
    return join(getGlobalDataDir(), DESKTOP_STATE_FILE)
  }

  function normalizeVaultPath(vaultPath) {
    return resolve(vaultPath)
  }

  function getVaultName(vaultPath) {
    const name = basename(vaultPath)
    return name || vaultPath
  }

  function normalizeRecentVaultPaths(recentVaultPaths, activeVaultPath = null) {
    const normalizedPaths = []
    const seen = new Set()

    for (const candidate of [activeVaultPath, ...(Array.isArray(recentVaultPaths) ? recentVaultPaths : [])]) {
      if (typeof candidate !== 'string' || candidate.trim().length === 0) {
        continue
      }

      const normalizedPath = normalizeVaultPath(candidate)
      if (seen.has(normalizedPath)) {
        continue
      }

      seen.add(normalizedPath)
      normalizedPaths.push(normalizedPath)

      if (normalizedPaths.length >= MAX_RECENT_VAULTS) {
        break
      }
    }

    return normalizedPaths
  }

  function getVaultSummaries(activeVaultPath, recentVaultPaths) {
    return normalizeRecentVaultPaths(recentVaultPaths, activeVaultPath).map((vaultPath) => ({
      path: vaultPath,
      name: getVaultName(vaultPath),
      isActive: vaultPath === activeVaultPath,
    }))
  }

  async function readDesktopState() {
    try {
      const raw = await readFile(getDesktopStatePath(), 'utf-8')
      const parsed = JSON.parse(raw)
      const activeVaultPath = typeof parsed.activeVaultPath === 'string' ? normalizeVaultPath(parsed.activeVaultPath) : null
      return {
        activeVaultPath,
        recentVaultPaths: normalizeRecentVaultPaths(parsed.recentVaultPaths, activeVaultPath),
      }
    } catch {
      return { activeVaultPath: null, recentVaultPaths: [] }
    }
  }

  async function writeDesktopState(state) {
    const activeVaultPath = typeof state.activeVaultPath === 'string' ? normalizeVaultPath(state.activeVaultPath) : null
    const recentVaultPaths = normalizeRecentVaultPaths(state.recentVaultPaths, activeVaultPath)

    await mkdir(getGlobalDataDir(), { recursive: true })
    await writeFile(getDesktopStatePath(), JSON.stringify({ activeVaultPath, recentVaultPaths }, null, 2), 'utf-8')
  }

  async function ensureVaultDirectories(vaultPath) {
    await mkdir(vaultPath, { recursive: true })
    await mkdir(join(vaultPath, VAULT_META_DIR), { recursive: true })
    await mkdir(join(vaultPath, STORIES_DIR_NAME), { recursive: true })
  }

  async function resolveActiveVaultPath() {
    const configuredVaultPath = process.env.ERRATA_ACTIVE_VAULT?.trim() || process.env.DATA_DIR?.trim()
    if (configuredVaultPath) {
      return normalizeVaultPath(configuredVaultPath)
    }

    const state = await readDesktopState()
    if (state.activeVaultPath) {
      return normalizeVaultPath(state.activeVaultPath)
    }

    return normalizeVaultPath(getGlobalDataDir())
  }

  async function persistActiveVaultPath(vaultPath) {
    const desktopState = await readDesktopState()
    const normalizedVaultPath = normalizeVaultPath(vaultPath)
    await ensureVaultDirectories(normalizedVaultPath)
    await writeDesktopState({
      activeVaultPath: normalizedVaultPath,
      recentVaultPaths: normalizeRecentVaultPaths(desktopState.recentVaultPaths, normalizedVaultPath),
    })
    return normalizedVaultPath
  }

  async function removeVaultFromRecents(vaultPath) {
    const desktopState = await readDesktopState()
    const normalizedVaultPath = normalizeVaultPath(vaultPath)

    await writeDesktopState({
      activeVaultPath: desktopState.activeVaultPath,
      recentVaultPaths: desktopState.recentVaultPaths.filter((candidate) => candidate !== normalizedVaultPath),
    })

    return normalizedVaultPath
  }

  function getDataDir() {
    return process.env.DATA_DIR?.trim() || getGlobalDataDir()
  }

  function getLogsDir() {
    return join(getGlobalDataDir(), 'logs')
  }

  function getConfigPath() {
    return join(getGlobalDataDir(), 'config.json')
  }

  function applyRuntimePaths(activeVaultPath, globalDataDir = getGlobalDataDir()) {
    process.env.GLOBAL_DATA_DIR = globalDataDir
    process.env.DATA_DIR = normalizeVaultPath(activeVaultPath)
  }

  async function configureRuntimePaths() {
    const globalDataDir = getGlobalDataDir()
    const activeVaultPath = await resolveActiveVaultPath()

    applyRuntimePaths(activeVaultPath, globalDataDir)
    await mkdir(globalDataDir, { recursive: true })
    await ensureVaultDirectories(activeVaultPath)
    app.setPath('sessionData', join(app.getPath('userData'), 'session'))
  }

  return {
    applyRuntimePaths,
    configureRuntimePaths,
    ensureVaultDirectories,
    getConfigPath,
    getDataDir,
    getGlobalDataDir,
    getLogsDir,
    getVaultName,
    getVaultSummaries,
    normalizeVaultPath,
    persistActiveVaultPath,
    readDesktopState,
    removeVaultFromRecents,
    resolveActiveVaultPath,
  }
}