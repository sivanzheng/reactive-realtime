import {
	catchError,
	delayWhen,
	of,
	take,
	timer,
	takeWhile,
	Observer,
	Subject,
	Subscription,
} from 'rxjs'
import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket'
import { MessageType, Token } from '../types'

import AuthManager from './AuthManager'
import MessageManager from './MessageManager'
import SurviveManager from './SurviveManager'


export default class WebSocketAgent {
	private _isConnected = false
	private webSocketSubject: WebSocketSubject<MessageType> | undefined

	private authManager: AuthManager | undefined
	private messageManager: MessageManager | undefined
	private surviveManager: SurviveManager | undefined

	private reconnectChannel = new Subject()

	private reconnectStatusChannel = new Subject<boolean>()

	private messagesSubject: Subject<MessageType> = new Subject<MessageType>()
	private connectionStatusChannel: Subject<boolean> = new Subject<boolean>()

	private token: Token | undefined

	constructor(
        private config: WebSocketSubjectConfig<MessageType>,
        private isRequiredAuth: boolean = true,
		private messageQueueSize: number = 1000
	) {
		this.reconnectChannel
			.pipe(
				takeWhile((_, index) => index < 5),
				delayWhen((_, index) => timer(index < 4 ? (index + 1) * 5000 : 15000)),
			)
			.subscribe(() => {
				this.connect(this.token)
					.then((result) => {
						if (!result) return
						this.reconnectStatusChannel.next(true)
					})
			})

		this.messageManager = new MessageManager(this.connectionStatusChannel, this.messageQueueSize)
	}

	public get isConnected() {
		return this._isConnected
	}

	public get reconnectedStatus() {
		return this.reconnectStatusChannel.asObservable()
	} 

	public subscribe(observerOrNext?: Partial<Observer<MessageType>> | ((value: MessageType) => void)): Subscription {
		return this.messagesSubject.subscribe(observerOrNext)
	}

	public unsubscribe(): void {
		this.messagesSubject.complete()
	}

	public send(data: MessageType): void {
		this.messageManager?.sendMessage(data)
	}

	public async connect(token?: Token): Promise<boolean> {
		this.token = token
		const isConnected = await new Promise<boolean>((resolve) => {
			if (this.webSocketSubject && !this.webSocketSubject.closed) {
				console.warn('WebSocket connection is already established.')
				return resolve(true)
			}
			const changeConnectStatus = (status: boolean) => {
				this._isConnected = status
				resolve(true)
			}

			this.webSocketSubject = new WebSocketSubject<MessageType>(this.config)
			this.messageManager?.setWsSubject(this.webSocketSubject!)

			this.webSocketSubject.subscribe({
				next: (message) => {
					this.messagesSubject.next(message)
				},
				error: (error) => {
					console.error('WebSocket error:', error)
					changeConnectStatus(false)
					this.reconnect()
				},
				complete: () => {
					changeConnectStatus(false)
				}
			})

			this.webSocketSubject
				.pipe(
					take(1), // Take only the first value emitted by webSocketSubject
					catchError(() => of(null)) // Handle errors and emit null
				)
				.subscribe((value) => {
					if (value !== null) {
						changeConnectStatus(true)
					}
				})         
            
			this.surviveManager = new SurviveManager(this.webSocketSubject)
			this.surviveManager.stayALive()
		})
		if (!isConnected) {
			this.connectionStatusChannel.next(false)
			return false
		}

		if (!this.isRequiredAuth) {
			this.connectionStatusChannel.next(true)
			return true
		}

		if (this.isRequiredAuth && !token) {
			this.connectionStatusChannel.next(false)
			return false
		}

		this.authManager = new AuthManager(this.webSocketSubject!)
		const isAuthorized = await this.authManager.authorize(token!)
		this.connectionStatusChannel.next(isAuthorized)
		return isAuthorized
	}

	public async reauthorize(token: Token) {
		if (!this.authManager) return
		this.token = token

		this.connectionStatusChannel.next(false)
		const isAuthorized = await this.authManager?.reauthorize(token)
		this.connectionStatusChannel.next(isAuthorized)
	}

	public disconnect(): void {
		if (this.webSocketSubject && !this.webSocketSubject.closed) {
			this.webSocketSubject.complete()
			this.surviveManager?.destroy()
			this._isConnected = false
		}
	}

	public reconnect(): void {
		if (this.webSocketSubject && !this.webSocketSubject.closed) {
            this.webSocketSubject!.unsubscribe()
            this.surviveManager?.destroy()
		}
		this.reconnectChannel.next(true)
	}
}