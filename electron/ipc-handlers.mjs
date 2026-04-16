import { writeFile } from 'node:fs/promises'

const allowedOpenDialogProperties = new Set([
  'openFile',
  'openDirectory',
  'multiSelections',
  'showHiddenFiles',
  'createDirectory',
  'promptToCreate',
  'dontAddToRecent',
  'noResolveAliases',
  'treatPackageAsDirectory',
])

function sanitizeDialogFilters(filters) {
  if (!Array.isArray(filters)) {
    return undefined
  }

  return filters
    .filter((filter) => filter && typeof filter.name === 'string' && Array.isArray(filter.extensions))
    .map((filter) => ({
      name: filter.name,
      extensions: filter.extensions.filter((extension) => typeof extension === 'string' && extension.trim().length > 0),
    }))
    .filter((filter) => filter.extensions.length > 0)
}

function sanitizeOpenDialogOptions(options = {}) {
  return {
    title: typeof options.title === 'string' ? options.title : undefined,
    defaultPath: typeof options.defaultPath === 'string' ? options.defaultPath : undefined,
    buttonLabel: typeof options.buttonLabel === 'string' ? options.buttonLabel : undefined,
    message: typeof options.message === 'string' ? options.message : undefined,
    filters: sanitizeDialogFilters(options.filters),
    properties: Array.isArray(options.properties)
      ? options.properties.filter((property) => allowedOpenDialogProperties.has(property))
      : undefined,
  }
}

function sanitizeSaveDialogOptions(options = {}) {
  return {
    title: typeof options.title === 'string' ? options.title : undefined,
    defaultPath: typeof options.defaultPath === 'string' ? options.defaultPath : undefined,
    buttonLabel: typeof options.buttonLabel === 'string' ? options.buttonLabel : undefined,
    message: typeof options.message === 'string' ? options.message : undefined,
    filters: sanitizeDialogFilters(options.filters),
  }
}

function normalizeFileContent(content) {
  if (typeof content === 'string') {
    return content
  }

  if (ArrayBuffer.isView(content)) {
    return Buffer.from(content.buffer, content.byteOffset, content.byteLength)
  }

  if (content instanceof ArrayBuffer) {
    return Buffer.from(content)
  }

  throw new Error('Unsupported file content payload.')
}

function assertNonEmptyString(value, message) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message)
  }
}

export function registerDesktopHandlers({
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
}) {
  function resolveOwnerWindow(webContents) {
    return BrowserWindow.fromWebContents(webContents) ?? windowManager.getMainWindow() ?? undefined
  }

  ipcMain.handle('desktop:get-runtime-info', async () => {
    const desktopState = await vaultState.readDesktopState()
    const activeVaultPath = vaultState.getDataDir()

    return {
      platform: process.platform,
      apiOrigin: backendOrigin,
      isDev,
      appVersion: app.getVersion(),
      globalDataDir: vaultState.getGlobalDataDir(),
      dataDir: activeVaultPath,
      logsDir: vaultState.getLogsDir(),
      configPath: vaultState.getConfigPath(),
      vaultPath: activeVaultPath,
      vaultName: vaultState.getVaultName(activeVaultPath),
      recentVaults: vaultState.getVaultSummaries(activeVaultPath, desktopState.recentVaultPaths),
    }
  })

  ipcMain.handle('desktop:open-external', async (_event, urlString) => {
    await openExternalUrl(urlString)
    return { ok: true }
  })

  ipcMain.handle('desktop:open-path', async (_event, targetPath) => {
    assertNonEmptyString(targetPath, 'A target path is required.')

    const openResult = await shell.openPath(vaultState.normalizeVaultPath(targetPath))
    if (openResult) {
      throw new Error(openResult)
    }

    return { ok: true }
  })

  ipcMain.handle('desktop:remove-vault-from-recents', async (_event, targetPath) => {
    assertNonEmptyString(targetPath, 'A vault path is required.')

    await vaultState.removeVaultFromRecents(targetPath)
    return { ok: true }
  })

  ipcMain.handle('desktop:choose-vault', async (event, options = {}) => {
    const owner = resolveOwnerWindow(event.sender)
    let nextVaultPath = typeof options?.vaultPath === 'string' && options.vaultPath.trim().length > 0
      ? vaultState.normalizeVaultPath(options.vaultPath)
      : null

    if (!nextVaultPath) {
      const result = await dialog.showOpenDialog(owner, {
        title: 'Choose your Errata vault',
        buttonLabel: 'Use this folder',
        properties: ['openDirectory', 'createDirectory'],
      })

      if (result.canceled || !result.filePaths[0]) {
        return { canceled: true, switched: false, vaultPath: null, vaultName: null }
      }

      nextVaultPath = vaultState.normalizeVaultPath(result.filePaths[0])
    }

    if (nextVaultPath === vaultState.getDataDir()) {
      return { canceled: false, switched: false, vaultPath: nextVaultPath, vaultName: vaultState.getVaultName(nextVaultPath) }
    }

    await backendManager.switchBackendToVault(nextVaultPath)

    return { canceled: false, switched: true, vaultPath: nextVaultPath, vaultName: vaultState.getVaultName(nextVaultPath) }
  })

  ipcMain.handle('desktop:show-open-dialog', async (event, options) => {
    return dialog.showOpenDialog(resolveOwnerWindow(event.sender), sanitizeOpenDialogOptions(options))
  })

  ipcMain.handle('desktop:save-file', async (event, options = {}) => {
    const owner = resolveOwnerWindow(event.sender)
    const { content, ...dialogOptions } = options
    const saveResult = await dialog.showSaveDialog(owner, sanitizeSaveDialogOptions(dialogOptions))

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true, filePath: null }
    }

    await writeFile(saveResult.filePath, normalizeFileContent(content))
    return { canceled: false, filePath: saveResult.filePath }
  })
}