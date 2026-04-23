import type { LogEntry, LogSummary } from './types'
import { getStorageBackend } from '../storage/runtime'
import {
  appendLogEntry,
  getLogFilePath,
  getLogFilesDir,
  isAppLogFileName,
  parseAppLogFileIndex,
  readParsedLogEntries,
  resolveWritableLogFileIndex,
  rotateLogFiles,
  MAX_LOG_FILES,
} from './log-files'

/**
 * Save a log entry to the application log file.
 * Uses rotating log files to prevent unbounded growth.
 */
export async function saveLogEntry(dataDir: string, entry: LogEntry): Promise<void> {
  const storage = getStorageBackend()
  const dir = getLogFilesDir(dataDir)
  await storage.ensureDir(dir)

  let currentIndex = await resolveWritableLogFileIndex(storage, dataDir)

  if (currentIndex >= MAX_LOG_FILES) {
    currentIndex = await rotateLogFiles(storage, dataDir)
  }

  await appendLogEntry(storage, dataDir, currentIndex, entry)
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
  const logEntries = await readParsedLogEntries(storage, dataDir, Array.from({ length: MAX_LOG_FILES }, (_, i) => MAX_LOG_FILES - 1 - i))

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
  return (await readParsedLogEntries(storage, dataDir, Array.from({ length: MAX_LOG_FILES }, (_, i) => i)))
    .find((entry) => entry.id === logId) ?? null
}

/**
 * Clear all application logs.
 */
export async function clearLogs(dataDir: string): Promise<void> {
  const storage = getStorageBackend()
  const dir = getLogFilesDir(dataDir)
  const entries = await storage.listDir(dir)
  for (const entry of entries) {
    if (!isAppLogFileName(entry)) continue

    const index = parseAppLogFileIndex(entry)
    if (index === null) continue
    await storage.writeText(getLogFilePath(dataDir, index), '')
  }
}
