import { InstructionSetSchema, type InstructionSet } from './schema'
import { getInstructionSetsDir } from '../storage/global-layout'
import { getStorageBackend } from '../storage/runtime'

interface ParsedOverride {
  name: string
  priority: number
  matcher: (modelId: string) => boolean
  instructions: Record<string, string>
}

function parseModelMatch(pattern: string): (modelId: string) => boolean {
  // Check if it's a regex pattern: /pattern/flags
  const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/)
  if (regexMatch) {
    const regex = new RegExp(regexMatch[1], regexMatch[2])
    return (modelId: string) => regex.test(modelId)
  }
  // Exact match
  return (modelId: string) => modelId === pattern
}

class InstructionRegistry {
  private defaults = new Map<string, string>()
  private overrides: ParsedOverride[] = []

  registerDefault(key: string, text: string): void {
    this.defaults.set(key, text)
  }

  resolve(key: string, modelId?: string): string {
    if (modelId) {
      for (const override of this.overrides) {
        if (override.matcher(modelId) && key in override.instructions) {
          return override.instructions[key]
        }
      }
    }

    const defaultText = this.defaults.get(key)
    if (defaultText === undefined) {
      throw new Error(`Instruction key "${key}" not registered`)
    }
    return defaultText
  }

  getDefault(key: string): string | undefined {
    return this.defaults.get(key)
  }

  listKeys(): string[] {
    return [...this.defaults.keys()]
  }

  async loadOverrides(dataDir: string): Promise<void> {
    this.overrides = []
    const dir = getInstructionSetsDir(dataDir)
    const storage = getStorageBackend()
    const entries = await storage.listDir(dir)

    const parsed: ParsedOverride[] = []

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      try {
        const raw = await storage.readText(getInstructionSetsDir(dataDir, ) + '/' + entry)
        const data = JSON.parse(raw)
        const result = InstructionSetSchema.safeParse(data)
        if (!result.success) {
          console.warn(`[instructions] Skipping malformed ${entry}: validation failed`)
          continue
        }
        const set: InstructionSet = result.data
        parsed.push({
          name: set.name,
          priority: set.priority,
          matcher: parseModelMatch(set.modelMatch),
          instructions: set.instructions,
        })
      } catch (err) {
        console.warn(`[instructions] Skipping ${entry}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Sort by priority ascending (lower number = higher priority = checked first)
    parsed.sort((a, b) => a.priority - b.priority)
    this.overrides = parsed
  }

  clear(): void {
    this.defaults.clear()
    this.overrides = []
  }
}

export const instructionRegistry = new InstructionRegistry()
