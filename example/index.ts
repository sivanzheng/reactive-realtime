import Realtime from '../core'

// Create a client
const client = new Realtime({
	url: 'ws://localhost:9000',
	renewAfterSeconds: 3,
	onClose: () => {
		alert('ready to reconnect')
		console.log('disconnect')
	}
})
// Connect to server
client.connect({ token: 'token' })


/**
 * Watch Mode
 */
const watcher = client.watchEvent('name', 'nsp', true)
watcher.subject.subscribe({
	next: (value) => {
		console.log('watch mode message: ', value)
	},
	error: (err) => {
		console.error('watch mode error: ', err)
	}
})
setTimeout(() => { watcher.unsubscribe() }, 10 * 1000)

const watchError = client.watchEvent('watch_error', 'msg', true)
watchError.subject.subscribe({
	next: (value) => {
		console.log('watch error message: ', value)
	},
	error: (err) => {
		console.error('watch error error: ', err)
	},	
})

const watchWithAck = client.watchEvent('ack_event_name', 'msg', true)
watchWithAck.subject.subscribe({
	next: (value) => {
		console.log('watch ack message: ', value)
	},
	error: (err) => {
		console.error('watch ack error: ', err)
	},	
})
/**
 * Watch Mode End
 */


/**
 * Subscription Mode
 */
const sub1 = client.createFeed({ topic: '/test/topic1', namespace: 'msg' })

sub1.subject.subscribe({
	next: (e) => console.log('sub mode message 1: ', e),
	error: (err) => console.log('err: ', err)
})

setTimeout(
	() => {
		console.log('unsubscribed 1 after 15s')
		sub1.unsubscribe()
	}, 
	15 * 1000
)

const sub2 = client.createFeed({ topic: '/test/topic2', namespace: 'msg' })

sub2.subject.subscribe({ next: (e) => console.log('sub mode message 2: ', e)})

setTimeout(
	() => {
		console.log('unsubscribed 2 after 25s')
		sub2.unsubscribe()
	}, 
	25 * 1000
)
/**
 * Subscription Mode End
 */



/**
 * Request Mode
 */
client
	.requestSync({
		path: '',
		namespace: 'msg',
		data: 'request',
		timeout: 2000
	})
	.then(c => console.log('synchronous request mode message:', c))
	.catch(err => console.error('synchronous request mode error: ', err))

client.request(
	{
		path: '/test/request/async',
		namespace: 'msg',
		data: { timeout: false },
	},
	(value) => {
		console.log('asynchronous request mode message:', value)
	},
	(err) => {
		console.log('asynchronous request mode error:', err)
	}
)
/**
 * Request Mode End
 */


/**
 * Send Event
 */
client.sendEvent(
	{
		namespace: 'msg',
		name: 'event_name',
		data: { hello: 'world' },
	},
	true
)
	.then(res => console.log('send event response: ', res))

/**
 * Send Event End
 */