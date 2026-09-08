import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWS } from './ws'

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3

  static instances: FakeWebSocket[] = []

  readonly url: string
  readonly protocols?: string[]
  readyState = FakeWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []

  constructor(url: string = '', protocols?: string[]) {
    this.url = url
    this.protocols = protocols
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  message(data: string): void {
    this.onmessage?.({ data })
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

const TOKEN_KEY = 'tandem_token'

function lastSocket(): FakeWebSocket {
  const instances = FakeWebSocket.instances
  return instances[instances.length - 1]
}

beforeEach(() => {
  FakeWebSocket.instances = []
  localStorage.clear()
  vi.stubGlobal('WebSocket', FakeWebSocket)
  const ws = useWS()
  ws.disconnect()
  vi.clearAllTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('WSClient connect', () => {
  it('does not open a socket without a token', () => {
    useWS().connect()
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('opens a socket with subprotocols when a token exists', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    useWS().connect()
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(lastSocket().protocols).toEqual(['tandem', 'jwt-token'])
  })

  it('marks connected on open and rejoins rooms', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    const ws = useWS()
    ws.join('workspace:w1')
    ws.connect()
    lastSocket().open()
    expect(ws.connected.value).toBe(true)
    expect(lastSocket().sent).toContain(JSON.stringify({ type: 'join', room: 'workspace:w1' }))
  })

  it('does not reopen while connected', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    const ws = useWS()
    ws.connect()
    lastSocket().open()
    ws.connect()
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})

describe('WSClient messages', () => {
  it('dispatches typed messages to registered handlers', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    const ws = useWS()
    const handler = vi.fn()
    ws.on('task.updated', handler)
    ws.connect()
    lastSocket().open()
    lastSocket().message(JSON.stringify({ type: 'task.updated', data: { id: 't1' } }))
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0]).toEqual({ type: 'task.updated', data: { id: 't1' } })
  })

  it('ignores malformed messages', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    const ws = useWS()
    const handler = vi.fn()
    ws.on('task.updated', handler)
    ws.connect()
    lastSocket().open()
    lastSocket().message('{not-json')
    expect(handler).not.toHaveBeenCalled()
  })

  it('unsubscribes a handler', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    const ws = useWS()
    const handler = vi.fn()
    const unsubscribe = ws.on('presence', handler)
    ws.connect()
    lastSocket().open()
    unsubscribe()
    lastSocket().message(JSON.stringify({ type: 'presence', data: { members: ['u1'] } }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards join and leave commands to the socket', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    const ws = useWS()
    ws.connect()
    lastSocket().open()
    ws.join('room:r1')
    ws.join('room:r1')
    ws.leave('room:r1')
    expect(lastSocket().sent).toContain(JSON.stringify({ type: 'join', room: 'room:r1' }))
    expect(lastSocket().sent).toContain(JSON.stringify({ type: 'leave', room: 'room:r1' }))
  })
})

describe('WSClient heartbeat and reconnect', () => {
  it('sends a ping heartbeat every 30 seconds', () => {
    vi.useFakeTimers()
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    useWS().connect()
    lastSocket().open()
    lastSocket().sent.splice(0)
    vi.advanceTimersByTime(30_000)
    expect(lastSocket().sent).toContain(JSON.stringify({ type: 'ping' }))
  })

  it('reconnects with backoff on close', () => {
    vi.useFakeTimers()
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    const ws = useWS()
    ws.connect()
    lastSocket().open()
    lastSocket().close()
    expect(ws.connected.value).toBe(false)
    expect(FakeWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('stops reconnecting after the maximum number of attempts', () => {
    vi.useFakeTimers()
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    useWS().connect()
    for (let i = 0; i < 6; i++) {
      lastSocket().close()
      vi.advanceTimersByTime(32_000)
    }
    expect(FakeWebSocket.instances).toHaveLength(6)
    lastSocket().close()
    vi.advanceTimersByTime(32_000)
    expect(FakeWebSocket.instances).toHaveLength(6)
  })

  it('does not reconnect when the token is removed', () => {
    vi.useFakeTimers()
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    useWS().connect()
    lastSocket().open()
    localStorage.removeItem(TOKEN_KEY)
    lastSocket().close()
    vi.advanceTimersByTime(32_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('disconnect closes the socket and clears rooms', () => {
    vi.useFakeTimers()
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    const ws = useWS()
    ws.join('workspace:w1')
    ws.connect()
    lastSocket().open()
    const socket = lastSocket()
    ws.disconnect()
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED)
    expect(ws.connected.value).toBe(false)
    ws.connect()
    lastSocket().open()
    expect(lastSocket().sent).toEqual([])
  })

  it('disconnect stops scheduled reconnects', () => {
    vi.useFakeTimers()
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    const ws = useWS()
    ws.connect()
    lastSocket().open()
    lastSocket().close()
    ws.disconnect()
    vi.advanceTimersByTime(32_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
