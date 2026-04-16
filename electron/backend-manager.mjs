import { spawn } from 'node:child_process'
import { join } from 'node:path'

export function createBackendManager({
  app,
  appRoot,
  backendOrigin,
  backendUrl,
  isDev,
  rendererUrl,
  vaultState,
}) {
  let backendProcess = null
  let isSwitchingVault = false

  function getBundledServerEntry() {
    const bundledAppRoot = app.isPackaged ? app.getAppPath() : appRoot
    return join(bundledAppRoot, '.output', 'server', 'index.mjs')
  }

  function createBackendSpawnConfig() {
    const backendEnv = {
      ...process.env,
      HOST: backendUrl.hostname,
      PORT: backendUrl.port || '7739',
    }

    if (isDev) {
      return {
        command: process.env.ERRATA_NODE_BINARY || 'node',
        args: ['--import', 'tsx', 'src/server/standalone.ts'],
        cwd: appRoot,
        env: {
          ...backendEnv,
          ERRATA_APP_ROOT: appRoot,
          CORS_ORIGINS: rendererUrl,
        },
      }
    }

    return {
      command: process.execPath,
      args: [getBundledServerEntry()],
      cwd: process.resourcesPath,
      env: {
        ...backendEnv,
        ERRATA_APP_ROOT: process.resourcesPath,
        ELECTRON_RUN_AS_NODE: '1',
      },
    }
  }

  function waitForProcessExit(child) {
    return new Promise((resolveExit) => {
      if (!child || child.exitCode !== null || child.signalCode !== null) {
        resolveExit()
        return
      }

      child.once('exit', () => resolveExit())
    })
  }

  function forwardBackendStream(stream, target) {
    if (!stream) {
      return
    }

    stream.on('data', (chunk) => {
      target.write(chunk)
    })
  }

  async function terminateBackendProcess(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      return
    }

    if (process.platform === 'win32') {
      await new Promise((resolveKill) => {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
          stdio: 'ignore',
          windowsHide: true,
        })

        killer.once('exit', () => resolveKill())
        killer.once('error', () => resolveKill())
      })
      await waitForProcessExit(child)
      return
    }

    child.kill('SIGTERM')
    await Promise.race([
      waitForProcessExit(child),
      new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2_000)),
    ])

    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await waitForProcessExit(child)
    }
  }

  function isExpectedBackendExit(code, signal) {
    return app.isQuitting || isSwitchingVault || code === 0 || signal === 'SIGTERM'
  }

  function spawnBackend() {
    if (backendProcess) {
      return backendProcess
    }

    const spawnConfig = createBackendSpawnConfig()
    const backend = spawn(spawnConfig.command, spawnConfig.args, {
      cwd: spawnConfig.cwd,
      env: spawnConfig.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    forwardBackendStream(backend.stdout, process.stdout)
    forwardBackendStream(backend.stderr, process.stderr)

    backend.once('exit', (code, signal) => {
      backendProcess = null
      if (!isExpectedBackendExit(code, signal)) {
        console.error(`[electron] Backend exited unexpectedly (code=${code}, signal=${signal})`)
        app.quit()
      }
    })

    backendProcess = backend
    return backend
  }

  async function waitForUrl(url, label) {
    const deadline = Date.now() + 30_000

    while (Date.now() < deadline) {
      try {
        const response = await fetch(url)
        if (response.ok) {
          return
        }
      } catch {
        // Service is not ready yet.
      }

      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    throw new Error(`${label} did not become ready: ${url}`)
  }

  async function ensureBackendRunning() {
    spawnBackend()
    await waitForUrl(`${backendOrigin}/api/health`, 'Backend')
  }

  async function stopBackend() {
    const runningBackend = backendProcess
    if (!runningBackend) {
      return
    }

    await terminateBackendProcess(runningBackend)
  }

  async function switchBackendToVault(nextVaultPath) {
    const previousVaultPath = vaultState.getDataDir()
    const globalDataDir = vaultState.getGlobalDataDir()
    const normalizedNextVaultPath = vaultState.normalizeVaultPath(nextVaultPath)

    if (normalizedNextVaultPath === previousVaultPath) {
      return normalizedNextVaultPath
    }

    isSwitchingVault = true

    try {
      await vaultState.ensureVaultDirectories(normalizedNextVaultPath)
      await stopBackend()
      vaultState.applyRuntimePaths(normalizedNextVaultPath, globalDataDir)
      await ensureBackendRunning()
      await vaultState.persistActiveVaultPath(normalizedNextVaultPath)
      return normalizedNextVaultPath
    } catch (error) {
      try {
        await stopBackend()
        vaultState.applyRuntimePaths(previousVaultPath, globalDataDir)
        await ensureBackendRunning()
      } catch (rollbackError) {
        console.error('[electron] Failed to restore previous backend after vault switch failure', rollbackError)
      }

      throw error
    } finally {
      isSwitchingVault = false
    }
  }

  return {
    ensureBackendRunning,
    stopBackend,
    switchBackendToVault,
  }
}