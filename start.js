import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INTERNAL_PORT = process.env.PORT || 3001
const EXTERNAL_PORT = process.env.EXTERNAL_PORT || 3000
const CADDY_BIN = process.env.CADDY || path.join(__dirname, 'bin', 'caddy')

// charge .env (clés Porkbun) dans process.env
const envFile = path.join(__dirname, '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2]
  }
}

if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_API_SECRET) {
  console.error('❌ Clés Porkbun manquantes. Renseigne PORKBUN_API_KEY et PORKBUN_API_SECRET dans le fichier .env')
  process.exit(1)
}

const node = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: 'inherit',
})

const caddy = spawn(CADDY_BIN, ['run', '--config', path.join(__dirname, 'Caddyfile')], {
  stdio: 'inherit',
})
caddy.on('error', (err) => {
  console.error(`\n⚠️  Caddy n'a pas pu démarrer (${err.code || err.message}). Vérifie ./bin/caddy.`)
})
caddy.on('exit', (code) => {
  if (code !== 0 && code !== null) console.error(`\n⚠️  Caddy s'est arrêté (code ${code}).`)
})

console.log(`\n🎮 HTTPS : https://home.aubetoile.dev:${EXTERNAL_PORT}  (redirige vers Node :${INTERNAL_PORT})\n`)

node.on('exit', () => {
  caddy.kill('SIGTERM')
  process.exit(0)
})

const shutdown = () => {
  node.kill('SIGTERM')
  caddy.kill('SIGTERM')
  setTimeout(() => process.exit(0), 200)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)