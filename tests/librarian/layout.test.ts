import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getLibrarianAnalysesDir,
  getLibrarianAnalysisFile,
  getLibrarianAnalysisIndexFile,
  getLibrarianChatHistoryFile,
  getLibrarianConversationHistoryFile,
  getLibrarianConversationsIndexFile,
  getLibrarianDir,
  getLibrarianStateFile,
} from '@/server/librarian/layout'

describe('librarian layout', () => {
  it('builds all librarian artifact paths under the story internal librarian directory', () => {
    expect(getLibrarianDir('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'librarian'))
    expect(getLibrarianAnalysesDir('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'librarian', 'analyses'))
    expect(getLibrarianAnalysisFile('/vault', 'story-1', 'analysis-a')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'librarian', 'analyses', 'analysis-a.json'))
    expect(getLibrarianStateFile('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'librarian', 'state.json'))
    expect(getLibrarianAnalysisIndexFile('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'librarian', 'index.json'))
    expect(getLibrarianChatHistoryFile('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'librarian', 'chat-history.json'))
    expect(getLibrarianConversationsIndexFile('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'librarian', 'conversations.json'))
    expect(getLibrarianConversationHistoryFile('/vault', 'story-1', 'conv-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'librarian', 'chat-conv-1.json'))
  })
})