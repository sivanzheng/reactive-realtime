import { Observer, Subject } from 'rxjs'
import { WebSocketSubject } from 'rxjs/webSocket'

import { MessageType } from '../types'
import { BasicMessage, COMMAND } from '../messages'

export default class SurviveManager {
	private observer: Observer<MessageType> | null = null

	constructor(
		private webSocketSubject: WebSocketSubject<MessageType>,
	) { }

	private createSubscriber() {
		this.observer = new Subject<MessageType>()
		this.observer.next = ((value: MessageType) => {
			const serverMsg = value as BasicMessage<unknown>
			if (serverMsg.cmd === COMMAND.MESSAGE_CMD_PING) {
				this.webSocketSubject.next({
					cmd: COMMAND.MESSAGE_CMD_PONG
				})
			}          
		})
		
	}

	stayALive() {
		this.createSubscriber()
		this.webSocketSubject.subscribe(this.observer!)
	}

	destroy() {
		this.observer?.complete()
	}
}