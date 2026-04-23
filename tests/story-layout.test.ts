import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FRAGMENT_INTERNAL_INDEX_FILE,
  getCompiledStoryPath,
  getFragmentInternalIndexPath,
  getStoriesDir,
  getStoryDir,
  getStoryInternalDir,
  getStoryInternalPath,
  getStoryMetaPath,
  INTERNAL_DIR,
  STORY_META_FILE,
  STORY_OUTPUT_FILE,
} from '@/server/storage/story-layout'

describe('story layout', () => {
  it('builds story root and internal paths from one shared module', () => {
    expect(getStoriesDir('/vault')).toBe(join('/vault', 'stories'))
    expect(getStoryDir('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1'))
    expect(getStoryInternalDir('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata'))
    expect(getStoryInternalPath('/vault', 'story-1', 'librarian', 'state.json')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'librarian', 'state.json'))
  })

  it('exposes canonical story artifact constants and file paths', () => {
    expect(INTERNAL_DIR).toBe('.errata')
    expect(STORY_META_FILE).toBe('_story.md')
    expect(STORY_OUTPUT_FILE).toBe('story.md')
    expect(FRAGMENT_INTERNAL_INDEX_FILE).toBe('fragment-internals.json')

    expect(getStoryMetaPath('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', '_story.md'))
    expect(getCompiledStoryPath('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', 'story.md'))
    expect(getFragmentInternalIndexPath('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'fragment-internals.json'))
  })
})