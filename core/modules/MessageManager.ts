import { Subject } from 'rxjs'
import { WebSocketSubject } from 'rxjs/webSocket'
import { MessageType } from '../types'
import { MessageQueue } from '../common/MessageQueue'

export default class MessageManager {
	private queue: MessageQueue<MessageType>
	private isSending = false
	private isWsReady = false

	private webSocketSubject: WebSocketSubject<MessageType> | undefined

	constructor(
        private connectionStatusChannel: Subject<boolean>,
        messageQueueSize: number
	) {
		this.queue = new MessageQueue<MessageType>(messageQueueSize)
		this.connectionStatusChannel.subscribe((status) => {
			this.isWsReady = status
			if (status && this.webSocketSubject && !this.webSocketSubject.closed) {
				this.releaseMessages()
			}
		})
	}

	public setWsSubject(webSocketSubject: WebSocketSubject<MessageType>) {
		this.webSocketSubject = webSocketSubject
	}

	public async releaseMessages() {
		this.isSending = true
		const messages = await new Promise<MessageType[]>((resolve) => {
			const messages: MessageType[] = []
			const subscription = this.queue.subscribe((message) => {
				messages.push(message)
			})
			subscription.unsubscribe()
			resolve(messages)
		})

		for (const message of messages) {
			this.webSocketSubject!.next(message)        
		}
		this.queue.clear() 
		this.isSending = false
	}

	public sendMessage<T extends MessageType>(data: T) {
		if (
			!this.webSocketSubject
            || this.webSocketSubject.closed
            || !this.isWsReady
            || this.isSending
		) {
			this.queue.enqueue(data)
			return
		}
		this.webSocketSubject.next(data)
	}
}