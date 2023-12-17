import Q from 'q'
import { Subject, take } from 'rxjs'
import {
	Config,
	EventResponse,
	RequestResponse,
	SendEventParams,
	SendRequestParams,
	SubscribeParams,
	Token,
} from './types'

import { Messages } from './messages'
import Cache from './common/Cache'

import WebSocketAgent from './modules/WebsocketAgent'

import { sendEventMethod, createEventWatcher } from './methods/event'
import { createRequest, createSyncRequest } from './methods/request'
import { createSubscriptionFeed, resendSubMessage } from './methods/subscribe'


export default class Realtime {
	private wsAgent: WebSocketAgent | null = null

	private openObserver = new Subject()
	private closeObserver = new Subject<CloseEvent>()

	private initializedDefer = Q.defer<void>()

	private subParamsCache = new Cache<Messages.Client.Subscribe>()

	constructor(
        private config: Config
	) {
		this.initialClient()
	}

	private initialClient = async () => {
		const {
			url,
			protocol,
			isRequiredAuth,
			messageQueueSize,
			onOpen,
			onClose,
		} = this.config

		this.wsAgent = new WebSocketAgent(
			{
				url,
				protocol,
				openObserver: this.openObserver,
				closeObserver: this.closeObserver,
			},
			isRequiredAuth,
			messageQueueSize,
		)

		this.wsAgent
			.reconnectedStatus
			.subscribe(() => {
				resendSubMessage(this.wsAgent!, this.subParamsCache)
			})

		if (onOpen) {
			this.openObserver
				.pipe(take(1))
				.subscribe({
					next: (value) => {
						onOpen(value)
					},
				})
		}

		if (onClose) {
			this.closeObserver
				.pipe(take(1))
				.subscribe({
					next: (value) => {
						if (value && !value.wasClean) {
							onClose(value)
						}
					},
				})
		}

		this.initializedDefer.resolve()
	}

	connect(token?: Token) {
		if (!this.wsAgent) return Promise.resolve(false)
		return this.wsAgent.connect(token)
	}

	disconnect() {
		this.wsAgent?.disconnect()
	}

	get isConnected() {
		return this.wsAgent?.isConnected
	}

	reauthorize(token: Token) {
		this.wsAgent?.reauthorize(token)	
	}

	/**
	 * Send a custom event, you can choose whether to wait for the response
	 * @param params - Event params to be sent
	 * @param isWaitForRes - Optional, Whether to wait for a response
	 * @returns If waiting for a response, returns a Promise
	 */
	sendEvent<T>(params: SendEventParams<T>): void
	sendEvent<T>(params: SendEventParams<T>, isWaitForRes: boolean): PromiseLike<EventResponse>
	sendEvent<T>(params: SendEventParams<T>, isWaitForRes?: boolean): PromiseLike<EventResponse> | void {
		return sendEventMethod(
			this.wsAgent!,
			params,
			isWaitForRes || false,
		)
	}

	/**
	 * Listen for broadcast events
	 * @param name Custom event name
	 * @param nsp Service Namespace
	 * @param isWaitForRes Optional, whether to send ACK after received event
	 * @returns subject is used to subscribe, unsubscribe is used to cancel the subscription
	 */
	watchEvent<R>(name: string, nsp: string, isWaitForRes = false) {
		return createEventWatcher<R>(
			this.wsAgent!,
			name,
			nsp,
			isWaitForRes,
		)
	}

	/**
	 * Send a request asynchronously
	 * @param params Request params to be sent
	 * @param onResponse Response callback
	 * @param onError Error callback
	 */
	request<T, R = unknown>(
		params: SendRequestParams<T>,
		onResponse: (data: RequestResponse<R>) => void,
		onError?: (errMsg: Error) => void,
	) {
		return createRequest<T, R>(
			this.wsAgent!,
			params,
			onResponse,
			onError
		)
	}

	/**
	 * Send a request synchronously
	 * @param params Request params to be sent
	 * @returns Response data
	 */
	async requestSync<T, R>(
		params: SendRequestParams<T>
	) {
		return createSyncRequest<T, R>(
			this.wsAgent!,
			params,	
		)
	}

	/**
	 * Create a subscription
	 * @param params Params for subscribe
	 * @returns subject is used to subscribe, unsubscribe is used to cancel the subscription
	 */
	createFeed<R>(params: SubscribeParams) {
		return createSubscriptionFeed<R>(
			this.wsAgent!,
			this.subParamsCache,
			params,
			this.config.renewAfterSeconds
		)
	}
}