import { join } from 'node:path'
import { getInternalStoryPath } from '../md-files/paths'

function storyInternalPath(dataDir: string, storyId: string, ...segments: string[]): string {
  return getInternalStoryPath(dataDir, storyId, ...segments)
}

function characterChatPath(dataDir: string, storyId: string, ...segments: string[]): string {
  return storyInternalPath(dataDir, storyId, 'character-chat', ...segments)
}

function librarianPath(dataDir: string, storyId: string, ...segments: string[]): string {
  return storyInternalPath(dataDir, storyId, 'librarian', ...segments)
}

export function getStoriesDir(dataDir: string): string {
  return join(dataDir, 'stories')
}

export function getStoryDir(dataDir: string, storyId: string): string {
  return join(getStoriesDir(dataDir), storyId)
}

export function resolveGlobalDataDir(dataDir: string): string {
  return process.env.GLOBAL_DATA_DIR?.trim() || dataDir
}

export function getGlobalStoragePath(dataDir: string, ...segments: string[]): string {
  return join(resolveGlobalDataDir(dataDir), ...segments)
}

export function getAppLogsDir(dataDir: string): string {
  return getGlobalStoragePath(dataDir, 'logs')
}

export function getAppLogFilePath(dataDir: string, index: number): string {
  return getGlobalStoragePath(dataDir, 'logs', `app-${index}.jsonl`)
}

export function getStoryInternalDir(dataDir: string, storyId: string, ...segments: string[]): string {
  return storyInternalPath(dataDir, storyId, ...segments)
}

export function getCharacterChatDir(dataDir: string, storyId: string): string {
  return characterChatPath(dataDir, storyId)
}

export function getCharacterChatConversationsDir(dataDir: string, storyId: string): string {
  return characterChatPath(dataDir, storyId, 'conversations')
}

export function getCharacterChatConversationFile(dataDir: string, storyId: string, conversationId: string): string {
  return characterChatPath(dataDir, storyId, 'conversations', `${conversationId}.json`)
}

export function getProseChainFile(dataDir: string, storyId: string): string {
  return getInternalStoryPath(dataDir, storyId, 'prose-chain.json')
}

export function getAssociationsFile(dataDir: string, storyId: string): string {
  return getInternalStoryPath(dataDir, storyId, 'associations.json')
}

export function getLibrarianDir(dataDir: string, storyId: string): string {
  return librarianPath(dataDir, storyId)
}

export function getLibrarianAnalysesDir(dataDir: string, storyId: string): string {
  return librarianPath(dataDir, storyId, 'analyses')
}

export function getLibrarianAnalysisFile(dataDir: string, storyId: string, analysisId: string): string {
  return librarianPath(dataDir, storyId, 'analyses', `${analysisId}.json`)
}

export function getLibrarianStateFile(dataDir: string, storyId: string): string {
  return librarianPath(dataDir, storyId, 'state.json')
}

export function getLibrarianAnalysisIndexFile(dataDir: string, storyId: string): string {
  return librarianPath(dataDir, storyId, 'index.json')
}

export function getLibrarianChatHistoryFile(dataDir: string, storyId: string): string {
  return librarianPath(dataDir, storyId, 'chat-history.json')
}

export function getLibrarianConversationsIndexFile(dataDir: string, storyId: string): string {
  return librarianPath(dataDir, storyId, 'conversations.json')
}

export function getLibrarianConversationHistoryFile(dataDir: string, storyId: string, conversationId: string): string {
  return librarianPath(dataDir, storyId, `chat-${conversationId}.json`)
}