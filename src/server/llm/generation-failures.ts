import { getGenerationFailureLogPath, getGenerationFailureLogsDir } from '../storage/global-layout'
import { getStorageBackend } from '../storage/runtime'

export interface GenerationFailureLog {
  id: string
  createdAt: string
  storyId: string
  input: string
  generatedText: string
  error: string
  model: string
  durationMs: number
  fragmentId: string | null
  messages: Array<{ role: string; content: string }>
  toolCalls: Array<{ toolName: string; args: Record<string, unknown>; result: unknown }>
  finishReason: string
  stepCount: number
  reasoning?: string
}

export async function saveGenerationFailureLog(
  dataDir: string,
  log: GenerationFailureLog,
): Promise<string> {
  const storage = getStorageBackend()
  const dir = getGenerationFailureLogsDir(dataDir)
  await storage.ensureDir(dir)
  const path = getGenerationFailureLogPath(dataDir, log.id)
  await storage.writeJson(path, log)
  return path
}

export async function listGenerationFailureLogs(dataDir: string): Promise<GenerationFailureLog[]> {
  const storage = getStorageBackend()
  const dir = getGenerationFailureLogsDir(dataDir)
  const entries = await storage.listDir(dir)
  const logs: GenerationFailureLog[] = []

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    const raw = await storage.readText(getGenerationFailureLogPath(dataDir, entry.replace(/\.json$/i, '')))
    logs.push(JSON.parse(raw) as GenerationFailureLog)
  }

  logs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  return logs
}
