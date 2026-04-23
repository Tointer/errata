import { join } from 'node:path'

export function resolveGlobalDataDir(dataDir: string): string {
  return process.env.GLOBAL_DATA_DIR?.trim() || dataDir
}

export function getGlobalStoragePath(dataDir: string, ...segments: string[]): string {
  return join(resolveGlobalDataDir(dataDir), ...segments)
}

export function getGlobalConfigPath(dataDir: string): string {
  return getGlobalStoragePath(dataDir, 'config.json')
}

export function getInstructionSetsDir(dataDir: string): string {
  return getGlobalStoragePath(dataDir, 'instruction-sets')
}

export function getAppLogsDir(dataDir: string): string {
  return getGlobalStoragePath(dataDir, 'logs')
}

export function getAppLogFilePath(dataDir: string, index: number): string {
  return getGlobalStoragePath(dataDir, 'logs', `app-${index}.jsonl`)
}

export function getGenerationFailureLogsDir(dataDir: string): string {
  return getGlobalStoragePath(dataDir, 'logs', 'generation-failures')
}

export function getGenerationFailureLogPath(dataDir: string, logId: string): string {
  return getGlobalStoragePath(dataDir, 'logs', 'generation-failures', `${logId}.json`)
}