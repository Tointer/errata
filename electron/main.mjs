import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createVaultState } from './vault-state.mjs'
import { createBackendManager } from './backend-manager.mjs'
import { createWindowManager } from './window-manager.mjs'
import { registerDesktopHandlers } from './ipc-handlers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')
const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? null
const isDev = Boolean(rendererUrl)
const backendOrigin = process.env.ERRATA_API_ORIGIN ?? 'http://127.0.0.1:7739'
const backendUrl = new URL(backendOrigin)
const appUrl = rendererUrl ?? backendOrigin
const preloadPath = join(__dirname, 'preload.mjs')
const appIconPath = join(appRoot, 'public', 'favicon.ico')

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

function isAppUrl(urlString) {
  try {
    return new URL(urlString).origin === new URL(appUrl).origin
  } catch {
    return false
  }
}

function openExternalUrl(urlString) {
  try {
    const candidate = new URL(urlString)
    if (!['http:', 'https:', 'mailto:'].includes(candidate.protocol)) {
      throw new Error(`Blocked external URL: ${urlString}`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Blocked external URL:')) {
      throw error
    }

    throw new Error(`Blocked external URL: ${urlString}`)
  }

  return shell.openExternal(urlString)
}

const vaultState = createVaultState(app)
const backendManager = createBackendManager({
  app,
  appRoot,
  backendOrigin,
  backendUrl,
  isDev,
  rendererUrl,
  vaultState,
})
const windowManager = createWindowManager({
  app,
  BrowserWindow,
  dialog,
  appUrl,
  preloadPath,
  appIconPath,
  configureRuntimePaths: vaultState.configureRuntimePaths,
  ensureBackendRunning: backendManager.ensureBackendRunning,
  isAppUrl,
  openExternalUrl,
})

function handleLaunchError(error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[electron] Failed to launch window', error)

  if (app.isReady()) {
    dialog.showErrorBox('Errata failed to start', message)
  }

  app.quit()
}

app.on('second-instance', () => {
  windowManager.focusMainWindow()
})

app.on('before-quit', () => {
  app.isQuitting = true
  void backendManager.stopBackend()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await windowManager.createMainWindow()
    return
  }

  windowManager.focusMainWindow()
})

app.whenReady()
  .then(() => {
    Menu.setApplicationMenu(null)
    registerDesktopHandlers({
      app,
      ipcMain,
      BrowserWindow,
      dialog,
      shell,
      vaultState,
      backendManager,
      windowManager,
      openExternalUrl,
      backendOrigin,
      isDev,
    })
    return windowManager.createMainWindow()
  })
  .catch(handleLaunchError)

process.once('SIGINT', () => {
  backendManager.stopBackend()
  app.quit()
})

process.once('SIGTERM', () => {
  backendManager.stopBackend()
  app.quit()
})
