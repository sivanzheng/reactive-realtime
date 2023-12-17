import {
	timer,
	filter,
	Subject,
	Subscription,
} from 'rxjs'

import { SubscribeParams } from '../types'
import { COMMAND, Messages } from '../messages'

import Cache from '../common/Cache'
import { ERROR_MESSAGES } from '../common/errorMessages'

import WebSocketAgent from '../modules/WebsocketAgent'

export function	createSubscriptionFeed<R>(
	wsAgent: WebSocketAgent,
	subParamsCache: Cache<Messages.Client.Subscribe>,
	params: SubscribeParams,
	renewAfterSeconds?: number
) {
	const { topic, namespace } = params
	const requestKey = namespace + topic


	const subject = new Subject<R>()
	const subscription = new Subscription()

	const subscribeMessage: Messages.Client.Subscribe = {
		topic,
		nsp: namespace,
		cmd: COMMAND.MESSAGE_CMD_SUBSCRIBE,
	}
	subParamsCache.create(requestKey, subscribeMessage)
	wsAgent.send(subscribeMessage)

	subscription
		.add(
			wsAgent.subscribe({
				next: (msg) => {
					const message = msg as Messages.Server.Subscribed<R>
					if (!message.topic || !message.nsp) return

					const responseKey = message.nsp + message.topic
					if (responseKey !== requestKey) return

					if (msg.cmd === COMMAND.MESSAGE_CMD_SUBSCRIBE_ERROR) {
						subject.error(new Error(msg.message))
					}

					if (msg.cmd === COMMAND.MESSAGE_CMD_PUBLISH) {
						const message = msg as Messages.Server.Subscribed<R>
						subject.next(message.data)
					}
				},
				error: (err: Error) => {
					subject.error(new Error(err.message || ERROR_MESSAGES.SUBSCRIBE_FAILED))
				},
				complete: () => {
					subject.complete()
				}
			})
		)
 
	if (renewAfterSeconds) {
		subscription
			.add(
				timer(renewAfterSeconds * 1000, 1 * 1000)
					.pipe(filter((_, index) => index % renewAfterSeconds === 0))
					.subscribe({
						next: () => {
							const subscribeData: Messages.Client.Subscribe = {
								topic,
								nsp: namespace,
								cmd: COMMAND.MESSAGE_CMD_SUBSCRIBE,
							}
							wsAgent.send(subscribeData)
						}
					})
			)
	}


	const unsubscribe = () => {
		subParamsCache.delete(requestKey)
		const unSubScribeMessage: Messages.Client.UnSubscribe = {
			topic,
			nsp: namespace,
			cmd: COMMAND.MESSAGE_CMD_UNSUBSCRIBE,
		}
		wsAgent.send(unSubScribeMessage)
		subscription.unsubscribe()
		subject.unsubscribe()
	}
	return ({
		unsubscribe,
		subject: subject.asObservable(),
	})
}

export function resendSubMessage(
	wsAgent: WebSocketAgent,
	subParamsCache: Cache<Messages.Client.Subscribe>,
) {
	if (subParamsCache.size === 0) return
	subParamsCache
		.readInOrder()
		.forEach((subParam) => {
			wsAgent.send(subParam)
		})
}