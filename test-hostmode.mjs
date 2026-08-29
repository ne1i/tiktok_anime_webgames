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

async function main() {
  console.log('== Setup hôte arbitre ==')
  const host = mkClient()
  await until(() => host.id)
  const createRes = await new Promise((r) => host.emit('createRoom', { name: 'Hote', settings: { rounds: 1, mode: 'host' } }, r))
  const code = createRes.code
  const players = [host]
  for (let i = 0; i < 3; i++) {
    const c = mkClient()
    players.push(c)
    await until(() => c.id)
    await new Promise((r) => c.emit('joinRoom', { code, name: 'J' + i }, r))
  }
  await until(() => host.latest && host.latest.players.length === 4)
  check('mode host activé', host.latest.settings.mode === 'host')

  const chars = host.latest.characters
  check('liste de persos envoyée', chars.length > 50)
  const c1 = chars.find((c) => c.anime === 'Naruto' && c.name.includes('Naruto'))
  const c2 = chars.find((c) => c.anime === 'Bleach' && c.name.includes('Ichigo'))
  check('persos trouvés pour le picker', !!c1 && !!c2)

  const startEarly = await new Promise((r) => host.emit('start', r))
  check('start refusé sans picks', startEarly.ok === false)

  const pk = await new Promise((r) => host.emit('hostPicks', { citoyenId: c1.id, imposteurId: c2.id }, r))
  check('hostPicks acceptés', pk.ok === true)

  const startRes = await new Promise((r) => host.emit('start', r))
  check('start accepté avec picks', startRes.ok === true)
  await until(() => players.every((p) => p.latest && p.latest.phase === 'playing'))
  check('phase playing', players.every((p) => p.latest.phase === 'playing'))

  check('hôte = arbitre', host.latest.myRole === 'arbitre')
  check('hôte voit les 2 persos', host.latest.spectator?.citoyen?.id === c1.id && host.latest.spectator?.imposteur?.id === c2.id)
  check('hôte sans personnage', !host.latest.myCharacter)
  const joueurs = players.filter((p) => p.id !== host.id)
  check('3 joueurs jouent', joueurs.every((p) => p.latest.myCharacter))
  check('joueurs sans role visible', joueurs.every((p) => !p.latest.myRole))

  check('hôte pas dans le tour', !host.latest.turnOrder.includes(host.id))
  check('tour = 3 joueurs', host.latest.turnOrder.length === 3)

  const currentFirst = host.latest.turnPlayerId
  const me = joueurs.find((p) => p.id === currentFirst)
  await new Promise((r) => me.emit('hint', 'indice', r))
  await until(() => host.latest.phase === 'voting' || host.latest.turnIndex === 1)
  check('tour avance sans l’hôte', host.latest.turnIndex === 1)
  for (let k = 0; k < 2; k++) {
    const tp = host.latest.turnPlayerId
    const pj = joueurs.find((p) => p.id === tp)
    await new Promise((r) => pj.emit('hint', 'i' + k, r))
    await wait(150)
  }
  check('phase voting après 3 indices', host.latest.phase === 'voting')

  const target = host.latest.voteOptions[0].id
  for (const j of joueurs) await new Promise((r) => j.emit('vote', target, r))
  await until(() => host.latest && host.latest.phase === 'results')
  check('results', host.latest.phase === 'results')
  check('hôte voit les résultats', !!host.latest.results)
  check('results sans l’hôte dans la liste', !host.latest.results.players.some((p) => p.id === host.id))

  host.emit('restart')
  await until(() => host.latest && host.latest.phase === 'lobby')
  check('retour lobby', host.latest.phase === 'lobby')
  const startAgain = await new Promise((r) => host.emit('start', r))
  check('rejouer sans re-picker', startAgain.ok === true)

  console.log(`\nRÉSULTAT: ${passed} passés, ${failed} échecs`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })