import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getCharacterChatConversationFile,
  getCharacterChatConversationsDir,
  getCharacterChatDir,
} from '@/server/character-chat/layout'

describe('character chat layout', () => {
  it('builds character chat storage paths under the story internal directory', () => {
    expect(getCharacterChatDir('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'character-chat'))
    expect(getCharacterChatConversationsDir('/vault', 'story-1')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'character-chat', 'conversations'))
    expect(getCharacterChatConversationFile('/vault', 'story-1', 'cc-123')).toBe(join('/vault', 'stories', 'story-1', '.errata', 'character-chat', 'conversations', 'cc-123.json'))
  })
})