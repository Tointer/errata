import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getAppLogFilePath,
  getAppLogsDir,
  getGenerationFailureLogPath,
  getGenerationFailureLogsDir,
  getGlobalConfigPath,
  getGlobalStoragePath,
  getInstructionSetsDir,
  resolveGlobalDataDir,
} from '@/server/storage/global-layout'

describe('global layout', () => {
  afterEach(() => {
    delete process.env.GLOBAL_DATA_DIR
  })

  it('falls back to the active data dir when no global override is set', () => {
    expect(resolveGlobalDataDir('/vault')).toBe('/vault')
    expect(getGlobalStoragePath('/vault', 'logs')).toBe(join('/vault', 'logs'))
  })

  it('uses GLOBAL_DATA_DIR for shared app artifacts when present', () => {
    process.env.GLOBAL_DATA_DIR = '/global'

    expect(resolveGlobalDataDir('/vault')).toBe('/global')
    expect(getGlobalConfigPath('/vault')).toBe(join('/global', 'config.json'))
    expect(getInstructionSetsDir('/vault')).toBe(join('/global', 'instruction-sets'))
    expect(getAppLogsDir('/vault')).toBe(join('/global', 'logs'))
    expect(getAppLogFilePath('/vault', 2)).toBe(join('/global', 'logs', 'app-2.jsonl'))
    expect(getGenerationFailureLogsDir('/vault')).toBe(join('/global', 'logs', 'generation-failures'))
    expect(getGenerationFailureLogPath('/vault', 'fail-1')).toBe(join('/global', 'logs', 'generation-failures', 'fail-1.json'))
  })
})