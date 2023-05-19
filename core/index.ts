import {
	timer,
	Subject,
	Observable,
	Subscription,
} from 'rxjs'

import {
	delay,
	filter,
	retryWhen,
	share,
	shareReplay,
	tap,
	take,
	takeUntil,
} from 'rxjs/operators'

import {
	webSocket,
	WebSocketSubject,
} from 'rxjs/webSocket'

import {
	Config,
	EventResponse,
	MessageType,
	RequestResponse,
	SendEventParams,
	SendRequestParams,
	SubscribeParams,
	Token,
} from './types'

import {
	BasicMessage,
	COMMAND,
	Messages,
} from './messages'

import generateSequence from './utils/generateSequence'
import defer from './utils/defer'


export default class Realtime {
	private webSocketSubject: WebSocketSubject<MessageType> | null = null
	private sharedWsSubject: Observable<MessageType> | null = null

	private openObserver = new Subject()
	private closeObserver = new Subject<CloseEvent>()

	private token: Token | null = null

	private connecting = defer<void>()
	private connected = false


	/**
     * Create a reactive dataflow client
     * @param config 
     */
	constructor(
        private readonly config: Config,
	) { }

	/**
     * Set token for authentication
     * @param token Authentication Token
     */
	setToken(token: Token) {
		this.token = token
	}

	private get sharedWs() {
		if (!this.sharedWsSubject) throw Error('Websocket is not connected yet')
		return this.sharedWsSubject!
	}

	private initWs() {
		const {
			url,
			protocol,
			retryTimes,
			retryInterval,
			onOpen,
			onClose,
		} = this.config

		this.webSocketSubject = webSocket<MessageType>({
			url,
			protocol,
			openObserver: this.openObserver,
			closeObserver: this.closeObserver,
		})

		this.sharedWsSubject = this.webSocketSubject.pipe(
			retryWhen(errors => errors.pipe(
				delay(retryInterval ?? 5000),
				take(retryTimes ?? 5),
				tap(() => console.log('Trying to reconnect to WebSocket...'))
			)),
			share(),
			shareReplay(1)
		)

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
	}

	/**
     * Connect to server
     */
	connect() {
		if (this.connected) return
		if (!this.token) throw Error('Authentication failed')
		this.initWs()

		this.sharedWs.subscribe({
			next: (value) => {
				const serverMsg = value as BasicMessage<unknown>
				if (serverMsg.cmd === COMMAND.MESSAGE_CMD_OPEN) {
					this.sendMessage<Token>({
						cmd: COMMAND.MESSAGE_CMD_CONNECT,
						data: this.token!,
					})
				}
				if (serverMsg.cmd === COMMAND.MESSAGE_CMD_CONNECTED) {
					this.connecting && this.connecting.resolve()
					this.connected = true
				}
				if (serverMsg.cmd === COMMAND.MESSAGE_CMD_PING) {
					this.sendMessage({
						cmd: COMMAND.MESSAGE_CMD_PONG
					})
				}
			},
			error: () => {
				this.connected = false
				this.connecting = defer<void>()
			},
			complete: () => {
				this.connected = false
				this.connecting = defer<void>()
				this.disconnect()
			}
		})
		this.connected = true
	}

	/**
     * Disconnect from server
     */
	disconnect() {
		if (!this.webSocketSubject) return
		this.webSocketSubject.complete()
		this.webSocketSubject = null
		this.sharedWsSubject = null
		this.connected = false
	}

	/**
     * Whether the server is connected
     */
	get isConnected() {
		return this.connected
	}

	private sendMessage<T = unknown>(message: MessageType<T>) {
		if (!this.webSocketSubject) {
			throw Error('Websocket is not connected yet')
		}
		this.webSocketSubject.next(message)
	}

	/**
     * Create a subscription
     * @param params Params for subscribe
     * @returns subject is used to subscribe, unsubscribe is used to cancel the subscription
     */
	createFeed<R>(params: SubscribeParams) {
		const { topic, namespace } = params
		const requestKey = namespace + topic

		const subject = new Subject<R>()
		const subscription = new Subscription()

		const subscribeMessage: Messages.Client.Subscribe = {
			topic,
			nsp: namespace,
			cmd: COMMAND.MESSAGE_CMD_SUBSCRIBE,
		}
		this.sendMessage<Messages.Client.Subscribe>(subscribeMessage)
		subscription.add(
			this.sharedWs.subscribe({
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
					subject.error(new Error(err.message || 'Subscription Error'))
				},
				complete: () => {
					subject.complete()
				}
			})
		)

		const { renewAfterSeconds } = this.config
		if (renewAfterSeconds) {
			subscription
				.add(
					timer(renewAfterSeconds * 1000, 1 * 1000)
						.pipe(takeUntil(this.closeObserver))
						.pipe(filter((_, index) => index % renewAfterSeconds === 0))
						.subscribe({
							next: () => {
								const subscribeData: Messages.Client.Subscribe = {
									topic,
									nsp: namespace,
									cmd: COMMAND.MESSAGE_CMD_SUBSCRIBE,
								}
								this.sendMessage(subscribeData)
							}
						})
				)
		}

		const unsubscribe = () => {
			const unSubScribeMessage: Messages.Client.UnSubscribe = {
				topic,
				nsp: namespace,
				cmd: COMMAND.MESSAGE_CMD_UNSUBSCRIBE,
			}
			this.sendMessage<Messages.Client.UnSubscribe>(unSubScribeMessage)
			subject.unsubscribe()
			subscription.unsubscribe()
		}
		return ({
			subject,
			unsubscribe,
		})
	}

	/**
     * Send a request synchronously
     * @param params Request params to be sent
     * @returns Response data
     */
	async requestSync<T, R>(params: SendRequestParams<T>) {
		await this.connecting.promise
		const {
			data,
			path,
			namespace,
			timeout,
		} = params
		const timeoutDefer = defer<R>()
		const sequence = generateSequence()
		const requestMessage: Messages.Client.Request<T> = {
			data,
			path,
			seq: sequence,
			nsp: namespace,
			cmd: COMMAND.MESSAGE_CMD_REQUEST,
		}
		this.sendMessage(requestMessage)

		const subscription = new Subscription()
		if (timeout) {
			subscription.add(
				timer(timeout)
					.subscribe({
						next: () => {
							timeoutDefer.reject('TIMEOUT')
						}
					})
			)
		}

		const requestSubscription = this.sharedWs.subscribe({
			next: (message) => {
				const msg = message as Messages.Server.Response<R>
				if (msg.seq !== sequence) return
				if (msg.cmd === COMMAND.MESSAGE_CMD_REQUEST_ACK) {
					timeoutDefer.resolve(msg.data!)
				}
				if (msg.cmd === COMMAND.MESSAGE_CMD_RESPONSE_ERROR) {
					timeoutDefer.reject(msg.message)
				}
			}
		})
		subscription.add(requestSubscription)

		return timeoutDefer.promise.finally(() => subscription.unsubscribe())
	}

	/**
     * Send a request asynchronously
     * @param params Request params to be sent
     * @param onResponse Response callback
     * @param onError Error callback
     */
	request<T, R>(
		params: SendRequestParams<T>,
		onResponse: (data: RequestResponse<R>) => void,
		onError?: (errMsg: Error) => void,
	) {
		const sequence = generateSequence()
		this.connecting.promise.then(() => {
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
			this.sendMessage(eventMessage)

			const subscription = new Subscription()

			if (timeout) {
				subscription
					.add(
						timer(timeout)
							.subscribe({
								next: () => {
									onResponse({ isTimeout: true })
									subscription.unsubscribe()
								}
							})
					)
			}


			const remoteSubscription = this.sharedWs.subscribe({
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
							onError(new Error(msg.message || 'Bad Request'))
						}
					}
					subscription.unsubscribe()
				},
				error: (err: Error) => {
					if (onError) {
						onError(new Error(err.message || 'Request Error'))
					}
				},
			})

			subscription.add(remoteSubscription)
		})
	}

	/**
     * Send a custom event, you can choose whether to wait for the response
     * @param params - Event params to be sent
     * @param respond - Optional, Whether to wait for a response
     * @returns If waiting for a response, returns a Promise
     */
	sendEvent<T, R = unknown>(params: SendEventParams<T>): void
	sendEvent<T, R = unknown>(params: SendEventParams<T>, respond: boolean): PromiseLike<EventResponse>
	sendEvent<T, R = unknown>(params: SendEventParams<T>, respond?: boolean): PromiseLike<EventResponse> | void {
		const { data, name, namespace } = params
		const seq = generateSequence()
		const eventMessage: Messages.Client.Event<T> = {
			seq,
			name,
			data,
			nsp: namespace,
			cmd: COMMAND.MESSAGE_CMD_EVENT,
		}
		this.sendMessage(eventMessage)
		if (respond) {
			const ackDefer = defer<EventResponse>()
			this.sharedWs.subscribe({
				next: (message) => {
					const msg = message as Messages.Server.Events<R>
					if (
						msg.name === name
                        && msg.nsp === namespace
                        && msg.seq === seq
					) {
						if (msg.cmd === COMMAND.MESSAGE_CMD_EVENT_ACK) {
							ackDefer.resolve({ ack: true })
						}
						if (msg.cmd === COMMAND.MESSAGE_CMD_EVENT_ERROR) {
							ackDefer.reject({
								ack: false,
								error: msg.message,
							})
						}
					}
				}
			})
			return ackDefer.promise
		}
	}

	/**
     * Listen for broadcast events
     * @param name Custom event name
     * @param nsp Service Namespace
     * @param respond Optional, whether to send ACK after received event
     * @returns subject is used to subscribe, unsubscribe is used to cancel the subscription
     */
	watchEvent<R>(name: string, nsp: string, respond = false) {
		const subject = new Subject<R>()
		const subscription = this.sharedWs
			.subscribe({
				next: (message) => {
					const msg = message as Messages.Server.Events<R>
					if (msg.name === name && msg.nsp === nsp) {
						switch (msg.cmd) {
						case COMMAND.MESSAGE_CMD_EVENT:
							if (respond) {
								const ackMessage: Messages.Client.EventACK = {
									name,
									nsp,
									seq: msg.seq,
									cmd: COMMAND.MESSAGE_CMD_EVENT_ACK
								}
								this.sendMessage<never>(ackMessage)
							}
							subject.next(message.data as R)
							break
						case COMMAND.MESSAGE_CMD_EVENT_ERROR:
							subject.error(new Error((message as Messages.Server.EventError).message ?? 'Watch Event Error'))
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
}
