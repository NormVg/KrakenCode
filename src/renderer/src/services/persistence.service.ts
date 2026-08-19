export const PersistenceService = {
  async read<T>(key: string): Promise<T | null> {
    try {
      return await window.api.storeRead(key)
    } catch (e) {
      console.error(`[PersistenceService] Failed to read ${key}:`, e)
      return null
    }
  },

  async write<T>(key: string, data: T): Promise<boolean> {
    try {
      // Vue reactive proxies cannot be serialized by Electron's structured
      // clone algorithm across IPC. Convert to plain objects first.
      const plainData = JSON.parse(JSON.stringify(data))
      await window.api.storeWrite(key, plainData)
      return true
    } catch (e) {
      console.error(`[PersistenceService] Failed to write ${key}:`, e)
      return false
    }
  }
}
