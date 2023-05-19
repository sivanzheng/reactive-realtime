import defer from '../core/utils/defer'

describe('defer', () => {
	test('should resolve the promise with a value', async () => {
		const { promise, resolve } = defer<string>()
		const value = 'hello world'
		resolve(value)
		await expect(promise).resolves.toEqual(value)
	})

	test('should reject the promise with an error', async () => {
		const { promise, reject } = defer<number>()
		const error = new Error('test error')
		reject(error)
		await expect(promise).rejects.toEqual(error)
	})

	test('should wait for the promise to be resolved before printing', async () => {
		const { promise, resolve } = defer<string>()
		const value = 'hello world'
		setTimeout(() => {
			resolve(value)
		}, 1000)
		const result = await promise
		expect(result).toEqual(value)
	})
})
