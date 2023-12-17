import { ReplaySubject, firstValueFrom, Subscription } from 'rxjs'

export class MessageQueue<T> {
	private queue: ReplaySubject<T>

	constructor(private capacity?: number) {
		this.queue = new ReplaySubject<T>(this.capacity)
	}

	enqueue(message: T) {
		this.queue.next(message)
	}

	dequeue(): Promise<T | undefined> {
		return firstValueFrom(this.queue)
	}

	clear() {
		this.queue.complete()
		this.queue = new ReplaySubject<T>(this.capacity)
	}

	getObservable(): ReplaySubject<T> {
		return this.queue
	}

	subscribe(callback: (message: T) => void): Subscription {
		return this.queue.subscribe(callback)
	}
}