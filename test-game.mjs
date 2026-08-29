import { io } from 'socket.io-client'

const URL = process.env.TEST_URL || 'http://localhost:3000'
const N = 5 // joueurs
let code = null
let host
const clients = []
const roles = {}
const chars = {}

function mkClient() {
  const s = io(URL, { transports: ['websocket'] })
  s.states = []
  s.on('state', (st) => { s.states.push(st); s.latest = st })
  return s
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (fn, timeout = 3000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (fn()) return true
    await wait(20)
  }
  return false
}

const log = (...a) => console.log('  ', ...a)
let passed = 0, failed = 0
function check(name, cond) {
  if (cond) { passed++; log('PASS', name) }
  else { failed++; log('FAIL', name) }
}

// --- helpers pour avancer le tour d'un joueur
async function playHints() {
  // chaque round : chaque joueur donne un indice à son tour
  for (let round = 1; round <= 3; round++) {
    // pour chaque joueur dans l'ordre du tour
    // on avance en faisant jouer le joueur dont c'est le tour
    let guard = 0
    while (guard++ < 50) {
      const h = clients[0].latest
      if (!h || h.phase !== 'playing') break
      const me = clients.find((c) => c.id === h.turnPlayerId)
      if (!me) { log('  no me for turn', h.turnPlayerId); break }
      await new Promise((r) => me.emit('hint', 'indice-' + round + '-' + me.id.slice(0,3), (res) => r(res)))
      await until(() => clients[0].latest.turnPlayerId !== h.turnPlayerId || clients[0].latest.phase === 'voting')
      if (clients[0].latest.phase === 'voting') break
    }
  }
}

async function main() {
  // 1. Créer la salle
  host = mkClient()
  clients.push(host)
  await until(() => host.id)
  const createRes = await new Promise((r) => host.emit('createRoom', { name: 'Host', settings: { rounds: 3, sameAnime: true, imposteurs: 0 } }, r))
  check('création salle', createRes.ok)
  code = createRes.code
  log('salle', code)

  // 2. Rejoindre 4 joueurs
  for (let i = 0; i < N - 1; i++) {
    const c = mkClient()
    clients.push(c)
    await until(() => c.id)
    const res = await new Promise((r) => c.emit('joinRoom', { code, name: 'J' + (i + 1) }, r))
    check('rejoindre J' + (i + 1), res.ok)
  }
  await until(() => host.latest && host.latest.players.length === N)
  check('5 joueurs dans la salle', host.latest.players.length === N)

  // 3. Impossible de commencer avec settings invalides (moins de 2 persos)
  // 4. Démarrer
  const startRes = await new Promise((r) => host.emit('start', r))
  check('démarrage', startRes.ok)
  await until(() => clients.every((c) => c.latest && c.latest.phase === 'playing'))
  check('phase playing pour tous', clients.every((c) => c.latest.phase === 'playing'))

  // vérifier rôles et persos (l'imposteur = le perso "orphelin")
  const charCounts = {}
  for (const c of clients) {
    const id = c.latest.myCharacter.id
    charCounts[id] = (charCounts[id] || 0) + 1
    check('chacun a un perso', !!c.latest.myCharacter?.name)
  }
  const imposteurIds = Object.keys(charCounts).filter((id) => charCounts[id] === 1)
  const citoyenIds = Object.keys(charCounts).filter((id) => charCounts[id] > 1)
  check('nb imposteurs = 1 (n=5)', imposteurIds.length === 1)
  check('même anime: 2 persos distincts', imposteurIds.length + citoyenIds.length === 2)

  // 5. Hints sur 3 rounds
  await playHints()
  const after = clients[0].latest
  check('phase voting après 3 rounds', after.phase === 'voting')

  // 6. Vote
  const vOptions = after.voteOptions
  const target = vOptions[0].id
  for (const c of clients) {
    await new Promise((r) => c.emit('vote', target, r))
  }
  await until(() => clients[0].latest && clients[0].latest.phase === 'results')
  check('phase results après vote', clients[0].latest.phase === 'results')
  const res = clients[0].latest.results
  check('résultats présentent', !!res)
  log('winner:', res.winner, '| detail:', res.detail)

  console.log(`\nRÉSULTAT: ${passed} passés, ${failed} échecs`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
