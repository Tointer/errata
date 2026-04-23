import type { Fragment } from '@/server/fragments/schema'
import { getFragmentInternalIndexPath } from '../story-layout'
import { buildProseInternalFields, type ProseFragmentInternalFields } from '../../md-files/prose-metadata'
import { createLogger } from '../../logging/logger'
import { getStorageBackend } from '../runtime'
import { createKeyedSerialQueue } from './keyed-operations'

const logger = createLogger('fragment-internals')
const runStoryIndexWrite = createKeyedSerialQueue()

function getStoryIndexWriteKey(dataDir: string, storyId: string): string {
  return `${dataDir}::${storyId}`
}

export interface FragmentInternalRecord {
  createdAt: string
  updatedAt: string
  prose?: ProseFragmentInternalFields
}

export async function readFragmentInternalIndex(
  dataDir: string,
  storyId: string,
): Promise<Record<string, FragmentInternalRecord>> {
  const storage = getStorageBackend()
  const indexPath = getFragmentInternalIndexPath(dataDir, storyId)
  let current: Record<string, FragmentInternalRecord> = {}

  try {
    current = (await storage.readJsonIfExists<Record<string, FragmentInternalRecord>>(indexPath)) ?? {}
  } catch (error) {
    logger.warn('Failed to parse fragment internal index; continuing with empty index', {
      storyId,
      path: indexPath,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return current
}

async function writeFragmentInternalIndex(
  dataDir: string,
  storyId: string,
  index: Record<string, FragmentInternalRecord>,
): Promise<void> {
  const storage = getStorageBackend()
  await storage.writeJson(getFragmentInternalIndexPath(dataDir, storyId), index)
}

export function buildFragmentInternalRecord(fragment: Fragment): FragmentInternalRecord {
  return {
    createdAt: fragment.createdAt,
    updatedAt: fragment.updatedAt,
    ...(fragment.type === 'prose' ? { prose: buildProseInternalFields(fragment) } : {}),
  }
}

export function resolveFragmentTimestamps(
  attributes: Record<string, unknown>,
  internalRecord: FragmentInternalRecord | undefined,
): { createdAt: string; updatedAt: string } {
  const now = new Date().toISOString()
  return {
    createdAt: internalRecord?.createdAt ?? (typeof attributes.createdAt === 'string' ? attributes.createdAt : now),
    updatedAt: internalRecord?.updatedAt ?? (typeof attributes.updatedAt === 'string' ? attributes.updatedAt : now),
  }
}

export async function upsertFragmentInternalRecord(
  dataDir: string,
  storyId: string,
  fragment: Fragment,
): Promise<void> {
  await runStoryIndexWrite(getStoryIndexWriteKey(dataDir, storyId), async () => {
    const index = await readFragmentInternalIndex(dataDir, storyId)
    index[fragment.id] = buildFragmentInternalRecord(fragment)
    await writeFragmentInternalIndex(dataDir, storyId, index)
  })
}

export async function removeFragmentInternalRecord(
  dataDir: string,
  storyId: string,
  fragmentId: string,
): Promise<void> {
  await runStoryIndexWrite(getStoryIndexWriteKey(dataDir, storyId), async () => {
    const index = await readFragmentInternalIndex(dataDir, storyId)
    if (!(fragmentId in index)) return
    delete index[fragmentId]
    await writeFragmentInternalIndex(dataDir, storyId, index)
  })
}