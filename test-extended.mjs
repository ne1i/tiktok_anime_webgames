import { io } from 'socket.io-client'

const URL = process.env.TEST_URL || 'http://localhost:3000'
let passed = 0, failed = 0
function check(name, cond) {
  if (cond) { passed++; console.log('PASS', name) }
  else { failed++; console.log('FAIL', name) }
}
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

async function setupRoom(n, settings, name = 'H') {
  const clients = []
  const host = mkClient()
  clients.push(host)
  await until(() => host.id)
  const createRes = await new Promise((r) => host.emit('createRoom', { name, settings }, r))
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

async function startAndWait(clients, host) {
  const startRes = await new Promise((r) => host.emit('start', r))
  await until(() => clients.every((c) => c.latest && c.latest.phase === 'playing'))
  return startRes
}

async function playHints(clients, host) {
  let guard = 0
  while (guard++ < 100) {
    const h = host.latest
    if (!h || h.phase !== 'playing') break
    const me = clients.find((c) => c.id === h.turnPlayerId)
    if (!me) { console.log('  no me for', h.turnPlayerId); break }
    const before = h.turnIndex
    await new Promise((r) => me.emit('hint', 'indice', (res) => r(res)))
    await until(() => host.latest.phase === 'voting' || host.latest.turnIndex !== before || host.latest.round !== h.round)
  }
}

async function voteAll(clients, targetId) {
  for (const c of clients) {
    await new Promise((r) => c.emit('vote', targetId, r))
  }
  await until(() => clients[0].latest && clients[0].latest.phase === 'results')
}

function findRoles(clients) {
  const counts = {}
  for (const c of clients) {
    const id = String(c.latest.myCharacter.id)
    counts[id] = (counts[id] || 0) + 1
  }
  const imposteurCharId = Object.keys(counts).find((id) => counts[id] === 1)
  const citoyenCharId = Object.keys(counts).find((id) => counts[id] > 1)
  const imposteur = clients.find((c) => String(c.latest.myCharacter.id) === imposteurCharId)
  const citoyens = clients.filter((c) => String(c.latest.myCharacter.id) === citoyenCharId)
  return { imposteur, citoyens }
}

async function main() {
  // ===== Test 1 : mode "anime différents" =====
  {
    console.log('== Test: anime différents ==')
    const { host, clients } = await setupRoom(4, { rounds: 3, sameAnime: false, imposteurs: 0 })
    const startRes = await startAndWait(clients, host)
    check('start ok', startRes.ok)
    const chars = new Set(clients.map((c) => c.latest.myCharacter.id))
    check('mode différent: 2 persos distincts', chars.size === 2)
    const { imposteur, citoyens } = findRoles(clients)
    check('role imposteur correct', citoyens.length === 3 && !!imposteur)
    const imposteurChar = imposteur.latest.myCharacter
    const citoyenChar = citoyens[0].latest.myCharacter
    check('imposteur d’un anime différent', imposteurChar.anime !== citoyenChar.anime)
    await playHints(clients, host)
    check('phase voting', host.latest.phase === 'voting')
    await voteAll(clients, citoyens[0].id)
    check('results', host.latest.phase === 'results')
    const r = host.latest.results
    check('imposteurs gagnent si citoyen éliminé', r.winner === 'imposteurs')
    check('imposteur révélé', r.imposteurIds.length === 1)
  }

  // ===== Test 2 : désélectionner des animes =====
  {
    console.log('== Test: sélection anime ==')
    const { host, clients } = await setupRoom(3, { rounds: 1, sameAnime: true, imposteurs: 0 })
    // on garde Naruto, on décoche les autres
    for (const anime of host.latest.animes) {
      if (anime !== 'Naruto') await new Promise((r) => host.emit('toggleAnime', { anime, checked: false }, r))
    }
    await until(() => {
      const st = host.latest
      return st.settings.selectedAnimes.length === 1 && st.settings.selectedAnimes[0] === 'Naruto'
    })
    check('une seule anime sélectionnée', host.latest.settings.selectedAnimes.length === 1)
    const startRes = await startAndWait(clients, host)
    check('start ok avec 1 anime', startRes.ok)
    const animes = new Set(clients.map((c) => c.latest.myCharacter.anime))
    check('tous les persos sont de Naruto', animes.size === 1 && animes.has('Naruto'))
    const { imposteur, citoyens } = findRoles(clients)
    const reference = citoyens[0]
    check('imposteur différent du citoyen', imposteur.latest.myCharacter.id !== reference.latest.myCharacter.id)
    check('même anime: imposteur de Naruto', imposteur.latest.myCharacter.anime === 'Naruto')
  }

  // ===== Test 3 : tous les animes décochés -> ne devrait pas démarrer =====
  {
    console.log('== Test: tous animes décochés ==')
    const { host } = await setupRoom(3, { rounds: 1, sameAnime: true, imposteurs: 0 })
    for (const anime of host.latest.animes) {
      await new Promise((r) => host.emit('toggleAnime', { anime, checked: false }, r))
    }
    await until(() => host.latest.settings.selectedAnimes.length === 0)
    const startRes = await new Promise((r) => host.emit('start', r))
    check('start refusé avec 0 anime', startRes.ok === false)
  }

  // ===== Test 4 : pas le bon tour -> refusé =====
  {
    console.log('== Test: indice hors tour ==')
    const { host, clients } = await setupRoom(3, { rounds: 1, sameAnime: true, imposteurs: 0 })
    const startRes = await startAndWait(clients, host)
    check('start ok', startRes.ok)
    const currentId = host.latest.turnPlayerId
    const other = clients.find((c) => c.id !== currentId)
    const res = await new Promise((r) => other.emit('hint', 'hors tour', r))
    check('indice hors tour refusé', res.ok === false)
    const valid = await new Promise((r) => {
      const me = clients.find((c) => c.id === currentId)
      me.emit('hint', 'valide', r)
    })
    check('indice au tour accepté', valid.ok === true)
  }

  console.log(`\nRÉSULTAT: ${passed} passés, ${failed} échecs`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })