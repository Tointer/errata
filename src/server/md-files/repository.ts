import { join } from 'node:path'
import type { Fragment, ProseChain, StoryMeta } from '@/server/fragments/schema'
import { getProseChain } from '../fragments/prose-chain'
import {
  getFilenameDerivedFragmentId,
  getCompiledStoryPath,
  getFragmentFileName,
  getFragmentFolder,
  getInternalStoryRoot,
  getInternalStoryPath,
  INTERNAL_MARKDOWN_DIRS,
  isVisibleFilenameDerivedType,
  getMarkdownStoryRoot,
  MARKDOWN_FRAGMENT_DIRS,
  getProseFragmentIdFromFileName,
  getStoryMetaPath,
  STORY_DIRS,
  getTypeForVisibleFolder,
} from './paths'
import { findMarkdownFragmentEntry, listFolderEntries } from './markdown-fragment-entries.ts'
import {
  archiveMarkdownFragmentFile,
  deleteMarkdownFragmentFiles,
  restoreMarkdownFragmentFile,
  writeMarkdownFragmentFile,
} from './markdown-fragment-files.ts'
import { parseFrontmatter } from './frontmatter'
import {
  fragmentFromExplicitMarkdown,
  serializeFragment,
  visibleFragmentFromMarkdown,
} from './markdown-fragment-codec'
import { proseFragmentFromMarkdown } from './prose-metadata'
import {
  readFragmentInternalIndex,
  removeFragmentInternalRecord,
  resolveFragmentTimestamps,
  upsertFragmentInternalRecord,
} from '../storage/stores/fragment-internals'
import { serializeStoryMeta, storyMetaFromMarkdown } from './story-meta'
import { createLogger } from '../logging/logger'
import { getStorageBackend } from '../storage/runtime'

const repositoryLogger = createLogger('md-repository')

export async function ensureMarkdownStoryLayout(dataDir: string, storyId: string): Promise<void> {
  const storage = getStorageBackend()
  const root = getMarkdownStoryRoot(dataDir, storyId)
  await storage.ensureDir(root)
  await Promise.all([
    ...STORY_DIRS.map((dirName) => storage.ensureDir(join(root, dirName))),
    ...INTERNAL_MARKDOWN_DIRS.map((dirName) => storage.ensureDir(join(root, dirName))),
    storage.ensureDir(getInternalStoryRoot(dataDir, storyId)),
  ])
  const compiledPath = getCompiledStoryPath(dataDir, storyId)
  if (!(await storage.exists(compiledPath))) {
    await storage.writeText(compiledPath, '')
  }
}

export async function syncStoryMarkdownMeta(dataDir: string, story: StoryMeta): Promise<void> {
  const storage = getStorageBackend()
  await ensureMarkdownStoryLayout(dataDir, story.id)
  await storage.writeText(getStoryMetaPath(dataDir, story.id), serializeStoryMeta(story))
}

export async function loadMarkdownStoryMeta(dataDir: string, storyId: string): Promise<StoryMeta | null> {
  const storage = getStorageBackend()
  const path = getStoryMetaPath(dataDir, storyId)
  const raw = await storage.readTextIfExists(path)
  if (!raw) return null
  const parsed = parseFrontmatter(raw)
  return storyMetaFromMarkdown(parsed.attributes, parsed.body)
}

async function readCurrentProseChain(dataDir: string, storyId: string): Promise<ProseChain | null> {
  void getInternalStoryPath
  return getProseChain(dataDir, storyId)
}

function findProseSectionIndex(chain: ProseChain | null, fragmentId: string): number | undefined {
  if (!chain) return undefined
  const index = chain.entries.findIndex((entry) => entry.proseFragments.includes(fragmentId))
  return index === -1 ? undefined : index
}

export async function syncFragmentMarkdown(dataDir: string, storyId: string, fragment: Fragment): Promise<void> {
  await ensureMarkdownStoryLayout(dataDir, storyId)
  await upsertFragmentInternalRecord(dataDir, storyId, fragment)

  const chain = fragment.type === 'prose' || fragment.type === 'marker'
    ? await readCurrentProseChain(dataDir, storyId)
    : null
  await writeMarkdownFragmentFile(
    dataDir,
    storyId,
    fragment.id,
    getFragmentFolder(fragment.type),
    getFragmentFileName(fragment, findProseSectionIndex(chain, fragment.id)),
    serializeFragment(fragment),
  )
}

export async function deleteFragmentMarkdown(dataDir: string, storyId: string, fragmentId: string): Promise<void> {
  await deleteMarkdownFragmentFiles(dataDir, storyId, fragmentId)
  await removeFragmentInternalRecord(dataDir, storyId, fragmentId)
}

export async function loadMarkdownFragmentById(dataDir: string, storyId: string, fragmentId: string): Promise<Fragment | null> {
  const storage = getStorageBackend()
  const matches = await findMarkdownFragmentEntry(dataDir, storyId, fragmentId, { includeArchived: true })
  const match = matches[0]
  const path = match?.path
  if (!path) return null

  const raw = await storage.readTextIfExists(path)
  if (!raw) return null
  const parsed = parseFrontmatter(raw)
  const internalIndex = await readFragmentInternalIndex(dataDir, storyId)
  const internalRecord = internalIndex[fragmentId]
  const proseDir = join(getMarkdownStoryRoot(dataDir, storyId), 'Prose')

  if (path.startsWith(proseDir)) {
    return proseFragmentFromMarkdown(
      fragmentId,
      parsed.attributes,
      parsed.body,
      internalRecord?.prose,
      resolveFragmentTimestamps(parsed.attributes, internalRecord),
      (attributes, body) => fragmentFromExplicitMarkdown(attributes, body, internalRecord),
    )
  }

  const visibleType = match ? getTypeForVisibleFolder(match.folder) : null
  if (visibleType && isVisibleFilenameDerivedType(visibleType) && match) {
    return visibleFragmentFromMarkdown(visibleType, match.entry, parsed.attributes, parsed.body, internalRecord)
  }

  return fragmentFromExplicitMarkdown(parsed.attributes, parsed.body, internalRecord)
}

export async function listMarkdownFragments(
  dataDir: string,
  storyId: string,
  type?: string,
): Promise<Fragment[]> {
  const storage = getStorageBackend()
  const root = getMarkdownStoryRoot(dataDir, storyId)
  if (!(await storage.exists(root))) return []

  const folders = type ? [getFragmentFolder(type)] : [...MARKDOWN_FRAGMENT_DIRS]
  const fragments: Fragment[] = []
  const internalIndex = await readFragmentInternalIndex(dataDir, storyId)
  const storyLogger = repositoryLogger.child({ storyId, extra: type ? { type } : undefined })

  for (const folder of folders) {
    const folderPath = join(root, folder)
    if (!(await storage.exists(folderPath))) continue
    const entries = await listFolderEntries(folderPath, folder, { includeArchived: false })
    const visibleType = getTypeForVisibleFolder(folder)
    for (const record of entries) {
      const entry = record.entry
      const raw = await storage.readText(record.path)
      const parsed = parseFrontmatter(raw)
      const proseId = getProseFragmentIdFromFileName(entry)
      const visibleId = visibleType && isVisibleFilenameDerivedType(visibleType)
        ? getFilenameDerivedFragmentId(visibleType, entry)
        : undefined
      const explicitId = typeof parsed.attributes.id === 'string' ? parsed.attributes.id : undefined
      const fragment = folder === 'Prose'
        ? proseFragmentFromMarkdown(
            proseId,
            parsed.attributes,
            parsed.body,
            internalIndex[proseId]?.prose,
            resolveFragmentTimestamps(parsed.attributes, internalIndex[proseId]),
            (attributes, body) => fragmentFromExplicitMarkdown(attributes, body, internalIndex[proseId]),
          )
        : visibleType && isVisibleFilenameDerivedType(visibleType)
          ? visibleFragmentFromMarkdown(visibleType, entry, parsed.attributes, parsed.body, internalIndex[visibleId ?? ''])
          : fragmentFromExplicitMarkdown(parsed.attributes, parsed.body, explicitId ? internalIndex[explicitId] : undefined)

      if (!fragment) {
        storyLogger.warn('Skipped invalid markdown fragment', {
          folder,
          path: record.path,
          entry,
        })
        continue
      }
      if (type && fragment.type !== type) continue
      fragments.push(fragment)
    }
  }

  return fragments.sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order
    return left.id.localeCompare(right.id)
  })
}

export async function writeCompiledStoryMarkdown(
  dataDir: string,
  storyId: string,
  blocks: Array<{ id: string; content: string }>,
): Promise<void> {
  const storage = getStorageBackend()
  await ensureMarkdownStoryLayout(dataDir, storyId)
  const compiled = blocks
    .map((block) => `[[[${block.id}]]]\n${block.content.trimEnd()}`)
    .join('\n\n')
  await storage.writeText(getCompiledStoryPath(dataDir, storyId), compiled ? `${compiled}\n` : '')
}

export async function syncCompiledStoryFromCurrentChain(dataDir: string, storyId: string): Promise<void> {
  const chain = await readCurrentProseChain(dataDir, storyId)
  if (!chain) {
    await writeCompiledStoryMarkdown(dataDir, storyId, [])
    return
  }

  const blocks: Array<{ id: string; content: string }> = []
  for (const entry of chain.entries) {
    const fragment = await loadMarkdownFragmentById(dataDir, storyId, entry.active)
    if (!fragment || await isMarkdownFragmentArchived(dataDir, storyId, entry.active) || fragment.type === 'marker') continue
    blocks.push({ id: fragment.id, content: fragment.content })
  }

  await writeCompiledStoryMarkdown(dataDir, storyId, blocks)
}

export async function syncProseMarkdownOrder(dataDir: string, storyId: string): Promise<void> {
  const chain = await readCurrentProseChain(dataDir, storyId)
  if (!chain) return

  for (const entry of chain.entries) {
    for (const fragmentId of entry.proseFragments) {
      const fragment = await loadMarkdownFragmentById(dataDir, storyId, fragmentId)
      if (!fragment) continue
      await syncFragmentMarkdown(dataDir, storyId, fragment)
    }
  }
}

export async function isMarkdownFragmentArchived(dataDir: string, storyId: string, fragmentId: string): Promise<boolean> {
  const match = (await findMarkdownFragmentEntry(dataDir, storyId, fragmentId, { includeArchived: true }))[0]
  return Boolean(match?.archived)
}

export async function listArchivedMarkdownFragments(
  dataDir: string,
  storyId: string,
  type?: string,
): Promise<Fragment[]> {
  const storage = getStorageBackend()
  const root = getMarkdownStoryRoot(dataDir, storyId)
  if (!(await storage.exists(root))) return []

  const folders = type ? [getFragmentFolder(type)] : [...MARKDOWN_FRAGMENT_DIRS]
  const fragments: Fragment[] = []
  const internalIndex = await readFragmentInternalIndex(dataDir, storyId)

  for (const folder of folders) {
    const folderPath = join(root, folder)
    if (!(await storage.exists(folderPath))) continue
    const entries = await listFolderEntries(folderPath, folder, { includeArchived: true, onlyArchived: true })
    const visibleType = getTypeForVisibleFolder(folder)
    for (const record of entries) {
      const raw = await storage.readText(record.path)
      const parsed = parseFrontmatter(raw)
      const proseId = getProseFragmentIdFromFileName(record.entry)
      const visibleId = visibleType && isVisibleFilenameDerivedType(visibleType)
        ? getFilenameDerivedFragmentId(visibleType, record.entry)
        : undefined
      const explicitId = typeof parsed.attributes.id === 'string' ? parsed.attributes.id : undefined
      const fragment = folder === 'Prose'
        ? proseFragmentFromMarkdown(
            proseId,
            parsed.attributes,
            parsed.body,
            internalIndex[proseId]?.prose,
            resolveFragmentTimestamps(parsed.attributes, internalIndex[proseId]),
            (attributes, body) => fragmentFromExplicitMarkdown(attributes, body, internalIndex[proseId]),
          )
        : visibleType && isVisibleFilenameDerivedType(visibleType)
          ? visibleFragmentFromMarkdown(visibleType, record.entry, parsed.attributes, parsed.body, internalIndex[visibleId ?? ''])
          : fragmentFromExplicitMarkdown(parsed.attributes, parsed.body, explicitId ? internalIndex[explicitId] : undefined)

      if (!fragment) continue
      if (type && fragment.type !== type) continue
      fragments.push(fragment)
    }
  }

  return fragments.sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order
    return left.id.localeCompare(right.id)
  })
}

export async function archiveFragmentMarkdown(dataDir: string, storyId: string, fragmentId: string): Promise<boolean> {
  return archiveMarkdownFragmentFile(dataDir, storyId, fragmentId)
}

export async function restoreFragmentMarkdown(dataDir: string, storyId: string, fragmentId: string): Promise<boolean> {
  return restoreMarkdownFragmentFile(dataDir, storyId, fragmentId)
}
