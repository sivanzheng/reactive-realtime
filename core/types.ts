import { Subscription as RxjsSubscription } from 'rxjs'
import { Messages } from './messages'

export type MessageType<T = unknown> = Messages.Client.Subscribe
    | Messages.Client.Connect
    | Messages.Client.Pong
    | Messages.Client.UnSubscribe
    | Messages.Client.Request<T>
    | Messages.Server.Abort
    | Messages.Server.Connected
    | Messages.Server.Open
    | Messages.Server.Subscribed<T>
    | Messages.Server.Response<T>

export interface Config {
    url: string
    protocol?: string | Array<string>
    isRequiredAuth?: boolean
    messageQueueSize?: number
    retryTimes?: number
    retryInterval?: number
    renewAfterSeconds?: number
    onOpen?: (data: unknown) => void
    onClose?: (data: unknown) => void
}

export interface SendRequestParams<T> {
    data: T
    path: string,
    namespace: string
    timeout?: number
}

export interface SubscribeParams {
    topic: string
    namespace: string
}

export type Token = object

export interface SendEventParams<T> {
    data: T
    name: string
    namespace: string
}

export interface EventResponse {
    ack: boolean
    error?: string
}

export interface RequestResponse<T> {
    isTimeout?: boolean
    data?: T
}

export type Subscription = RxjsSubscription