export function createKeyedSerialQueue() {
  const pending = new Map<string, Promise<void>>()

  return async function runByKey<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = pending.get(key) ?? Promise.resolve()
    let result!: T

    const next = previous
      .catch(() => {})
      .then(async () => {
        result = await operation()
      })

    pending.set(key, next)

    try {
      await next
      return result
    } finally {
      if (pending.get(key) === next) {
        pending.delete(key)
      }
    }
  }
}

interface DebouncedBatchQueueOptions<T> {
  delayMs: number
  flush: (key: string, items: T[]) => Promise<void>
}

export function createDebouncedKeyedBatchQueue<T>(options: DebouncedBatchQueueOptions<T>) {
  const pendingTimers = new Map<string, NodeJS.Timeout>()
  const pendingItems = new Map<string, T[]>()

  return function enqueue(key: string, item: T): void {
    const items = pendingItems.get(key) ?? []
    items.push(item)
    pendingItems.set(key, items)

    if (pendingTimers.has(key)) return

    const timer = setTimeout(async () => {
      pendingTimers.delete(key)
      const batch = pendingItems.get(key) ?? []
      pendingItems.delete(key)
      if (batch.length === 0) return
      await options.flush(key, batch)
    }, options.delayMs)

    pendingTimers.set(key, timer)
  }
}