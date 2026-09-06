import { ref } from 'vue'

export interface WSMessage {
  type: string
  room?: string
  data?: unknown
}

type MessageHandler = (msg: WSMessage) => void

const TOKEN_KEY = 'tandem_token'
const wsUrl = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws?token=${encodeURIComponent(token ?? '')}`
}

export class WSClient {
  private socket: WebSocket | null = null
  private reconnectAttempts = 0
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private readonly handlers = new Map<string, Set<MessageHandler>>()
  private readonly rooms = new Set<string>()

  readonly connected = ref(false)

  connect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return
    }
    const socket = new WebSocket(wsUrl())
    this.socket = socket

    socket.onopen = () => {
      this.reconnectAttempts = 0
      this.connected.value = true
      this.startHeartbeat()
      for (const room of this.rooms) {
        this.send({ type: 'join', room })
      }
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage
        this.dispatch(msg)
      } catch {}
    }

    socket.onclose = () => {
      this.connected.value = false
      this.stopHeartbeat()
      if (this.reconnectTimer !== null) {
        window.clearTimeout(this.reconnectTimer)
      }
      const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
      this.reconnectAttempts += 1
      this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
    }
  }

  disconnect(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.rooms.clear()
    this.stopHeartbeat()
    this.socket?.close()
    this.socket = null
    this.connected.value = false
  }

  join(room: string): void {
    this.rooms.add(room)
    this.send({ type: 'join', room })
  }

  leave(room: string): void {
    this.rooms.delete(room)
    this.send({ type: 'leave', room })
  }

  on(type: string, handler: MessageHandler): () => void {
    const set = this.handlers.get(type) ?? new Set<MessageHandler>()
    set.add(handler)
    this.handlers.set(type, set)
    return () => {
      set.delete(handler)
    }
  }

  private send(msg: WSMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg))
    }
  }

  private dispatch(msg: WSMessage): void {
    const set = this.handlers.get(msg.type)
    if (set) {
      for (const handler of set) {
        handler(msg)
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ type: 'ping' })
    }, 30000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

const ws = new WSClient()

export function useWS(): WSClient {
  return ws
}
