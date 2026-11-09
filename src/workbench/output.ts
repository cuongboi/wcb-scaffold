import { create } from "zustand"

const MAX_LINES = 1000

type OutputState = {
  channels: Record<string, string[]>
  active?: string
}

export const useOutput = create<OutputState>(() => ({ channels: {} }))

const time = () => new Date().toLocaleTimeString([], { hour12: false })

export function appendOutput(channel: string, message: string) {
  const lines = message.split("\n").map((line) => `[${time()}] ${line}`)
  useOutput.setState((state) => {
    const next = [...(state.channels[channel] ?? []), ...lines]
    return {
      channels: { ...state.channels, [channel]: next.slice(-MAX_LINES) },
      active: state.active ?? channel,
    }
  })
}

export function clearOutput(channel: string) {
  useOutput.setState((state) => ({
    channels: { ...state.channels, [channel]: [] },
  }))
}

export const setActiveOutput = (channel: string) =>
  useOutput.setState({ active: channel })
