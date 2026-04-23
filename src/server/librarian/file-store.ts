import {
  getLibrarianAnalysisFile,
  getLibrarianAnalysisIndexFile,
  getLibrarianChatHistoryFile,
  getLibrarianConversationHistoryFile,
  getLibrarianConversationsIndexFile,
  getLibrarianStateFile,
  getLibrarianAnalysesDir,
} from './layout'
import { getStorageBackend } from '../storage/runtime'

export async function writeLibrarianAnalysisRecord(
  dataDir: string,
  storyId: string,
  analysisId: string,
  value: unknown,
): Promise<void> {
  await getStorageBackend().writeJson(getLibrarianAnalysisFile(dataDir, storyId, analysisId), value)
}

export async function readLibrarianAnalysisRecord<T>(
  dataDir: string,
  storyId: string,
  analysisId: string,
): Promise<T | null> {
  return getStorageBackend().readJsonIfExists<T>(getLibrarianAnalysisFile(dataDir, storyId, analysisId))
}

export async function deleteLibrarianAnalysisRecord(
  dataDir: string,
  storyId: string,
  analysisId: string,
): Promise<boolean> {
  const storage = getStorageBackend()
  const path = getLibrarianAnalysisFile(dataDir, storyId, analysisId)
  if (!(await storage.exists(path))) return false
  await storage.delete(path)
  return true
}

export async function listLibrarianAnalysisIds(
  dataDir: string,
  storyId: string,
): Promise<string[]> {
  const storage = getStorageBackend()
  const dir = getLibrarianAnalysesDir(dataDir, storyId)
  if (!(await storage.exists(dir))) return []

  return (await storage.listDir(dir))
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => entry.replace(/\.json$/i, ''))
}

export async function writeLibrarianAnalysisIndexRecord(
  dataDir: string,
  storyId: string,
  value: unknown,
): Promise<void> {
  await getStorageBackend().writeJson(getLibrarianAnalysisIndexFile(dataDir, storyId), value)
}

export async function readLibrarianAnalysisIndexRecord<T>(
  dataDir: string,
  storyId: string,
): Promise<T | null> {
  return getStorageBackend().readJsonIfExists<T>(getLibrarianAnalysisIndexFile(dataDir, storyId))
}

export async function readLibrarianStateRecord<T>(
  dataDir: string,
  storyId: string,
  fallback: T,
): Promise<T> {
  return getStorageBackend().readJsonOrDefault(getLibrarianStateFile(dataDir, storyId), fallback)
}

export async function writeLibrarianStateRecord(
  dataDir: string,
  storyId: string,
  value: unknown,
): Promise<void> {
  await getStorageBackend().writeJson(getLibrarianStateFile(dataDir, storyId), value)
}

export async function readLibrarianChatHistoryRecord<T>(
  dataDir: string,
  storyId: string,
  fallback: T,
): Promise<T> {
  return getStorageBackend().readJsonOrDefault(getLibrarianChatHistoryFile(dataDir, storyId), fallback)
}

export async function writeLibrarianChatHistoryRecord(
  dataDir: string,
  storyId: string,
  value: unknown,
): Promise<void> {
  await getStorageBackend().writeJson(getLibrarianChatHistoryFile(dataDir, storyId), value)
}

export async function deleteLibrarianChatHistoryRecord(
  dataDir: string,
  storyId: string,
): Promise<void> {
  await getStorageBackend().deleteIfExists(getLibrarianChatHistoryFile(dataDir, storyId))
}

export async function readLibrarianConversationsIndexRecord<T>(
  dataDir: string,
  storyId: string,
  fallback: T,
): Promise<T> {
  return getStorageBackend().readJsonOrDefault(getLibrarianConversationsIndexFile(dataDir, storyId), fallback)
}

export async function writeLibrarianConversationsIndexRecord(
  dataDir: string,
  storyId: string,
  value: unknown,
): Promise<void> {
  await getStorageBackend().writeJson(getLibrarianConversationsIndexFile(dataDir, storyId), value)
}

export async function readLibrarianConversationHistoryRecord<T>(
  dataDir: string,
  storyId: string,
  conversationId: string,
  fallback: T,
): Promise<T> {
  return getStorageBackend().readJsonOrDefault(getLibrarianConversationHistoryFile(dataDir, storyId, conversationId), fallback)
}

export async function writeLibrarianConversationHistoryRecord(
  dataDir: string,
  storyId: string,
  conversationId: string,
  value: unknown,
): Promise<void> {
  await getStorageBackend().writeJson(getLibrarianConversationHistoryFile(dataDir, storyId, conversationId), value)
}

export async function deleteLibrarianConversationHistoryRecord(
  dataDir: string,
  storyId: string,
  conversationId: string,
): Promise<void> {
  await getStorageBackend().deleteIfExists(getLibrarianConversationHistoryFile(dataDir, storyId, conversationId))
}