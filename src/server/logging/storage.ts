import type { LogEntry, LogSummary } from './types'
import { getStorageBackend } from '../storage/runtime'
import * as logFiles from './log-files'

/**
 * Save a log entry to the application log file.
 * Uses rotating log files to prevent unbounded growth.
 */
export async function saveLogEntry(dataDir: string, entry: LogEntry): Promise<void> {
  const storage = getStorageBackend()
  const dir = logFiles.getLogFilesDir(dataDir)
  await storage.ensureDir(dir)

  let currentIndex = await logFiles.resolveWritableLogFileIndex(storage, dataDir)

  if (currentIndex >= logFiles.MAX_LOG_FILES) {
    currentIndex = await logFiles.rotateLogFiles(storage, dataDir)
  }

  await logFiles.appendLogEntry(storage, dataDir, currentIndex, entry)
}

/**
 * List recent log entries with optional filtering.
 */
export async function listLogs(
  dataDir: string,
  options: {
    level?: 'debug' | 'info' | 'warn' | 'error'
    component?: string
    storyId?: string
    limit?: number
  } = {}
): Promise<LogSummary[]> {
  const storage = getStorageBackend()
  const { level, component, storyId, limit = 100 } = options
  const logEntries = await logFiles.readParsedLogEntries(storage, dataDir, Array.from({ length: logFiles.MAX_LOG_FILES }, (_, i) => logFiles.MAX_LOG_FILES - 1 - i))

  const entries = logEntries
    .filter((entry) => !level || entry.level === level)
    .filter((entry) => !component || entry.component === component)
    .filter((entry) => !storyId || entry.storyId === storyId)
    .map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      level: entry.level,
      component: entry.component,
      message: entry.message,
      storyId: entry.storyId,
    }))

  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return entries.slice(0, limit)
}

/**
 * Get a specific log entry by ID.
 */
export async function getLogEntry(dataDir: string, logId: string): Promise<LogEntry | null> {
  const storage = getStorageBackend()
  return (await logFiles.readParsedLogEntries(storage, dataDir, Array.from({ length: logFiles.MAX_LOG_FILES }, (_, i) => i)))
    .find((entry) => entry.id === logId) ?? null
}

/**
 * Clear all application logs.
 */
export async function clearLogs(dataDir: string): Promise<void> {
  const storage = getStorageBackend()
  const dir = logFiles.getLogFilesDir(dataDir)
  const entries = await storage.listDir(dir)
  for (const entry of entries) {
    if (!logFiles.isAppLogFileName(entry)) continue

    const index = logFiles.parseAppLogFileIndex(entry)
    if (index === null) continue
    await storage.writeText(logFiles.getLogFilePath(dataDir, index), '')
  }
}
