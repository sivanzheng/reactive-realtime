import { MessageQueue } from '../core/common/MessageQueue'


describe('MessageQueue', () => {
	let messageQueue: MessageQueue<number>
  
	beforeEach(() => {
		messageQueue = new MessageQueue<number>()
	})
  
	afterEach(() => {
		messageQueue.clear()
	})
  
	it('should enqueue message', () => {
		messageQueue.enqueue(1)
		messageQueue.getObservable().subscribe((value) => {
			expect(value).toBe(1)
		})
	})
  
	it('should dequeue message', async () => {
		const promise = messageQueue.dequeue()
		messageQueue.enqueue(2)
		const result = await promise
		expect(result).toBe(2)
	})
  
	it('should clear the queue', () => {
		messageQueue.enqueue(3)
		messageQueue.clear()
		messageQueue.getObservable().subscribe({
			next: () => {
				fail('Received a message after clearing the queue')
			},
			complete: () => {
				expect(true).toBe(true)
			}
		})
	})
  
	it('should subscribe to the queue', () => {
		const callback = jest.fn()
		const subscription = messageQueue.subscribe(callback)
		messageQueue.enqueue(4)
		expect(callback).toHaveBeenCalledWith(4)
		subscription.unsubscribe()
	})
})