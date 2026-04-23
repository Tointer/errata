import type { StorageBackend } from '../storage/backend'
import { getAppLogFilePath, getAppLogsDir } from '../storage/global-layout'
import type { LogEntry } from './types'

export const MAX_LOGS_PER_FILE = 1000
export const MAX_LOG_FILES = 5

export function getLogFilesDir(dataDir: string): string {
  return getAppLogsDir(dataDir)
}

export function getLogFilePath(dataDir: string, index: number): string {
  return getAppLogFilePath(dataDir, index)
}

export function isAppLogFileName(entry: string): boolean {
  return /^app-\d+\.jsonl$/i.test(entry)
}

export function parseAppLogFileIndex(entry: string): number | null {
  if (!isAppLogFileName(entry)) return null
  return Number.parseInt(entry.slice(4, -6), 10)
}

function parseLines(raw: string): string[] {
  return raw.split('\n').filter((line) => line.trim())
}

export async function resolveWritableLogFileIndex(
  storage: StorageBackend,
  dataDir: string,
): Promise<number> {
  let currentIndex = 0

  for (let i = 0; i < MAX_LOG_FILES; i++) {
    const path = getLogFilePath(dataDir, i)
    if (!(await storage.exists(path))) {
      currentIndex = i
      break
    }

    const raw = await storage.readText(path)
    if (parseLines(raw).length < MAX_LOGS_PER_FILE) {
      currentIndex = i
      break
    }

    currentIndex = i + 1
  }

  return currentIndex
}

export async function rotateLogFiles(
  storage: StorageBackend,
  dataDir: string,
): Promise<number> {
  for (let i = 0; i < MAX_LOG_FILES - 1; i++) {
    const oldPath = getLogFilePath(dataDir, i + 1)
    const newPath = getLogFilePath(dataDir, i)
    if (await storage.exists(oldPath)) {
      const content = await storage.readText(oldPath)
      await storage.writeText(newPath, content)
    }
  }

  return MAX_LOG_FILES - 1
}

export async function appendLogEntry(
  storage: StorageBackend,
  dataDir: string,
  index: number,
  entry: LogEntry,
): Promise<void> {
  const path = getLogFilePath(dataDir, index)
  const existing = (await storage.readTextIfExists(path)) ?? ''
  await storage.writeText(path, `${existing}${JSON.stringify(entry)}\n`)
}

export async function readParsedLogEntries(
  storage: StorageBackend,
  dataDir: string,
  indexes: Iterable<number>,
): Promise<LogEntry[]> {
  const entries: LogEntry[] = []

  for (const index of indexes) {
    const path = getLogFilePath(dataDir, index)
    if (!(await storage.exists(path))) continue

    const content = await storage.readText(path)
    for (const line of parseLines(content)) {
      try {
        entries.push(JSON.parse(line) as LogEntry)
      } catch {
        // Ignore malformed lines.
      }
    }
  }

  return entries
}