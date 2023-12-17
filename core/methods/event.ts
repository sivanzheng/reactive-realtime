import Q from 'q'
import { Subject } from 'rxjs'
import { COMMAND, Messages } from '../messages'
import { EventResponse, SendEventParams } from '../types'

import generateSequence from '../common/generateSequence'
import { ERROR_MESSAGES } from '../common/errorMessages'

import WebSocketAgent from '../modules/WebsocketAgent'

export function sendEventMethod<T>(wsAgent: WebSocketAgent, params: SendEventParams<T>): void
export function sendEventMethod<T>(wsAgent: WebSocketAgent, params: SendEventParams<T>, isWaitForRes: boolean): PromiseLike<EventResponse>
export function sendEventMethod<T>(wsAgent: WebSocketAgent, params: SendEventParams<T>, isWaitForRes?: boolean): PromiseLike<EventResponse> | void {
	const { data, name, namespace } = params

	const seq = generateSequence()

	const eventMessage: Messages.Client.Event<T> = {
		seq,
		name,
		data,
		nsp: namespace,
		cmd: COMMAND.MESSAGE_CMD_EVENT,
	}
	wsAgent.send(eventMessage)

	if (isWaitForRes) {
		const defer = Q.defer<EventResponse>()
		wsAgent.subscribe({
			next: (message) => {
				const msg = message as Messages.Server.Events<unknown>
				if (
					msg.name === name
                    && msg.nsp === namespace
                    && msg.seq === seq
				) {
					if (msg.cmd === COMMAND.MESSAGE_CMD_EVENT_ACK) {
						defer.resolve({ ack: true })
					}
					if (msg.cmd === COMMAND.MESSAGE_CMD_EVENT_ERROR) {
						defer.reject({
							ack: false,
							error: msg.message,
						})
					}
				}
			}
		})
		return defer.promise
	}
}

export function createEventWatcher<R>(
	wsAgent: WebSocketAgent,
	name: string,
	nsp: string,
	isWaitForRes = false
) {
	const subject = new Subject<R>()

	const subscription = wsAgent
		.subscribe({
			next: (message) => {
				const msg = message as Messages.Server.Events<R>
				if (msg.name === name && msg.nsp === nsp) {
					switch (msg.cmd) {
					case COMMAND.MESSAGE_CMD_EVENT:
						if (isWaitForRes) {
							const ackMessage: Messages.Client.EventACK = {
								name,
								nsp,
								seq: msg.seq,
								cmd: COMMAND.MESSAGE_CMD_EVENT_ACK
							}
							wsAgent.send(ackMessage)
						}
						subject.next(message.data as R)
						break
					case COMMAND.MESSAGE_CMD_EVENT_ERROR:
						subject.error(new Error((message as Messages.Server.EventError).message ?? ERROR_MESSAGES.WATCH_ERROR))
						break
					case COMMAND.MESSAGE_CMD_EVENT_ACK:
						break
					default: break
					}
				}
			}
		})
	const unsubscribe = () => {
		subject.unsubscribe()
		subscription.unsubscribe()
	}
	return ({
		subject,
		unsubscribe
	})
}