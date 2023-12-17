export default class Cache<T> {
	private cache: Map<string, T>

	constructor() {
		this.cache = new Map()
	}

	create(key: string, value: T) {
		this.cache.set(key, value)
	}

	read(key: string): T | undefined {
		return this.cache.get(key)
	}

	delete(key: string) {
		this.cache.delete(key)
	}

	readInOrder(): T[] {
		return Array.from(this.cache.values())
	}

	get size() {
		return this.cache.size
	}
}