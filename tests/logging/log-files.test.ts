import { describe, expect, it } from 'vitest'
import {
  getLogFilePath,
  getLogFilesDir,
  isAppLogFileName,
  parseAppLogFileIndex,
} from '@/server/logging/log-files'

describe('log files', () => {
  it('builds app log paths and recognizes canonical log file names', () => {
    expect(getLogFilesDir('/vault')).toContain('logs')
    expect(getLogFilePath('/vault', 2)).toContain('app-2.jsonl')
    expect(isAppLogFileName('app-0.jsonl')).toBe(true)
    expect(isAppLogFileName('app-15.jsonl')).toBe(true)
    expect(isAppLogFileName('app-x.jsonl')).toBe(false)
    expect(isAppLogFileName('other.json')).toBe(false)
  })

  it('parses canonical app log file indexes', () => {
    expect(parseAppLogFileIndex('app-0.jsonl')).toBe(0)
    expect(parseAppLogFileIndex('app-12.jsonl')).toBe(12)
    expect(parseAppLogFileIndex('invalid.jsonl')).toBeNull()
  })
})