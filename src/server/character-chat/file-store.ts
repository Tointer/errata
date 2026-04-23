import { getCharacterChatConversationFile, getCharacterChatConversationsDir } from './layout'
import { getStorageBackend } from '../storage/runtime'

export async function writeCharacterChatConversationRecord(
  dataDir: string,
  storyId: string,
  conversationId: string,
  value: unknown,
): Promise<void> {
  await getStorageBackend().writeJson(getCharacterChatConversationFile(dataDir, storyId, conversationId), value)
}

export async function readCharacterChatConversationRecord<T>(
  dataDir: string,
  storyId: string,
  conversationId: string,
): Promise<T | null> {
  return getStorageBackend().readJsonIfExists<T>(getCharacterChatConversationFile(dataDir, storyId, conversationId))
}

export async function listCharacterChatConversationIds(
  dataDir: string,
  storyId: string,
): Promise<string[]> {
  return (await getStorageBackend().listDir(getCharacterChatConversationsDir(dataDir, storyId)))
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => entry.replace(/\.json$/i, ''))
}

export async function deleteCharacterChatConversationRecord(
  dataDir: string,
  storyId: string,
  conversationId: string,
): Promise<boolean> {
  const storage = getStorageBackend()
  const path = getCharacterChatConversationFile(dataDir, storyId, conversationId)
  if (!(await storage.exists(path))) return false
  await storage.delete(path)
  return true
}