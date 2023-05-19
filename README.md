# reactive-realtime
An ReactiveX WebSocket Client SDK

## Usage
1. Create instance
> ```ts
> import Realtime from 'reactive-realtime'
> 
> const client = new Realtime(<CONFIG>)
> ```

2. Set Token
> ```ts
> client.setToken(<TOKEN>)
> ```

3. Connect Server
> ```ts
> client.connect()
> ```

4. Disconnect From Server
> ```ts
> client.disconnect()
> ```

### Config

```   
url: string                             // Server URL
protocol?: string | Array<string>       // The protocol to use to connect
renewAfterSeconds?: number              // Renew subscribe interval, default 60s
retryTimes?: number                     // Retry times, default 5
retryInterval?: number                  // Retry interval, default 5s
onOpen?: (data: unknown) => void        // Connection open callback
onClose?: (data: unknown) => void       // Connection close callback
```

## Subscription
> When you want to continuously subscribe to a stream
```ts
const feed = client.createFeed<SubscribedData>({
    <PARAMS>,
    <TOPIC>,
    <NAMESPACE>,
})
```

### Subscribe
```ts
feed.subject.subscribe({ next: (data) => { } })
```

### UnSubscribe
```ts
feed.unsubscribe()
```

## Event

### Watch
> Listen for broadcast events
```ts
const watcher = client.watchEvent<ResponseDataType>(NAME, NAMESPACE, RESPOND)

watcher.subject.subscribe({ next: (data) => { }})

watcher.unsubscribe()
```
### Send
> Send a custom event, you can choose whether to wait for the response

```ts
// If waiting for a response
const response = await client.sendEvent<DataType, ResponseDataType>(<PARAMS>, true)

const { ack, error } = response

// If not

client.sendEvent<DataType>(<PARAMS>)

```


## Request
> When you need to send an request

### Synchronous
```ts
const res = await client.requestSync<DataType, ResponseDataType>({
    <DATA>,
    <NAME>,
    <NAMESPACE>,
    <TIMEOUT>
})
```

### Asynchronous
```ts
client.request<DataType, ResponseDataType>(
    <PARAMS>,
    <ON_RESPONSE>,
    <ON_ERROR>?,
)
```