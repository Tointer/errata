import { getCharacterChatConversationFile, getCharacterChatConversationsDir } from './layout'
import {
  deleteJsonRecord,
  listJsonRecordIds,
  readJsonRecordIfExists,
  writeJsonRecord,
} from '../storage/stores/json-records'

export async function writeCharacterChatConversationRecord(
  dataDir: string,
  storyId: string,
  conversationId: string,
  value: unknown,
): Promise<void> {
  await writeJsonRecord(getCharacterChatConversationFile(dataDir, storyId, conversationId), value)
}

export async function readCharacterChatConversationRecord<T>(
  dataDir: string,
  storyId: string,
  conversationId: string,
): Promise<T | null> {
  return readJsonRecordIfExists<T>(getCharacterChatConversationFile(dataDir, storyId, conversationId))
}

export async function listCharacterChatConversationIds(
  dataDir: string,
  storyId: string,
): Promise<string[]> {
  return listJsonRecordIds(getCharacterChatConversationsDir(dataDir, storyId))
}

export async function deleteCharacterChatConversationRecord(
  dataDir: string,
  storyId: string,
  conversationId: string,
): Promise<boolean> {
  return deleteJsonRecord(getCharacterChatConversationFile(dataDir, storyId, conversationId))
}