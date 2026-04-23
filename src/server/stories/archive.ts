import { zipSync, unzipSync } from 'fflate'
import { createStory, getStory } from '../fragments/storage'
import { getBranchesIndex } from '../fragments/branches'
import type { StoryMeta } from '../fragments/schema'
import { parseFrontmatter } from '../md-files/frontmatter'
import { storyMetaFromMarkdown } from '../md-files/story-meta'
import {
  detectStoryArchiveImportMode,
  getStoryArchiveEntryPath,
  getStoryMetaArchiveKey,
} from './archive-format'
import { importBranchedArchiveIntoStory, importMarkdownArchiveIntoStory } from './archive-import'
import { getStoryDir } from '../storage/story-layout'
import { getStorageBackend } from '../storage/runtime'

export interface ExportResult {
  buffer: Uint8Array
  filename: string
}

export async function exportStoryAsZip(
  dataDir: string,
  storyId: string,
): Promise<ExportResult> {
  const storage = getStorageBackend()
  const storyDir = getStoryDir(dataDir, storyId)
  const story = await getStory(dataDir, storyId)
  if (!story) {
    throw new Error(`Story not found: ${storyId}`)
  }

  const files = Object.fromEntries(
    Object.entries(await storage.readTree(storyDir)).map(([relativePath, content]) => [
      getStoryArchiveEntryPath(relativePath),
      content,
    ] as const),
  )

  const branchesIndex = await getBranchesIndex(dataDir, storyId)
  files[getStoryArchiveEntryPath('branches.json')] = new TextEncoder().encode(
    JSON.stringify(branchesIndex, null, 2),
  )

  const buffer = zipSync(files)

  let storyName = storyId
  if (story) {
    storyName = story.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
  }

  return {
    buffer,
    filename: `errata-${storyName}.zip`,
  }
}

export async function importStoryFromZip(
  dataDir: string,
  zipBuffer: Uint8Array,
): Promise<StoryMeta> {
  const extracted = unzipSync(zipBuffer)

  const paths = Object.keys(extracted)
  const decoder = new TextDecoder()

  const originalMeta = readStoryMetaFromArchive(paths, extracted, decoder)

  const newStoryId = `story-${Date.now().toString(36)}`
  const now = new Date().toISOString()

  const importMode = detectStoryArchiveImportMode(paths)
  if (!importMode) {
    throw new Error('Invalid archive: only current Errata story archives are supported')
  }

  const newMeta: StoryMeta = {
    ...originalMeta,
    id: newStoryId,
    name: originalMeta.name + ' (imported)',
    createdAt: now,
    updatedAt: now,
    settings: {
      ...originalMeta.settings,
      providerId: null,
      modelId: null,
    },
  }

  await createStory(dataDir, newMeta)

  if (importMode.type === 'branched') {
    await importBranchedArchiveIntoStory(dataDir, newStoryId, extracted, decoder, importMode.branchesKey)
  } else {
    await importMarkdownArchiveIntoStory(dataDir, newStoryId, extracted)
  }

  return newMeta
}

function readStoryMetaFromArchive(
  paths: string[],
  extracted: Record<string, Uint8Array>,
  decoder: TextDecoder,
): StoryMeta {
  const storyMetaKey = getStoryMetaArchiveKey(paths)
  if (!storyMetaKey) {
    throw new Error('Invalid archive: missing story metadata')
  }

  const parsed = parseFrontmatter(decoder.decode(extracted[storyMetaKey]))
  const story = storyMetaFromMarkdown(parsed.attributes, parsed.body)
  if (!story) {
    throw new Error('Invalid archive: could not parse story metadata')
  }
  return story
}