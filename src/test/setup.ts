function installStorage(storage: Storage, target: { localStorage?: Storage }): void {
  Object.defineProperty(target, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
}

const win = globalThis as unknown as { localStorage?: Storage }

if (win.localStorage == null) {
  let items = new Map<string, string>()
  const storage: Storage = {
    get length(): number {
      return items.size
    },
    clear(): void {
      items = new Map()
    },
    getItem(key: string): string | null {
      return items.get(key) ?? null
    },
    key(index: number): string | null {
      return Array.from(items.keys())[index] ?? null
    },
    removeItem(key: string): void {
      items.delete(key)
    },
    setItem(key: string, value: string): void {
      items.set(key, String(value))
    },
  }
  installStorage(storage, globalThis)
  if (typeof window !== 'undefined' && window !== globalThis) {
    installStorage(storage, window as unknown as { localStorage?: Storage })
  }
}

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:tandem-test'
  URL.revokeObjectURL = () => undefined
}
