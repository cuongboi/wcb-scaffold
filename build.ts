// Compiles the server into one executable. The client comes along through its HTML import in server/index.ts.
import tailwind from "bun-plugin-tailwind"

const result = await Bun.build({
  entrypoints: ["server/index.ts"],
  compile: { outfile: "run-server" },
  target: "bun",
  minify: true,
  sourcemap: "none",
  // Dynamic imports become their own chunks, so xterm (the terminal) and Sentry stay out of the main one.
  splitting: true,
  // Without this define, --compile inlines NODE_ENV as "development".
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [tailwind],
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
console.log("Built ./run-server")
