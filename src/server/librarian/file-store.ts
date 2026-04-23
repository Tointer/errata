import {
  getLibrarianAnalysisFile,
  getLibrarianAnalysisIndexFile,
  getLibrarianChatHistoryFile,
  getLibrarianConversationHistoryFile,
  getLibrarianConversationsIndexFile,
  getLibrarianStateFile,
  getLibrarianAnalysesDir,
} from './layout'
import {
  deleteJsonRecord,
  deleteJsonRecordIfExists,
  listJsonRecordIds,
  readJsonRecordIfExists,
  readJsonRecordOrDefault,
  writeJsonRecord,
} from '../storage/stores/json-records'

export async function writeLibrarianAnalysisRecord(
  dataDir: string,
  storyId: string,
  analysisId: string,
  value: unknown,
): Promise<void> {
  await writeJsonRecord(getLibrarianAnalysisFile(dataDir, storyId, analysisId), value)
}

export async function readLibrarianAnalysisRecord<T>(
  dataDir: string,
  storyId: string,
  analysisId: string,
): Promise<T | null> {
  return readJsonRecordIfExists<T>(getLibrarianAnalysisFile(dataDir, storyId, analysisId))
}

export async function deleteLibrarianAnalysisRecord(
  dataDir: string,
  storyId: string,
  analysisId: string,
): Promise<boolean> {
  return deleteJsonRecord(getLibrarianAnalysisFile(dataDir, storyId, analysisId))
}

export async function listLibrarianAnalysisIds(
  dataDir: string,
  storyId: string,
): Promise<string[]> {
  return listJsonRecordIds(getLibrarianAnalysesDir(dataDir, storyId))
}

export async function writeLibrarianAnalysisIndexRecord(
  dataDir: string,
  storyId: string,
  value: unknown,
): Promise<void> {
  await writeJsonRecord(getLibrarianAnalysisIndexFile(dataDir, storyId), value)
}

export async function readLibrarianAnalysisIndexRecord<T>(
  dataDir: string,
  storyId: string,
): Promise<T | null> {
  return readJsonRecordIfExists<T>(getLibrarianAnalysisIndexFile(dataDir, storyId))
}

export async function readLibrarianStateRecord<T>(
  dataDir: string,
  storyId: string,
  fallback: T,
): Promise<T> {
  return readJsonRecordOrDefault(getLibrarianStateFile(dataDir, storyId), fallback)
}

export async function writeLibrarianStateRecord(
  dataDir: string,
  storyId: string,
  value: unknown,
): Promise<void> {
  await writeJsonRecord(getLibrarianStateFile(dataDir, storyId), value)
}

export async function readLibrarianChatHistoryRecord<T>(
  dataDir: string,
  storyId: string,
  fallback: T,
): Promise<T> {
  return readJsonRecordOrDefault(getLibrarianChatHistoryFile(dataDir, storyId), fallback)
}

export async function writeLibrarianChatHistoryRecord(
  dataDir: string,
  storyId: string,
  value: unknown,
): Promise<void> {
  await writeJsonRecord(getLibrarianChatHistoryFile(dataDir, storyId), value)
}

export async function deleteLibrarianChatHistoryRecord(
  dataDir: string,
  storyId: string,
): Promise<void> {
  await deleteJsonRecordIfExists(getLibrarianChatHistoryFile(dataDir, storyId))
}

export async function readLibrarianConversationsIndexRecord<T>(
  dataDir: string,
  storyId: string,
  fallback: T,
): Promise<T> {
  return readJsonRecordOrDefault(getLibrarianConversationsIndexFile(dataDir, storyId), fallback)
}

export async function writeLibrarianConversationsIndexRecord(
  dataDir: string,
  storyId: string,
  value: unknown,
): Promise<void> {
  await writeJsonRecord(getLibrarianConversationsIndexFile(dataDir, storyId), value)
}

export async function readLibrarianConversationHistoryRecord<T>(
  dataDir: string,
  storyId: string,
  conversationId: string,
  fallback: T,
): Promise<T> {
  return readJsonRecordOrDefault(getLibrarianConversationHistoryFile(dataDir, storyId, conversationId), fallback)
}

export async function writeLibrarianConversationHistoryRecord(
  dataDir: string,
  storyId: string,
  conversationId: string,
  value: unknown,
): Promise<void> {
  await writeJsonRecord(getLibrarianConversationHistoryFile(dataDir, storyId, conversationId), value)
}

export async function deleteLibrarianConversationHistoryRecord(
  dataDir: string,
  storyId: string,
  conversationId: string,
): Promise<void> {
  await deleteJsonRecordIfExists(getLibrarianConversationHistoryFile(dataDir, storyId, conversationId))
}