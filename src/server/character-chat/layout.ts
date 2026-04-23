import { getStoryInternalPath } from '../storage/story-layout'

function getCharacterChatPath(dataDir: string, storyId: string, ...segments: string[]): string {
  return getStoryInternalPath(dataDir, storyId, 'character-chat', ...segments)
}

export function getCharacterChatDir(dataDir: string, storyId: string): string {
  return getCharacterChatPath(dataDir, storyId)
}

export function getCharacterChatConversationsDir(dataDir: string, storyId: string): string {
  return getCharacterChatPath(dataDir, storyId, 'conversations')
}

export function getCharacterChatConversationFile(dataDir: string, storyId: string, conversationId: string): string {
  return getCharacterChatPath(dataDir, storyId, 'conversations', `${conversationId}.json`)
}