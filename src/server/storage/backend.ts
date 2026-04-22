export interface WriteOptions {
  ensureDir?: boolean
}

export interface DeleteOptions {
  recursive?: boolean
}

export interface FileMetadata {
  createdAt: string
  updatedAt: string
  isDirectory: boolean
}

export interface StorageBackend {
  delete(path: string, options?: DeleteOptions): Promise<void>
  exists(path: string): Promise<boolean>
  getMetadata(path: string): Promise<FileMetadata | null>
  ensureDir(path: string): Promise<void>
  listDir(path: string): Promise<string[]>
  listTree(path: string): Promise<string[]>
  move(fromPath: string, toPath: string, options?: WriteOptions): Promise<void>
  readBytes(path: string): Promise<Uint8Array>
  readJson<T>(path: string): Promise<T>
  readText(path: string): Promise<string>
  writeBytes(path: string, content: Uint8Array, options?: WriteOptions): Promise<void>
  writeJson(path: string, value: unknown, options?: WriteOptions): Promise<void>
  writeText(path: string, content: string, options?: WriteOptions): Promise<void>
}