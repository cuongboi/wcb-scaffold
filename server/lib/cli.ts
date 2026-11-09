import { networkInterfaces } from "node:os"

import { ArgumentParser } from "argparse"
import { localHttps } from "elysia-local-https"

const parser = new ArgumentParser({ description: "fullstack-elysia server" })
parser.add_argument("-p", "--port", {
  help: "Port to listen on",
  type: "int",
  default: Number(process.env.PORT ?? 3000),
})
// All interfaces by default: a container's port mapping can't reach a loopback-only server.
parser.add_argument("-H", "--host", {
  help: "Host to listen on",
  default: process.env.HOST ?? "0.0.0.0",
})
parser.add_argument("-s", "--ssl", {
  help: "Serve HTTPS with a local mkcert certificate",
  action: "store_true",
})
parser.add_argument("--cert", {
  help: "With --ssl: certificate path",
  default: "certs/local/localhost.pem",
})
parser.add_argument("--key", {
  help: "With --ssl: private key path",
  default: "certs/local/localhost-key.pem",
})
parser.add_argument("--domain", {
  help: "With --ssl: comma-separated certificate domains",
  default: "localhost,127.0.0.1,::1",
})
parser.add_argument("--db-push", {
  help: "Push the ZenStack schema to the database, then exit",
  action: "store_true",
})
parser.add_argument("--accept-data-loss", {
  help: "With --db-push: allow destructive schema changes",
  action: "store_true",
})
// Off by default: a shell runs commands as the server's own OS user.
parser.add_argument("--terminal", {
  help: "Let users listed in TERMINAL_USERS open a shell on this server",
  action: "store_true",
})

const args = parser.parse_args()

export const dbPushRequested = args.db_push as boolean
export const acceptDataLoss = args.accept_data_loss as boolean
export const terminalEnabled = args.terminal as boolean

/** The address options for `Bun.serve`, with TLS when `--ssl` is set. */
export function listenOptions() {
  const listen = { port: args.port as number, hostname: args.host as string }
  if (!args.ssl) return listen
  return localHttps(listen, {
    enabled: true,
    certPath: args.cert,
    keyPath: args.key,
    domains: String(args.domain)
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean),
  })
}

/** Where to reach the server. A wildcard bind isn't a usable address, so it becomes localhost and the LAN IP. */
export function serverUrls(url: URL) {
  if (url.hostname !== "0.0.0.0") return [url.origin]
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((address) => address?.family === "IPv4" && !address.internal)?.address
  return ["localhost", lan]
    .filter(Boolean)
    .map((host) => `${url.protocol}//${host}:${url.port}`)
}
