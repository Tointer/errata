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
import { getStorageBackend } from '../storage/runtime'

export interface MarkdownFragmentEntry {
  path: string
  folder: string
  entry: string
  archived: boolean
}

export async function listFolderEntries(
  folderPath: string,
  folder: string,
  opts: { includeArchived?: boolean; onlyArchived?: boolean },
): Promise<MarkdownFragmentEntry[]> {
  const storage = getStorageBackend()
  const matches: MarkdownFragmentEntry[] = []

  if (!opts.onlyArchived && await storage.exists(folderPath)) {
    const entries = await storage.listDir(folderPath)
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue
      matches.push({ path: join(folderPath, entry), folder, entry, archived: false })
    }
  }

  if (opts.includeArchived || opts.onlyArchived) {
    const archivePath = join(folderPath, ARCHIVE_SUBDIR)
    if (await storage.exists(archivePath)) {
      const archiveEntries = await storage.listDir(archivePath)
      for (const entry of archiveEntries) {
        if (!entry.endsWith('.md')) continue
        matches.push({ path: join(archivePath, entry), folder, entry, archived: true })
      }
    }
  }

  return matches
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
      const entry = candidate.entry

      let candidateId: string | null = null
      const visibleType = getTypeForVisibleFolder(folder)
      if (folder === 'Prose') {
        candidateId = getProseFragmentIdFromFileName(entry)
      } else if (visibleType && isVisibleFilenameDerivedType(visibleType)) {
        candidateId = getFilenameDerivedFragmentId(visibleType, entry)
      } else if (entry.includes(fragmentId)) {
        candidateId = fragmentId
      }

      if (candidateId !== fragmentId) continue
      matches.push(candidate)
    }
  }

  return matches
}