import type { StoryMeta } from '@/server/fragments/schema'
import { serializeFrontmatter } from './frontmatter'

export function serializeStoryMeta(story: StoryMeta): string {
  return serializeFrontmatter(
    {
      id: story.id,
      name: story.name,
      coverImage: story.coverImage,
      summary: story.summary,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    },
    story.description,
  )
}

export function storyMetaFromMarkdown(attributes: Record<string, unknown>, body: string): StoryMeta | null {
  if (typeof attributes.id !== 'string' || typeof attributes.name !== 'string') return null
  return {
    id: attributes.id,
    name: attributes.name,
    description: body,
    coverImage: typeof attributes.coverImage === 'string' || attributes.coverImage === null
      ? attributes.coverImage as string | null
      : null,
    summary: typeof attributes.summary === 'string' ? attributes.summary : '',
    createdAt: typeof attributes.createdAt === 'string' ? attributes.createdAt : new Date().toISOString(),
    updatedAt: typeof attributes.updatedAt === 'string' ? attributes.updatedAt : new Date().toISOString(),
    settings: {
      outputFormat: 'markdown',
      enabledPlugins: [],
      summarizationThreshold: 4,
      maxSteps: 10,
      modelOverrides: {},
      generationMode: 'standard',
      disableLibrarianAutoAnalysis: false,
      autoApplyLibrarianSuggestions: false,
      disableLibrarianDirections: false,
      disableLibrarianSuggestions: false,
      contextOrderMode: 'simple',
      fragmentOrder: [],
      contextCompact: { type: 'proseLimit', value: 10 },
      summaryCompact: { maxCharacters: 12000, targetCharacters: 9000 },
      enableHierarchicalSummary: false,
      disableThinking: false,
    },
  }
}