import { join } from 'node:path'
import { generateFragmentId } from '@/lib/fragment-ids'
import { getContentRoot } from '../fragments/branches'
import type { Associations, BranchesIndex, Fragment, ProseChain } from '../fragments/schema'
import * as storyLayout from '../storage/story-layout'
import { getStorageBackend } from '../storage/runtime'
import * as archiveFormat from './archive-format'

export async function importMarkdownArchiveIntoStory(
  dataDir: string,
  storyId: string,
  extracted: Record<string, Uint8Array>,
): Promise<void> {
  const storage = getStorageBackend()
  const root = await getContentRoot(dataDir, storyId)

  for (const { relativePath, content } of archiveFormat.getMarkdownArchiveEntries(extracted)) {
    await storage.writeBytes(join(root, relativePath), content)
  }
}

export async function importBranchedArchiveIntoStory(
  dataDir: string,
  storyId: string,
  extracted: Record<string, Uint8Array>,
  decoder: TextDecoder,
  branchesKey: string,
): Promise<void> {
  const storage = getStorageBackend()
  const storyDir = storyLayout.getStoryDir(dataDir, storyId)
  const branchesIndex = JSON.parse(decoder.decode(extracted[branchesKey])) as BranchesIndex
  const idMap = buildBranchFragmentIdMap(extracted, decoder)

  await storage.writeJson(join(storyDir, 'branches.json'), branchesIndex)

  for (const branch of branchesIndex.branches) {
    const branchPrefix = archiveFormat.findBranchArchivePrefix(Object.keys(extracted), branch.id)
    if (!branchPrefix) continue

    const branchDir = join(storyDir, 'branches', branch.id)
    await storage.ensureDir(branchDir)
    await storage.ensureDir(join(branchDir, 'fragments'))

    const handled = new Set<string>()

    await writeBranchFragments(extracted, decoder, branchPrefix, branchDir, idMap, handled)
    await writeBranchProseChain(extracted, decoder, branchPrefix, branchDir, idMap, handled)
    await writeBranchAssociations(extracted, decoder, branchPrefix, branchDir, idMap, handled)
    await writeBranchGenerationLogs(extracted, decoder, branchPrefix, branchDir, idMap, handled)
    await copyRemainingBranchFiles(extracted, branchPrefix, branchDir, handled)
  }
}

function buildBranchFragmentIdMap(
  extracted: Record<string, Uint8Array>,
  decoder: TextDecoder,
): Map<string, string> {
  const idMap = new Map<string, string>()

  for (const [path, content] of Object.entries(extracted)) {
    if (!path.includes('/branches/') || !path.includes('/fragments/') || !path.endsWith('.json')) continue

    const fragment = JSON.parse(decoder.decode(content)) as Fragment
    if (!idMap.has(fragment.id)) {
      idMap.set(fragment.id, generateFragmentId(fragment.type))
    }
  }

  return idMap
}

async function writeBranchFragments(
  extracted: Record<string, Uint8Array>,
  decoder: TextDecoder,
  branchPrefix: string,
  branchDir: string,
  idMap: Map<string, string>,
  handled: Set<string>,
): Promise<void> {
  const storage = getStorageBackend()
  const fragmentPrefix = `${branchPrefix}/fragments/`

  for (const [path, content] of Object.entries(extracted)) {
    if (!path.startsWith(fragmentPrefix) || !path.endsWith('.json')) continue

    handled.add(path)
    const fragment = JSON.parse(decoder.decode(content)) as Fragment
    const newId = idMap.get(fragment.id) ?? fragment.id
    const remapped: Fragment = {
      ...fragment,
      id: newId,
      refs: fragment.refs.map((ref) => idMap.get(ref) ?? ref),
      meta: remapMeta(fragment.meta, idMap),
    }

    await storage.writeJson(join(branchDir, 'fragments', `${newId}.json`), remapped)
  }
}

async function writeBranchProseChain(
  extracted: Record<string, Uint8Array>,
  decoder: TextDecoder,
  branchPrefix: string,
  branchDir: string,
  idMap: Map<string, string>,
  handled: Set<string>,
): Promise<void> {
  const storage = getStorageBackend()
  const key = `${branchPrefix}/prose-chain.json`
  if (!extracted[key]) return

  handled.add(key)
  const chain = JSON.parse(decoder.decode(extracted[key])) as ProseChain
  const remapped: ProseChain = {
    entries: chain.entries.map((entry) => ({
      proseFragments: entry.proseFragments.map((id) => idMap.get(id) ?? id),
      active: idMap.get(entry.active) ?? entry.active,
    })),
  }

  await storage.writeJson(join(branchDir, 'prose-chain.json'), remapped)
}

async function writeBranchAssociations(
  extracted: Record<string, Uint8Array>,
  decoder: TextDecoder,
  branchPrefix: string,
  branchDir: string,
  idMap: Map<string, string>,
  handled: Set<string>,
): Promise<void> {
  const storage = getStorageBackend()
  const key = `${branchPrefix}/associations.json`
  if (!extracted[key]) return

  handled.add(key)
  const associations = JSON.parse(decoder.decode(extracted[key])) as Associations
  await storage.writeJson(join(branchDir, 'associations.json'), remapAssociations(associations, idMap))
}

async function writeBranchGenerationLogs(
  extracted: Record<string, Uint8Array>,
  decoder: TextDecoder,
  branchPrefix: string,
  branchDir: string,
  idMap: Map<string, string>,
  handled: Set<string>,
): Promise<void> {
  const storage = getStorageBackend()
  const prefix = `${branchPrefix}/generation-logs/`
  const logsDir = join(branchDir, 'generation-logs')

  for (const [path, content] of Object.entries(extracted)) {
    if (!path.startsWith(prefix) || !path.endsWith('.json')) continue

    handled.add(path)
    const logData = JSON.parse(decoder.decode(content)) as { fragmentId?: string }
    if (logData.fragmentId && idMap.has(logData.fragmentId)) {
      logData.fragmentId = idMap.get(logData.fragmentId)
    }

    await storage.ensureDir(logsDir)
    const filename = path.split('/').pop()
    if (!filename) continue
    await storage.writeJson(join(logsDir, filename), logData)
  }
}

async function copyRemainingBranchFiles(
  extracted: Record<string, Uint8Array>,
  branchPrefix: string,
  branchDir: string,
  handled: Set<string>,
): Promise<void> {
  const storage = getStorageBackend()
  const prefix = `${branchPrefix}/`

  for (const [path, content] of Object.entries(extracted)) {
    if (!path.startsWith(prefix) || handled.has(path)) continue

    const relativePath = path.slice(prefix.length)
    await storage.writeBytes(join(branchDir, relativePath), content)
  }
}

function remapMeta(
  meta: Record<string, unknown>,
  idMap: Map<string, string>,
): Record<string, unknown> {
  const result = { ...meta }

  if (Array.isArray(result.visualRefs)) {
    result.visualRefs = (result.visualRefs as Array<Record<string, unknown>>).map((ref) => ({
      ...ref,
      fragmentId: idMap.get(ref.fragmentId as string) ?? ref.fragmentId,
    }))
  }

  if (typeof result.previousFragmentId === 'string' && idMap.has(result.previousFragmentId)) {
    result.previousFragmentId = idMap.get(result.previousFragmentId)
  }

  if (typeof result.variationOf === 'string' && idMap.has(result.variationOf)) {
    result.variationOf = idMap.get(result.variationOf)
  }

  return result
}

function remapAssociations(
  associations: Associations,
  idMap: Map<string, string>,
): Associations {
  const newTagIndex: Record<string, string[]> = {}
  for (const [tag, ids] of Object.entries(associations.tagIndex)) {
    newTagIndex[tag] = ids.map((id) => idMap.get(id) ?? id)
  }

  const newRefIndex: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(associations.refIndex)) {
    let newKey = key
    if (key.startsWith('__backref:')) {
      const oldId = key.slice('__backref:'.length)
      const newId = idMap.get(oldId) ?? oldId
      newKey = `__backref:${newId}`
    } else if (idMap.has(key)) {
      newKey = idMap.get(key) ?? key
    }

    newRefIndex[newKey] = ids.map((id) => idMap.get(id) ?? id)
  }

  return { tagIndex: newTagIndex, refIndex: newRefIndex }
}