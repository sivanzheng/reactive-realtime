import Q from 'q'
import { Subscription, timer } from 'rxjs'

import { COMMAND, Messages } from '../messages'
import { RequestResponse, SendRequestParams } from '../types'

import generateSequence from '../common/generateSequence'
import { ERROR_MESSAGES } from '../common/errorMessages'

import WebSocketAgent from '../modules/WebsocketAgent'

export function createRequest<T, R>(
	wsAgent: WebSocketAgent,
	params: SendRequestParams<T>,
	onResponse: (data: RequestResponse<R>) => void,
	onError?: (errMsg: Error) => void,
) {
	const sequence = generateSequence()
	const {
		data,
		path,
		namespace,
		timeout,
	} = params

	const eventMessage: Messages.Client.Request<T> = {
		data,
		path,
		seq: sequence,
		nsp: namespace,
		cmd: COMMAND.MESSAGE_CMD_REQUEST,
	}
	wsAgent.send(eventMessage)

	const subscription = new Subscription()

	if (timeout) {
		subscription
			.add(timer(timeout)
				.subscribe({
					next: () => {
						onResponse({ isTimeout: true })
						subscription.unsubscribe()
					}
				})
			)
	}


	const remoteSubscription = wsAgent.subscribe({
		next: (message) => {
			const msg = message as Messages.Server.Response<R>
			if (msg.seq !== sequence) return

			if (msg.cmd === COMMAND.MESSAGE_CMD_REQUEST_ACK) {
				onResponse({
					data: msg.data!,
					isTimeout: false,
				})
			}
			if (msg.cmd === COMMAND.MESSAGE_CMD_RESPONSE_ERROR) {
				if (onError) {
					onError(new Error(msg.message || ERROR_MESSAGES.BAD_REQUEST))
				}
			}
			subscription.unsubscribe()
		},
		error: (err: Error) => {
			if (onError) {
				onError(new Error(err.message || ERROR_MESSAGES.REQUEST_ERROR))
			}
		},
	})

	subscription.add(remoteSubscription)
}

export async function createSyncRequest<T, R>(
	wsAgent: WebSocketAgent,
	params: SendRequestParams<T>
) {
	const {
		data,
		path,
		namespace,
		timeout,
	} = params
	const defer = Q.defer<R>()
	const sequence = generateSequence()
	const requestMessage: Messages.Client.Request<T> = {
		data,
		path,
		seq: sequence,
		nsp: namespace,
		cmd: COMMAND.MESSAGE_CMD_REQUEST,
	}
	wsAgent.send(requestMessage)

	const subscription = new Subscription()
	if (timeout) {
		subscription.add(
			timer(timeout)
				.subscribe({
					next: () => {
						defer.reject(ERROR_MESSAGES.RESPONSE_TIMEOUT)
					}
				})
		)
	}

	const requestSubscription = wsAgent.subscribe({
		next: (message) => {
			const msg = message as Messages.Server.Response<R>
			if (msg.seq !== sequence) return
			if (msg.cmd === COMMAND.MESSAGE_CMD_REQUEST_ACK) {
				defer.resolve(msg.data!)
			}
			if (msg.cmd === COMMAND.MESSAGE_CMD_RESPONSE_ERROR) {
				defer.reject(msg.message)
			}
		}
	})
	subscription.add(requestSubscription)

	return defer.promise.finally(() => subscription.unsubscribe())
}