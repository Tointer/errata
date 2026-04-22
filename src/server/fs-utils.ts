import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'

const MAX_FILE_OPERATION_ATTEMPTS = 3
const RETRYABLE_FILE_ERROR_CODES = new Set(['EACCES', 'EBUSY', 'ENOTEMPTY', 'EPERM'])

function isRetryableFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && RETRYABLE_FILE_ERROR_CODES.has(String(error.code))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withFileOpRetries<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_FILE_OPERATION_ATTEMPTS; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isRetryableFileError(error) || attempt === MAX_FILE_OPERATION_ATTEMPTS) {
        throw error
      }

      await delay(attempt * 50)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('File operation failed after retries')
}

export function mkdirWithRetries(path: string, options?: Parameters<typeof mkdir>[1]): Promise<string | undefined> {
  return withFileOpRetries(() => mkdir(path, options))
}

export function readFileWithRetries(path: string, encoding: BufferEncoding): Promise<string>
export function readFileWithRetries(path: string): Promise<Buffer>
export function readFileWithRetries(path: string, encoding?: BufferEncoding): Promise<string | Buffer> {
  if (encoding) {
    return withFileOpRetries(() => readFile(path, encoding))
  }

  return withFileOpRetries(() => readFile(path))
}

export function renameWithRetries(oldPath: string, newPath: string): Promise<void> {
  return withFileOpRetries(() => rename(oldPath, newPath))
}

export function rmWithRetries(path: string, options?: Parameters<typeof rm>[1]): Promise<void> {
  return withFileOpRetries(() => rm(path, options))
}

export function writeFileWithRetries(
  path: string,
  data: string | NodeJS.ArrayBufferView,
  options?: Parameters<typeof writeFile>[2],
): Promise<void> {
  return withFileOpRetries(() => writeFile(path, data, options))
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const tmpPath = `${path}.tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  await writeFileWithRetries(tmpPath, JSON.stringify(value, null, 2), 'utf-8')
  await renameWithRetries(tmpPath, path)
}
