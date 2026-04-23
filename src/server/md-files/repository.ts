import { join } from 'node:path'
import type { Fragment, ProseChain, StoryMeta } from '@/server/fragments/schema'
import { getProseChain } from '../fragments/prose-chain'
import {
  getCompiledStoryPath,
  getStoryDir as getMarkdownStoryRoot,
  getStoryInternalDir as getInternalStoryRoot,
  getStoryMetaPath,
} from '../storage/story-layout'
import {
  getFilenameDerivedFragmentId,
  getFragmentFileName,
  getFragmentFolder,
  getProseFragmentIdFromFileName,
  getTypeForVisibleFolder,
  INTERNAL_MARKDOWN_DIRS,
  isVisibleFilenameDerivedType,
  MARKDOWN_FRAGMENT_DIRS,
  STORY_DIRS,
} from './fragment-layout'
import { findMarkdownFragmentEntry, listFolderEntries, type MarkdownFragmentEntry } from './fragment-locator'
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

function sortFragments(fragments: Fragment[]): Fragment[] {
  return fragments.sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order
    return left.id.localeCompare(right.id)
  })
}

function buildFragmentFromEntry(
  record: MarkdownFragmentEntry,
  parsed: { attributes: Record<string, unknown>; body: string },
  internalIndex: Awaited<ReturnType<typeof readFragmentInternalIndex>>,
): Fragment | null {
  const visibleType = getTypeForVisibleFolder(record.folder)
  const proseId = record.folder === 'Prose'
    ? getProseFragmentIdFromFileName(record.entry)
    : undefined
  const visibleId = visibleType && isVisibleFilenameDerivedType(visibleType)
    ? getFilenameDerivedFragmentId(visibleType, record.entry)
    : undefined
  const explicitId = typeof parsed.attributes.id === 'string' ? parsed.attributes.id : undefined

  if (proseId) {
    return proseFragmentFromMarkdown(
      proseId,
      parsed.attributes,
      parsed.body,
      internalIndex[proseId]?.prose,
      resolveFragmentTimestamps(parsed.attributes, internalIndex[proseId]),
      (attributes, body) => fragmentFromExplicitMarkdown(attributes, body, internalIndex[proseId]),
    )
  }

  if (visibleType && isVisibleFilenameDerivedType(visibleType)) {
    return visibleFragmentFromMarkdown(visibleType, record.entry, parsed.attributes, parsed.body, internalIndex[visibleId ?? ''])
  }

  return fragmentFromExplicitMarkdown(parsed.attributes, parsed.body, explicitId ? internalIndex[explicitId] : undefined)
}

async function readFragmentFromEntry(
  record: MarkdownFragmentEntry,
  internalIndex: Awaited<ReturnType<typeof readFragmentInternalIndex>>,
): Promise<Fragment | null> {
  const storage = getStorageBackend()
  const raw = await storage.readTextIfExists(record.path)
  if (!raw) return null

  return buildFragmentFromEntry(record, parseFrontmatter(raw), internalIndex)
}

async function loadFragmentsFromFolders(
  dataDir: string,
  storyId: string,
  folders: string[],
  internalIndex: Awaited<ReturnType<typeof readFragmentInternalIndex>>,
  options: {
    includeArchived?: boolean
    onlyArchived?: boolean
    type?: string
    logInvalid?: boolean
  },
): Promise<Fragment[]> {
  const root = getMarkdownStoryRoot(dataDir, storyId)
  const fragments: Fragment[] = []
  const storyLogger = repositoryLogger.child({ storyId, extra: options.type ? { type: options.type } : undefined })

  for (const folder of folders) {
    const entries = await listFolderEntries(join(root, folder), folder, options)
    for (const record of entries) {
      const fragment = await readFragmentFromEntry(record, internalIndex)
      if (!fragment) {
        if (options.logInvalid) {
          storyLogger.warn('Skipped invalid markdown fragment', {
            folder,
            path: record.path,
            entry: record.entry,
          })
        }
        continue
      }
      if (options.type && fragment.type !== options.type) continue
      fragments.push(fragment)
    }
  }

  return sortFragments(fragments)
}

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

function findProseSectionIndex(chain: ProseChain | null, fragmentId: string): number | undefined {
  if (!chain) return undefined
  const index = chain.entries.findIndex((entry) => entry.proseFragments.includes(fragmentId))
  return index === -1 ? undefined : index
}

export async function syncFragmentMarkdown(dataDir: string, storyId: string, fragment: Fragment): Promise<void> {
  await ensureMarkdownStoryLayout(dataDir, storyId)
  await upsertFragmentInternalRecord(dataDir, storyId, fragment)

  const chain = fragment.type === 'prose' || fragment.type === 'marker'
    ? await getProseChain(dataDir, storyId)
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
  const matches = await findMarkdownFragmentEntry(dataDir, storyId, fragmentId, { includeArchived: true })
  const match = matches[0]
  if (!match) return null

  const internalIndex = await readFragmentInternalIndex(dataDir, storyId)
  return readFragmentFromEntry(match, internalIndex)
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
  const internalIndex = await readFragmentInternalIndex(dataDir, storyId)

  return loadFragmentsFromFolders(dataDir, storyId, folders, internalIndex, {
    includeArchived: false,
    type,
    logInvalid: true,
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
  const chain = await getProseChain(dataDir, storyId)
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
  const chain = await getProseChain(dataDir, storyId)
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
  const internalIndex = await readFragmentInternalIndex(dataDir, storyId)

  return loadFragmentsFromFolders(dataDir, storyId, folders, internalIndex, {
    includeArchived: true,
    onlyArchived: true,
    type,
  })
}

export async function archiveFragmentMarkdown(dataDir: string, storyId: string, fragmentId: string): Promise<boolean> {
  return archiveMarkdownFragmentFile(dataDir, storyId, fragmentId)
}

export async function restoreFragmentMarkdown(dataDir: string, storyId: string, fragmentId: string): Promise<boolean> {
  return restoreMarkdownFragmentFile(dataDir, storyId, fragmentId)
}
