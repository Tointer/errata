import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { StoryMeta } from '@/server/fragments/schema'
import { serializeStoryMeta } from '@/server/md-files/story-meta'
import { getStorageBackend } from '@/server/storage/runtime'
import { importStoryFromZip } from '@/server/stories/archive'
import { createTempDir, makeTestSettings } from './setup'

function makeStoryMarkdown(): string {
  const now = new Date().toISOString()
  const story: StoryMeta = {
    id: 'legacy-story',
    name: 'Branched Archive Story',
    description: 'Imported from branched archive',
    coverImage: null,
    summary: '',
    createdAt: now,
    updatedAt: now,
    settings: makeTestSettings({
      providerId: 'provider-test',
      modelId: 'model-test',
    }),
  }

  return serializeStoryMeta(story)
}

describe('story archive branched import', () => {
  it('imports branched archives through the dedicated importer', async () => {
    const tmp = await createTempDir()

    try {
      const archive = zipSync({
        'errata-story-export/.errata/_story.md': new TextEncoder().encode(makeStoryMarkdown()),
        'errata-story-export/branches.json': new TextEncoder().encode(JSON.stringify({
          branches: [{ id: 'main', name: 'Main', order: 0, createdAt: '2024-01-01T00:00:00.000Z' }],
          activeBranchId: 'main',
        })),
        'errata-story-export/branches/main/fragments/pr-source.json': new TextEncoder().encode(JSON.stringify({
          id: 'pr-source',
          type: 'prose',
          name: 'Opening',
          description: 'Opening beat',
          content: 'Rain on the station glass.',
          tags: [],
          refs: [],
          sticky: false,
          placement: 'user',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          order: 0,
          meta: {},
          version: 1,
          versions: [],
        })),
        'errata-story-export/branches/main/prose-chain.json': new TextEncoder().encode(JSON.stringify({
          entries: [{ proseFragments: ['pr-source'], active: 'pr-source' }],
        })),
        'errata-story-export/branches/main/associations.json': new TextEncoder().encode(JSON.stringify({
          tagIndex: { opener: ['pr-source'] },
          refIndex: { 'pr-source': [] },
        })),
        'errata-story-export/branches/main/generation-logs/log-1.json': new TextEncoder().encode(JSON.stringify({
          fragmentId: 'pr-source',
          prompt: 'prompt',
        })),
        'errata-story-export/branches/main/agent-blocks/example.json': new TextEncoder().encode(JSON.stringify({ ok: true })),
      })

      const imported = await importStoryFromZip(tmp.path, archive)
      const storage = getStorageBackend()
      const tree = await storage.readTree(`${tmp.path}/stories/${imported.id}`)

      expect(imported.name).toBe('Branched Archive Story (imported)')
      expect(tree['branches.json']).toBeDefined()

      const fragmentPath = Object.keys(tree).find((key) => key.startsWith('branches/main/fragments/') && key.endsWith('.json'))
      expect(fragmentPath).toBeTruthy()

      if (!fragmentPath) {
        throw new Error('Expected imported fragment path')
      }

      const fragment = JSON.parse(new TextDecoder().decode(tree[fragmentPath])) as { id: string }
      expect(fragment.id).not.toBe('pr-source')

      const chain = JSON.parse(new TextDecoder().decode(tree['branches/main/prose-chain.json'])) as {
        entries: Array<{ proseFragments: string[]; active: string }>
      }
      expect(chain.entries[0]?.active).toBe(fragment.id)
      expect(chain.entries[0]?.proseFragments).toEqual([fragment.id])

      const associations = JSON.parse(new TextDecoder().decode(tree['branches/main/associations.json'])) as {
        tagIndex: Record<string, string[]>
      }
      expect(associations.tagIndex.opener).toEqual([fragment.id])

      const log = JSON.parse(new TextDecoder().decode(tree['branches/main/generation-logs/log-1.json'])) as { fragmentId: string }
      expect(log.fragmentId).toBe(fragment.id)

      const copied = JSON.parse(new TextDecoder().decode(tree['branches/main/agent-blocks/example.json'])) as { ok: boolean }
      expect(copied.ok).toBe(true)
    } finally {
      await tmp.cleanup()
    }
  })
})