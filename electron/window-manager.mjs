export function createWindowManager({
  app,
  BrowserWindow,
  dialog,
  appUrl,
  preloadPath,
  appIconPath,
  configureRuntimePaths,
  ensureBackendRunning,
  isAppUrl,
  openExternalUrl,
}) {
  let mainWindow = null
  let mainWindowPromise = null

  function getMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return null
    }

    return mainWindow
  }

  function focusMainWindow() {
    const window = getMainWindow()
    if (!window) {
      return
    }

    if (window.isMinimized()) {
      window.restore()
    }

    window.focus()
  }

  function attachNavigationGuards(window) {
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (!isAppUrl(url)) {
        try {
          void openExternalUrl(url)
        } catch {
          // Non-app navigation stays blocked even when it is not a safe external URL.
        }
      }

      return { action: 'deny' }
    })

    window.webContents.on('will-navigate', (event, url) => {
      if (!isAppUrl(url)) {
        event.preventDefault()
        try {
          void openExternalUrl(url)
        } catch {
          // Non-app navigation stays blocked even when it is not a safe external URL.
        }
      }
    })
  }

  async function createMainWindow() {
    const existingWindow = getMainWindow()
    if (existingWindow) {
      focusMainWindow()
      return existingWindow
    }

    if (mainWindowPromise) {
      return mainWindowPromise
    }

    mainWindowPromise = (async () => {
      await configureRuntimePaths()
      await ensureBackendRunning()

      const window = new BrowserWindow({
        width: 1560,
        height: 960,
        minWidth: 1200,
        minHeight: 760,
        icon: appIconPath,
        backgroundColor: '#0f1412',
        show: false,
        webPreferences: {
          sandbox: false,
          preload: preloadPath,
        },
      })

      mainWindow = window
      attachNavigationGuards(window)

      window.once('ready-to-show', () => {
        window.show()
      })

      window.on('closed', () => {
        if (mainWindow === window) {
          mainWindow = null
        }
      })

      window.webContents.on('render-process-gone', (_event, details) => {
        console.error('[electron] Renderer process exited', details)
        if (!app.isQuitting) {
          dialog.showErrorBox('Errata renderer exited', `The renderer process exited (${details.reason}). Errata will close.`)
          app.quit()
        }
      })

      await window.loadURL(appUrl)
      return window
    })()

    try {
      return await mainWindowPromise
    } finally {
      mainWindowPromise = null
    }
  }

  return {
    createMainWindow,
    focusMainWindow,
    getMainWindow,
  }
}