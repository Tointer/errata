import { join } from 'node:path'
import {
  ARCHIVE_SUBDIR,
  getFilenameDerivedFragmentId,
  getMarkdownStoryRoot,
  getProseFragmentIdFromFileName,
  getTypeForVisibleFolder,
  isVisibleFilenameDerivedType,
  MARKDOWN_FRAGMENT_DIRS,
} from './paths'
import type { StorageBackend } from '../storage/backend'
import { getStorageBackend } from '../storage/runtime'

export interface MarkdownFragmentEntry {
  path: string
  folder: string
  entry: string
  archived: boolean
}

function isMarkdownFile(entry: string): boolean {
  return entry.endsWith('.md')
}

async function collectMarkdownEntries(
  storage: StorageBackend,
  folderPath: string,
  folder: string,
  archived: boolean,
): Promise<MarkdownFragmentEntry[]> {
  if (!(await storage.exists(folderPath))) return []

  return (await storage.listDir(folderPath))
    .filter(isMarkdownFile)
    .map((entry) => ({ path: join(folderPath, entry), folder, entry, archived }))
}

function getEntryFragmentId(folder: string, entry: string): string | null {
  if (folder === 'Prose') return getProseFragmentIdFromFileName(entry)

  const visibleType = getTypeForVisibleFolder(folder)
  if (visibleType && isVisibleFilenameDerivedType(visibleType)) {
    return getFilenameDerivedFragmentId(visibleType, entry)
  }

  return null
}

export async function listFolderEntries(
  folderPath: string,
  folder: string,
  opts: { includeArchived?: boolean; onlyArchived?: boolean },
): Promise<MarkdownFragmentEntry[]> {
  const storage = getStorageBackend()
  const liveEntries = opts.onlyArchived
    ? []
    : await collectMarkdownEntries(storage, folderPath, folder, false)
  const archivedEntries = opts.includeArchived || opts.onlyArchived
    ? await collectMarkdownEntries(storage, join(folderPath, ARCHIVE_SUBDIR), folder, true)
    : []

  return [...liveEntries, ...archivedEntries]
}

export async function findMarkdownFragmentEntry(
  dataDir: string,
  storyId: string,
  fragmentId: string,
  opts: { includeArchived?: boolean; onlyArchived?: boolean } = { includeArchived: true },
): Promise<MarkdownFragmentEntry[]> {
  const root = getMarkdownStoryRoot(dataDir, storyId)
  const matches: MarkdownFragmentEntry[] = []

  for (const folder of MARKDOWN_FRAGMENT_DIRS) {
    const folderPath = join(root, folder)
    const entries = await listFolderEntries(folderPath, folder, opts)
    for (const candidate of entries) {
      const candidateId = getEntryFragmentId(folder, candidate.entry)
      const isMatch = candidateId
        ? candidateId === fragmentId
        : candidate.entry.includes(fragmentId)
      if (!isMatch) continue
      matches.push(candidate)
    }
  }

  return matches
}