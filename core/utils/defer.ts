export interface Defer<T> {
    resolve(val: T): void
    reject(reason?: any): void
    promise: Promise<T>
}

export default function defer<T>(): Defer<T> {
	let resolve = Function.prototype
	let reject = Function.prototype

	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})

	return {
		resolve: resolve as (val: T) => void,
		reject: reject as (reason?: any) => void,
		promise: promise,
	}
}