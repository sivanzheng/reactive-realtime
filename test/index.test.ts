import Q from 'q'
import ws from 'ws'
import { JSDOM } from 'jsdom'
import { describe, expect } from '@jest/globals'

import Realtime from '../core/index'
import { COMMAND } from '../core/messages'

const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms) })

const dom = new JSDOM();
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).WebSocket = ws


describe('Realtime', () => {
	let realtime: Realtime
	let wss: ws.Server | null = null
	let isOpenHaveBeenCalled = false
	let isClientReceivedBroadcastMessage = false 
	let broadcastInterval: any
	let heartbeatInterval: any
	let broadcastCount = 0
	const broadcastDefer = Q.defer<boolean>()
	const broadcastErrorDefer = Q.defer<boolean>()


	beforeAll(async () => {
		await new Promise((resolve) => {
			wss = new ws.Server({ port: 9001 })
			wss.once('listening', () => {
				realtime = new Realtime(
					{
						url: 'ws://localhost:9001',
						renewAfterSeconds: 3,
						onOpen: () => {
							isOpenHaveBeenCalled = true
						}
					},
                    
				)
				resolve(undefined)
			})
			wss.on('connection', (client) => {
				client.send(JSON.stringify({ cmd: COMMAND.MESSAGE_CMD_OPEN }))
				client.on('message', (data: string) => {
					const message = JSON.parse(data)
					const cmd = message.cmd as COMMAND
					switch (cmd) {
					case COMMAND.MESSAGE_CMD_AUTH: {
						client.send(JSON.stringify({ cmd: COMMAND.MESSAGE_CMD_AUTH_ACK }))
						break
					}
					case COMMAND.MESSAGE_CMD_PING: {
						client.send(JSON.stringify({ cmd: COMMAND.MESSAGE_CMD_PONG }))
						break
					}
					case COMMAND.MESSAGE_CMD_SUBSCRIBE: {
						client.send(JSON.stringify({
							cmd: COMMAND.MESSAGE_CMD_PUBLISH,
							topic: message.topic,
							nsp: message.nsp,
							data: new Date().valueOf()
						}))
						client.send(JSON.stringify({
							cmd: COMMAND.MESSAGE_CMD_PUBLISH,
							topic: message.topic,
							nsp: message.nsp,
							data: new Date().valueOf()
						}))
						client.send(JSON.stringify({
							cmd: COMMAND.MESSAGE_CMD_PUBLISH,
							topic: message.topic,
							nsp: message.nsp,
							data: new Date().valueOf()
						}))
						break
					}
					case COMMAND.MESSAGE_CMD_REQUEST: {
						if (!message.data.timeout) {
							client.send(JSON.stringify({
								cmd: COMMAND.MESSAGE_CMD_REQUEST_ACK,
								seq: message.seq,
								data: new Date().valueOf()
							}))
						}
						break
					}
					case COMMAND.MESSAGE_CMD_EVENT: {
						client.send(JSON.stringify({
							...message,
							cmd: COMMAND.MESSAGE_CMD_EVENT_ACK,
						}))
						break
					}
					case COMMAND.MESSAGE_CMD_EVENT_ACK: {
						broadcastDefer.promise.then(() => {
							if (message.name === 'ack_event_name') {
								isClientReceivedBroadcastMessage = true
							}
						})
						break
					}
					}
				})
				heartbeatInterval = setInterval(
					() => {
						client.send(JSON.stringify({ cmd: COMMAND.MESSAGE_CMD_PING }))
					},
					1000
				)
				broadcastInterval = setInterval(
					() => {
						if (broadcastCount > 3) {
							client.send(JSON.stringify({
								cmd: COMMAND.MESSAGE_CMD_EVENT_ERROR,
								name: 'error_event_name',
								nsp: 'msg', 
								message: 'error message' 
							}))
							broadcastErrorDefer.resolve(true)
						} else {
							client.send(JSON.stringify({
								cmd: COMMAND.MESSAGE_CMD_EVENT,
								name: 'event_name',
								nsp: 'msg', 
								data: 'this is broadcast message'
							}))
							client.send(JSON.stringify({
								cmd: COMMAND.MESSAGE_CMD_EVENT,
								name: 'ack_event_name',
								nsp: 'msg', 
								data: 'this is broadcast message for ack'
							}))
							client.send(JSON.stringify({
								cmd: COMMAND.MESSAGE_CMD_EVENT_ERROR,
								name: 'event_name',
								nsp: 'msg', 
								data: 'this is broadcast message for error'
							}))
						}
						
						broadcastCount++
						broadcastDefer.resolve(true)
					},
					1000
				)
			})
		})
	})

	it('should create Realtime', () => {
		expect(realtime).toBeDefined()
	})

	it('should connect to server', async () => {
		await realtime.connect({ token: 'token'})
		expect(realtime.isConnected).toBeTruthy()
	})
	it('should call onOpen callback', async () => {
		expect(isOpenHaveBeenCalled).toBeTruthy()
	})

	it('should subscribe to topic', async () => {
		const messages: number[] = []
		const feed = realtime.createFeed<number>({ topic: '/test/topic', namespace: 'msg' })
		feed.subject.subscribe({
			next: (e) => {
				messages.push(e) 
			},
		})
		await sleep(2000)
		expect(messages.length).toBe(3)
		for (const message of messages) {
			expect(typeof message).toBe('number')
		}
		feed.unsubscribe()
	})

	it('should unsubscribe to topic', async () => {
		const messages: number[] = []
		const feed = realtime.createFeed<number>({ topic: '/test/topic', namespace: 'msg' })
		feed.subject.subscribe({
			next: (e) => {
				messages.push(e) 
			},
		})
		feed.unsubscribe()
		await sleep(2000)
		expect(messages.length).toBe(0)
	})

	it('should send request synchronously', async () => {
		const res = await realtime.requestSync({
			path: '/test/request/sync',
			namespace: 'msg',
			data: { timeout: false },
		})
		expect(typeof res).toBe('number')
	})

	it('should send request synchronously timeout', async () => {
		try{
			await realtime.requestSync({
				path: '/test/request/sync',
				namespace: 'msg',
				data: { timeout: true },
				timeout: 1000
			})
		} catch(e) {
			expect(e).toBe('TIMEOUT')
		}
	})

	it('should send request asynchronously', async () => {
		const res = await new Promise((resolve) => {
			realtime.request(
				{
					path: '/test/request/async',
					namespace: 'msg',
					data: { timeout: false },
				},
				(data) => {
					resolve(data)
				}
			)
		})
		expect(typeof res).toBe('object')
	})

	it('should send request asynchronously timeout', () => {
		realtime.request(
			{
				path: '/test/request/async',
				namespace: 'msg',
				data: { timeout: true },
				timeout: 1000
			},
			(err) => {
				expect(err.isTimeout).toBeTruthy()
			}
		)
	})

	it('should send event and wait for response', async () => {
		const res = await realtime.sendEvent(
			{
				namespace: 'msg',
				name: 'event_name',
				data: { hello: 'world' },
			},
			true
		)
		expect(typeof res).toBe('object')
	})

	it('should watch event', async () => {
		const watcher = realtime.watchEvent('event_name', 'msg')
		watcher.subject.subscribe({
			next: (message) => {
				expect(typeof message).toBe('string')
			},
		})
	})

	it('should unwatch event', async () => {
		let message = ''
		const watcher = realtime.watchEvent<string>('event_name', 'msg')
		watcher.subject.subscribe({
			next: (msg) => {
				message = msg
			},
		})
		watcher.unsubscribe()
		await sleep(2000)
		expect(message).toBe('')
	})

	it('should watch event and after 3 times received error', async () => {
		let error: Error
		const watcher = realtime.watchEvent('error_event_name', 'msg')
		watcher.subject.subscribe({
			next: (message) => {
				expect(typeof message).toBe('string')
			},
			error: (err) => {
				error = err
			},
		})
		broadcastErrorDefer.promise.then(() => {
			expect(broadcastCount).toBeGreaterThan(3)
			expect(error).toBeInstanceOf(Error)
			expect(error.message).toBe('error message')
		})
	})

	it('should watch event and send ack to server after received', async () => {
		const watcher = realtime.watchEvent('ack_event_name', 'msg', true)
		watcher.subject.subscribe()
		broadcastDefer.promise.then(() => {
			expect(isClientReceivedBroadcastMessage).toBeTruthy()
		})
	})

	

	it('should disconnect from server', async () => {
		realtime.disconnect()
		expect(realtime.isConnected).toBeFalsy()
	})

	afterAll(() => {
		wss!.close()
		wss = null
		clearInterval(broadcastInterval)
		clearInterval(heartbeatInterval)
	})
})
