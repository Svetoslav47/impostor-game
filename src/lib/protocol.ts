// Types for shared/PROTOCOL.md.

export interface RoomSettings {
  impostorCount: 1 | 2
  categoryIds: string[]
}

export interface RoomPlayer {
  id: string
  name: string
  connected: boolean
}

export type Phase = 'lobby' | 'countdown' | 'playing'

export interface Room {
  code: string
  hostId: string
  players: RoomPlayer[]
  settings: RoomSettings
  phase: Phase
  countdownMs?: number
  round: number
  starterId?: string | null
  starterName?: string | null
  revealed: null | {
    word: string
    category: string | { id: string; name: string }
    impostorIds: string[]
    impostorNames?: string[]
  }
}

export type Card = { role: 'crew'; word: string } | { role: 'impostor'; hint: string }

export type ClientMessage =
  | { type: 'create'; name: string; settings: RoomSettings }
  | { type: 'join'; code: string; name: string }
  | { type: 'resume'; code: string; playerId: string }
  | { type: 'settings'; settings: RoomSettings }
  | { type: 'start' }
  | { type: 'reveal' }
  | { type: 'lobby' }
  | { type: 'ping' }
  | { type: 'leave' }

export type ServerMessage =
  | { type: 'joined'; code: string; playerId: string }
  | { type: 'room'; room: Room }
  | { type: 'card'; round: number; card: Card }
  | { type: 'error'; message: string }
  | { type: 'left' }
  | { type: 'pong' }
