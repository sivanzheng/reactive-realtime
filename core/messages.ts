import { Token } from './types'

export enum COMMAND {
    MESSAGE_ERROR = 0,                                      // Internal server error
    MESSAGE_CMD_OPEN = 1,                                   // After connection establishment, the server pushes messages such as the heartbeat interval
    MESSAGE_CMD_CONNECT = 2,                                // Client sends connect (authentication) message
    MESSAGE_CMD_CONNECTED = 3,                              // Server responds to successful connection message
    MESSAGE_CMD_ABORT = 4,                                  // Server responds to refused connection message (such as authentication error, being kicked out by other devices, etc., the client should not reconnect)
    MESSAGE_CMD_DISCONNECT = 5,                             // Server/client disconnection message (such as disconnection during server publishing, in principle, the client can reconnect)

    MESSAGE_CMD_PING = 6,                                   // Server/client PING
    MESSAGE_CMD_PONG = 7,                                   // Server/client PONG

    MESSAGE_CMD_REQUEST = 20,                               // Client one-time request
    MESSAGE_CMD_REQUEST_ACK = 21,                           // Server one-time request response
    MESSAGE_CMD_RESPONSE_ERROR = 22,                        // Server one-time response error

    MESSAGE_CMD_EVENT = 23,                                 // Server/client event message
    MESSAGE_CMD_EVENT_ACK = 24,                             // Server/client event message ACK
    MESSAGE_CMD_EVENT_ERROR = 25,                           // Server/client event message ERROR

    MESSAGE_CMD_SUBSCRIBE = 30,                             // Client sends subscription message
    MESSAGE_CMD_SUBSCRIBE_ACK = 31,                         // Server responds to subscription message ACK
    MESSAGE_CMD_SUBSCRIBE_ERROR = 32,                       // Server responds to subscription message ERROR

    MESSAGE_CMD_UNSUBSCRIBE = 33,                           // Client sends unsubscribe message
    MESSAGE_CMD_UNSUBSCRIBE_ACK = 34,                       // Server responds to unsubscribe message ACK
    MESSAGE_CMD_UNSUBSCRIBE_ERROR = 35,                     // Server responds to unsubscribe message confirmation ERROR

    MESSAGE_CMD_PUBLISH = 36,                               // Server publishes subscription message
    MESSAGE_CMD_PUBLISH_ACK = 37,                           // Server publishes subscription message ACK
    MESSAGE_CMD_PUBLISH_ERROR = 38,                         // Server publishes subscription message ERROR
}

export enum CONNECTION_STATUS {
    CONNECTION_CLOSED = 0,                                  // Connection closed normally, such as server closing due to publishing and pushing DISCONNECT information
    CONNECTION_LOST = 1,                                    // Connection lost abnormally, such as server crash
    CONNECTION_RETRIES_EXCEEDED = 2,                        // Retry limit exceeded
    CONNECTION_UNREACHABLE = 3,                             // Target address unreachable
    CONNECTION_UNSUPPORTED = 4,                             // Browser does not support WebSocket, etc.
    CONNECTION_UNREACHABLE_SCHEDULED_RECONNECT = 5,         // Scheduled reconnection
    CONNECTION_LOST_SCHEDULED_RECONNECT = 6,                // Reconnection terminated
    CONNECTION_ABORTED = 7,                                 // Server terminates the connection, such as user log out, after which WebSocket should not reconnect
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
            cmd: COMMAND.MESSAGE_CMD_CONNECTED
        }

        export interface AbortData {
            description: string
        }

        export interface Abort extends BasicMessage<AbortData> {
            cmd: COMMAND.MESSAGE_CMD_ABORT
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
            cmd: COMMAND.MESSAGE_CMD_CONNECT
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
