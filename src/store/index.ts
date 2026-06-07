const store = new Map<string, unknown>()

export function getItem<T>(key: string): T | undefined {
  return store.get(key) as T | undefined
}

export function setItem(key: string, value: unknown): void {
  store.set(key, value)
}

export function removeItem(key: string): void {
  store.delete(key)
}

export function clear(): void {
  store.clear()
}
