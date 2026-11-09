export type SseMessage = { event: string; data: string }

/** Reads a server-sent event stream. Used for both Gemini's stream and our own, as EventSource can't POST. */
export async function* readSse(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SseMessage> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const parse = (block: string): SseMessage | null => {
    let event = "message"
    const data: string[] = []
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim()
      else if (line.startsWith("data:"))
        data.push(line.slice(5).replace(/^ /, ""))
    }
    return data.length ? { event, data: data.join("\n") } : null
  }
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(
        /\r\n/g,
        "\n"
      )
      let end: number
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const message = parse(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
        if (message) yield message
      }
    }
    const last = parse(buffer)
    if (last) yield last
  } finally {
    reader.releaseLock()
  }
}
