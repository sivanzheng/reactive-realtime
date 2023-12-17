import { WebSocketSubject } from 'rxjs/webSocket'
import { MessageType, Token } from '../types'
import { BasicMessage, COMMAND } from '../messages'

export default class AuthManager{
	private _isAuthorized = false

	constructor(
		private webSocketSubject:  WebSocketSubject<MessageType>,
	) { }

	get isAuthorized() {
		return this._isAuthorized
	}

	reauthorize(token: Token) {
		return this.authorize(token)
	}
 
	authorize(token: Token) {
		return new Promise<boolean>((resolve) => {
			const setAuthorized = (authorized: boolean) => {
				this._isAuthorized = authorized
				resolve(authorized)
			}

			if (!token) {
				setAuthorized(false)
				return
			}
			if (this.webSocketSubject.closed) {
				setAuthorized(false)
				return
			}
			this.webSocketSubject.subscribe({
				next: (value) => {
					const serverMsg = value as BasicMessage<unknown>
					if (serverMsg.cmd === COMMAND.MESSAGE_CMD_AUTH_ACK) {
						setAuthorized(true)
					}
					if (serverMsg.cmd === COMMAND.MESSAGE_CMD_AUTH_ERROR) {
						setAuthorized(false)
					}
				},
			})
			this.webSocketSubject.next(
				{
					cmd: COMMAND.MESSAGE_CMD_AUTH,
					data: token,
				}, 
			)
		})
	}
}