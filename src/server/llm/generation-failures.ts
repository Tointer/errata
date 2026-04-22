import { join } from 'node:path'
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

function failureLogsDir(dataDir: string): string {
  return join(process.env.GLOBAL_DATA_DIR?.trim() || dataDir, 'logs', 'generation-failures')
}

function failureLogPath(dataDir: string, logId: string): string {
  return join(failureLogsDir(dataDir), `${logId}.json`)
}

export async function saveGenerationFailureLog(
  dataDir: string,
  log: GenerationFailureLog,
): Promise<string> {
  const storage = getStorageBackend()
  const dir = failureLogsDir(dataDir)
  await storage.ensureDir(dir)
  const path = failureLogPath(dataDir, log.id)
  await storage.writeJson(path, log)
  return path
}

export async function listGenerationFailureLogs(dataDir: string): Promise<GenerationFailureLog[]> {
  const storage = getStorageBackend()
  const dir = failureLogsDir(dataDir)
  const entries = await storage.listDir(dir)
  const logs: GenerationFailureLog[] = []

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    const raw = await storage.readText(join(dir, entry))
    logs.push(JSON.parse(raw) as GenerationFailureLog)
  }

  logs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  return logs
}
