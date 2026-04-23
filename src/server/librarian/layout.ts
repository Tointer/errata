import { getStoryInternalPath } from '../storage/story-layout'

function getLibrarianPath(dataDir: string, storyId: string, ...segments: string[]): string {
  return getStoryInternalPath(dataDir, storyId, 'librarian', ...segments)
}

export function getLibrarianDir(dataDir: string, storyId: string): string {
  return getLibrarianPath(dataDir, storyId)
}

export function getLibrarianAnalysesDir(dataDir: string, storyId: string): string {
  return getLibrarianPath(dataDir, storyId, 'analyses')
}

export function getLibrarianAnalysisFile(dataDir: string, storyId: string, analysisId: string): string {
  return getLibrarianPath(dataDir, storyId, 'analyses', `${analysisId}.json`)
}

export function getLibrarianStateFile(dataDir: string, storyId: string): string {
  return getLibrarianPath(dataDir, storyId, 'state.json')
}

export function getLibrarianAnalysisIndexFile(dataDir: string, storyId: string): string {
  return getLibrarianPath(dataDir, storyId, 'index.json')
}

export function getLibrarianChatHistoryFile(dataDir: string, storyId: string): string {
  return getLibrarianPath(dataDir, storyId, 'chat-history.json')
}

export function getLibrarianConversationsIndexFile(dataDir: string, storyId: string): string {
  return getLibrarianPath(dataDir, storyId, 'conversations.json')
}

export function getLibrarianConversationHistoryFile(dataDir: string, storyId: string, conversationId: string): string {
  return getLibrarianPath(dataDir, storyId, `chat-${conversationId}.json`)
}