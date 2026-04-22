import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DeleteOptions, FileMetadata, StorageBackend, WriteOptions } from './backend'
import {
  mkdirWithRetries,
  readFileWithRetries,
  renameWithRetries,
  rmWithRetries,
  writeFileWithRetries,
  writeJsonAtomic,
} from '../fs-utils'

async function ensureParentDir(path: string, options?: WriteOptions): Promise<void> {
  if (!options?.ensureDir) return
  await mkdirWithRetries(dirname(path), { recursive: true })
}

async function listTreeEntries(path: string, prefix = ''): Promise<string[]> {
  if (!existsSync(path)) return []

  const entries = await readdir(path, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    const fullPath = join(path, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listTreeEntries(fullPath, relativePath))
    } else {
      files.push(relativePath)
    }
  }

  return files
}

async function readMetadata(path: string): Promise<FileMetadata | null> {
  if (!existsSync(path)) return null

  const fileStats = await stat(path)
  return {
    createdAt: fileStats.birthtime.toISOString(),
    updatedAt: fileStats.mtime.toISOString(),
    isDirectory: fileStats.isDirectory(),
  }
}

export function createFileSystemStorageBackend(): StorageBackend {
  return {
    async delete(path: string, options?: DeleteOptions): Promise<void> {
      await rmWithRetries(path, options?.recursive ? { force: true, recursive: true } : { force: true })
    },

    async exists(path: string): Promise<boolean> {
      return existsSync(path)
    },

    async getMetadata(path: string): Promise<FileMetadata | null> {
      return readMetadata(path)
    },

    async ensureDir(path: string): Promise<void> {
      await mkdirWithRetries(path, { recursive: true })
    },

    async listDir(path: string): Promise<string[]> {
      if (!existsSync(path)) return []
      return readdir(path)
    },

    async listTree(path: string): Promise<string[]> {
      return listTreeEntries(path)
    },

    async move(fromPath: string, toPath: string, options?: WriteOptions): Promise<void> {
      await ensureParentDir(toPath, options)
      await renameWithRetries(fromPath, toPath)
    },

    async readBytes(path: string): Promise<Uint8Array> {
      return new Uint8Array(await readFileWithRetries(path))
    },

    async readJson<T>(path: string): Promise<T> {
      return JSON.parse(await readFileWithRetries(path, 'utf-8')) as T
    },

    async readText(path: string): Promise<string> {
      return readFileWithRetries(path, 'utf-8')
    },

    async writeBytes(path: string, content: Uint8Array, options?: WriteOptions): Promise<void> {
      await ensureParentDir(path, options)
      await writeFileWithRetries(path, content)
    },

    async writeJson(path: string, value: unknown, options?: WriteOptions): Promise<void> {
      await ensureParentDir(path, options)
      await writeJsonAtomic(path, value)
    },

    async writeText(path: string, content: string, options?: WriteOptions): Promise<void> {
      await ensureParentDir(path, options)
      await writeFileWithRetries(path, content, 'utf-8')
    },
  }
}