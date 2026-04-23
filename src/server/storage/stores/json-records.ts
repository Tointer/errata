import { getStorageBackend } from '../runtime'

function isJsonFileName(entry: string): boolean {
  return entry.endsWith('.json')
}

function stripJsonExtension(entry: string): string {
  return entry.replace(/\.json$/i, '')
}

export async function writeJsonRecord(
  path: string,
  value: unknown,
): Promise<void> {
  await getStorageBackend().writeJson(path, value)
}

export async function readJsonRecordIfExists<T>(
  path: string,
): Promise<T | null> {
  return getStorageBackend().readJsonIfExists<T>(path)
}

export async function readJsonRecordOrDefault<T>(
  path: string,
  fallback: T,
): Promise<T> {
  return getStorageBackend().readJsonOrDefault(path, fallback)
}

export async function deleteJsonRecord(
  path: string,
): Promise<boolean> {
  const storage = getStorageBackend()
  if (!(await storage.exists(path))) return false
  await storage.delete(path)
  return true
}

export async function deleteJsonRecordIfExists(
  path: string,
): Promise<void> {
  await getStorageBackend().deleteIfExists(path)
}

export async function listJsonRecordIds(
  dir: string,
): Promise<string[]> {
  const storage = getStorageBackend()
  if (!(await storage.exists(dir))) return []

  return (await storage.listDir(dir))
    .filter(isJsonFileName)
    .map(stripJsonExtension)
}