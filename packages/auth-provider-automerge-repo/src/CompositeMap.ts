/**
 * A map that supports tuples as keys
 */
export class CompositeMap<K extends string[], V> {
  private readonly map = new Map<string, V>()
  private readonly toCompositeKey = (key: K) => key.join(',')
  private readonly fromCompositeKey = (key: string) => key.split(',') as K

  clear() {
    this.map.clear()
  }

  delete(key: K) {
    const compositeKey = this.toCompositeKey(key)
    return this.map.delete(compositeKey)
  }

  get(key: K) {
    const compositeKey = this.toCompositeKey(key)
    return this.map.get(compositeKey)
  }

  set(key: K, value: V) {
    const compositeKey = this.toCompositeKey(key)
    this.map.set(compositeKey, value)
  }

  has(key: K) {
    const compositeKey = this.toCompositeKey(key)
    return this.map.has(compositeKey)
  }

  keys() {
    const keys = [...this.map.keys()]
    return keys.map(key => this.fromCompositeKey(key))
  }

  get size() {
    return this.map.size
  }
}
