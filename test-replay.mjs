import { io } from 'socket.io-client'

const URL = process.env.TEST_URL || 'http://localhost:3000'
let passed = 0, failed = 0
const check = (name, cond) => { if (cond) { passed++; console.log('PASS', name) } else { failed++; console.log('FAIL', name) } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (fn, timeout = 4000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (fn()) return true
    await wait(20)
  }
  return false
}
function mkClient() {
  const s = io(URL, { transports: ['websocket'] })
  s.latest = null
  s.on('state', (st) => { s.latest = st })
  return s
}

async function setupRoom(n, settings) {
  const clients = []
  const host = mkClient()
  clients.push(host)
  await until(() => host.id)
  const createRes = await new Promise((r) => host.emit('createRoom', { name: 'H', settings }, r))
  const code = createRes.code
  for (let i = 0; i < n - 1; i++) {
    const c = mkClient()
    clients.push(c)
    await until(() => c.id)
    await new Promise((r) => c.emit('joinRoom', { code, name: 'J' + i }, r))
  }
  await until(() => host.latest && host.latest.players.length === n)
  return { host, clients, code }
}

async function playHints(clients, host) {
  let guard = 0
  while (guard++ < 100) {
    const h = host.latest
    if (!h || h.phase !== 'playing') break
    const me = clients.find((c) => c.id === h.turnPlayerId)
    if (!me) { console.log('  no me', h.turnPlayerId); break }
    const before = h.turnIndex
    await new Promise((r) => me.emit('hint', 'i', (res) => r(res)))
    await until(() => host.latest.phase === 'voting' || host.latest.turnIndex !== before || host.latest.round !== h.round)
  }
}

async function main() {
  // ===== Test 1 : nombre de tours personnalisé =====
  {
    console.log('== Test: rounds custom ==')
    const { host, clients } = await setupRoom(3, { rounds: 2, sameAnime: true, imposteurs: 0 })
    check('rounds = 2 dans les réglages', host.latest.settings.rounds === 2)
    const startRes = await new Promise((r) => host.emit('start', r))
    check('start ok', startRes.ok)
    await until(() => clients.every((c) => c.latest && c.latest.phase === 'playing'))
    check('phase playing round 1', host.latest.round === 1)
    await playHints(clients, host)
    check('vote atteint après 2 rounds', host.latest.phase === 'voting')
  }

  // ===== Test 2 : rejouer garde le même lobby =====
  {
    console.log('== Test: restart garde la salle ==')
    const { host, clients, code } = await setupRoom(4, { rounds: 1, sameAnime: true, imposteurs: 0 })
    const startRes = await new Promise((r) => host.emit('start', r))
    check('start ok', startRes.ok)
    await until(() => clients.every((c) => c.latest && c.latest.phase === 'playing'))
    await playHints(clients, host)
    check('vote atteint', host.latest.phase === 'voting')
    // votes pour finir
    const target = host.latest.voteOptions[0].id
    for (const c of clients) await new Promise((r) => c.emit('vote', target, r))
    await until(() => host.latest && host.latest.phase === 'results')
    check('results', host.latest.phase === 'results')
    // restart (host only)
    const before = host.latest.players.length
    host.emit('restart')
    await until(() => host.latest && host.latest.phase === 'lobby')
    check('retour en lobby', host.latest.phase === 'lobby')
    check('même code de salle', host.latest.code === code)
    check('joueurs toujours présents', host.latest.players.length === before)
    check('aucun perso assigné en lobby', clients.every((c) => !c.latest.myCharacter))
    // le host peut redémarrer une nouvelle partie
    const start2 = await new Promise((r) => host.emit('start', r))
    check('nouvelle partie possible', start2.ok === true)
    await until(() => host.latest && host.latest.phase === 'playing')
    check('nouvelle partie en cours', host.latest.phase === 'playing')
  }

  // ===== Test 3 : restart refusé aux non-hosts =====
  {
    console.log('== Test: restart refusé si pas host ==')
    const { host, clients } = await setupRoom(3, { rounds: 1, sameAnime: true, imposteurs: 0 })
    await new Promise((r) => host.emit('start', r))
    await until(() => clients.every((c) => c.latest && c.latest.phase === 'playing'))
    await playHints(clients, host)
    const target = host.latest.voteOptions[0].id
    for (const c of clients) await new Promise((r) => c.emit('vote', target, r))
    await until(() => host.latest && host.latest.phase === 'results')
    const nonHost = clients.find((c) => c.id !== host.id)
    nonHost.emit('restart')
    await wait(200)
    check('reste en results (restart refusé)', host.latest.phase === 'results')
  }

  console.log(`\nRÉSULTAT: ${passed} passés, ${failed} échecs`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })