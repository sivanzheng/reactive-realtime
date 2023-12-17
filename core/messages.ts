import { Token } from './types'

export enum COMMAND {
    MESSAGE_ERROR = 0,                                      // 服务端内部错误
    MESSAGE_CMD_OPEN = 1,                                   // 连接建立后，服务端推送心跳间隔时间等消息
    MESSAGE_CMD_AUTH = 2,                                   // 客户端发送连接（认证）消息
    MESSAGE_CMD_AUTH_ACK = 3,                               // 服务端响应成功连接消息
    MESSAGE_CMD_AUTH_ERROR = 4,                             // 服务端响应拒绝连接消息（如认证错误，被其他设备踢出等，客户端不应该重连）
    MESSAGE_CMD_DISCONNECT = 5,                             // 服务端/客户端断开连接消息（如服务端发布时断开，原则上客户端可以重连）

    MESSAGE_CMD_PING = 6,                                   // 服务端/客户端 PING
    MESSAGE_CMD_PONG = 7,                                   // 服务端/客户端 PONG
    MESSAGE_CMD_ABORT = 8,                                  // 服务端响应拒绝连接消息（如被其他设备踢出等，客户端不应该重连）

    MESSAGE_CMD_REQUEST = 20,                               // 客户端一次性请求
    MESSAGE_CMD_REQUEST_ACK = 21,                           // 服务端一次性请求响应
    MESSAGE_CMD_RESPONSE_ERROR = 22,                        // 服务端一次性响应错误

    MESSAGE_CMD_EVENT = 23,                                 // 服务端/客户端事件消息
    MESSAGE_CMD_EVENT_ACK = 24,                             // 服务端/客户端事件消息 ACK
    MESSAGE_CMD_EVENT_ERROR = 25,                           // 服务端/客户端事件消息 ERROR

    MESSAGE_CMD_GROUP_EVENT = 26,                           // 服务端/客户端群组事件消息
    MESSAGE_CMD_GROUP_EVENT_ACK = 27,                       // 服务端/客户端群组事件消息 ACK
    MESSAGE_CMD_GROUP_EVENT_ERROR = 28,                     // 服务端/客户端群组事件消息 ERROR

    MESSAGE_CMD_SUBSCRIBE = 30,                             // 客户端发送订阅消息
    MESSAGE_CMD_SUBSCRIBE_ACK = 31,                         // 服务端响应订阅消息 ACK
    MESSAGE_CMD_SUBSCRIBE_ERROR = 32,                       // 服务端响应订阅消息 ERROR

    MESSAGE_CMD_UNSUBSCRIBE = 33,                           // 客户端发送取消订阅消息
    MESSAGE_CMD_UNSUBSCRIBE_ACK = 34,                       // 服务端响应取消订阅消息 ACK
    MESSAGE_CMD_UNSUBSCRIBE_ERROR = 35,                     // 服务端响应取消订阅消息确认 ERROR

    MESSAGE_CMD_PUBLISH = 36,                               // 服务端发布订阅消息
}

export enum CONNECTION_STATUS {
    CONNECTION_CLOSED = 0,                                  // 正常关闭连接，如服务端因发布推送 DISCONNECT 信息后关闭
    CONNECTION_LOST = 1,                                    // 异常关闭连接，如服务端宕机
    CONNECTION_RETRIES_EXCEEDED = 2,                        // 重试超过次数限制
    CONNECTION_UNREACHABLE = 3,                             // 目标地址不可达
    CONNECTION_UNSUPPORTED = 4,                             // 浏览器不支持 WebSocket 等情况
    CONNECTION_UNREACHABLE_SCHEDULED_RECONNECT = 5,         // 定时重连中
    CONNECTION_LOST_SCHEDULED_RECONNECT = 6,                // 已终止重连
    CONNECTION_ABORTED = 7,                                 // 服务端终止连接，如用户登出，此后 WebSocket 不应该进行重连
}

export interface BasicMessage<T> {
    cmd: COMMAND
    data?: T
}

export namespace Messages {
    export namespace Server {

        export interface OpenData {
            pingInterval: number
            pingTimeout: number
            extra: string
        }

        export interface Open extends BasicMessage<OpenData> {
            cmd: COMMAND.MESSAGE_CMD_OPEN
        }

        export interface ConnectedData {
            principalId: string
            sessionId: string
            description: string
        }

        export interface Connected extends BasicMessage<ConnectedData> {
            cmd: COMMAND.MESSAGE_CMD_AUTH_ACK
        }

        export interface AbortData {
            description: string
        }

        export interface Abort extends BasicMessage<AbortData> {
            cmd: COMMAND.MESSAGE_CMD_AUTH_ERROR
        }

        export interface Response<T> extends BasicMessage<T> {
            seq: number
            nsp?: string
            message?: string
        }

        export interface Subscribed<T> extends BasicMessage<T> {
            cmd: COMMAND.MESSAGE_CMD_PUBLISH
            | COMMAND.MESSAGE_CMD_SUBSCRIBE_ACK
            | COMMAND.MESSAGE_CMD_SUBSCRIBE_ERROR
            nsp: string
            topic: string
            data: T
            message?: string
        }

        export interface Event<T> extends BasicMessage<T> {
            cmd: COMMAND.MESSAGE_CMD_EVENT
            seq: number,
            nsp: string
            name: string
            data: T
        }

        export interface EventACK extends BasicMessage<never> {
            cmd: COMMAND.MESSAGE_CMD_EVENT_ACK
            seq: number
            nsp: string
            name: string
        }

        export interface EventError extends BasicMessage<never> {
            cmd: COMMAND.MESSAGE_CMD_EVENT_ERROR
            seq: number
            nsp: string
            name: string
            message?: string
        }

        export type Events<T> = Event<T> | EventACK | EventError
    }

    export namespace Client {

        export interface Pong extends BasicMessage<never> {
            cmd: COMMAND.MESSAGE_CMD_PONG
        }

        export interface Connect extends BasicMessage<Token> {
            cmd: COMMAND.MESSAGE_CMD_AUTH
            data: Token
        }

        export interface Subscribe extends BasicMessage<never> {
            cmd: COMMAND.MESSAGE_CMD_SUBSCRIBE,
            topic: string
            nsp: string
        }

        export interface UnSubscribe extends BasicMessage<never> {
            cmd: COMMAND.MESSAGE_CMD_UNSUBSCRIBE,
            topic: string
            nsp: string
        }

        export interface Request<T> extends BasicMessage<T> {
            cmd: COMMAND.MESSAGE_CMD_REQUEST,
            seq: number
            nsp: string
            path: string
            data: T
        }

        export interface Event<T> extends BasicMessage<T> {
            cmd: COMMAND.MESSAGE_CMD_EVENT
            seq: number,
            nsp: string
            name: string
            data: T
        }

        export interface EventACK extends BasicMessage<never> {
            cmd: COMMAND.MESSAGE_CMD_EVENT_ACK
            seq: number
            nsp: string
            name: string
        }

        export interface EventError extends BasicMessage<never> {
            cmd: COMMAND.MESSAGE_CMD_EVENT_ERROR
            seq: number
            nsp: string
            name: string
            message?: string
        }

        export type Events<T> = Event<T> | EventACK | EventError
    }
}