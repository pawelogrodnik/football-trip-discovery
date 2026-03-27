type Loader<V> = () => Promise<V> | V;

type CacheEntry<V> = {
  value: V;
  expiresAt: number;
};

export class TtlCache<K, V> {
  private readonly store = new Map<K, CacheEntry<V>>();

  constructor(private readonly ttlMs: number) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('TtlCache requires ttlMs > 0');
    }
  }

  async get(key: K, loader: Loader<V>): Promise<V> {
    const now = Date.now();
    const cached = this.store.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const value = await loader();
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
    return value;
  }

  clear(key?: K) {
    if (typeof key === 'undefined') {
      this.store.clear();
    } else {
      this.store.delete(key);
    }
  }
}
