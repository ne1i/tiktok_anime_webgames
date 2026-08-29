import { io } from 'socket.io-client'

const URL = process.env.TEST_URL || 'http://localhost:3000'
let passed = 0, failed = 0
function check(name, cond) {
  if (cond) { passed++; console.log('  PASS', name) }
  else { failed++; console.log('  FAIL', name) }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (fn, timeout = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (fn()) return true; await wait(20) } return false }
const mk = () => { const s = io(URL, { transports: ['websocket'] }); s.on('state', (st) => { s.latest = st }); return s }
const emit = (s, ev, ...args) => new Promise((r) => s.emit(ev, ...args, (res) => r(res)))
const clients = []
const done = (code) => { for (const c of clients) c.disconnect(); process.exit(code) }

async function createAndJoin(nPlayers, settings) {
  const team = []
  const host = mk(); clients.push(host); team.push(host)
  await until(() => host.id)
  const res = await emit(host, 'createRoom', { name: 'Host', settings })
  check('création salle', res.ok)
  for (let i = 0; i < nPlayers - 1; i++) {
    const c = mk(); clients.push(c); team.push(c)
    await until(() => c.id)
    const jr = await emit(c, 'joinRoom', { code: res.code, name: 'J' + i })
    check('rejoindre J' + i, jr.ok)
  }
  await until(() => team.every((c) => c.latest?.players?.length === nPlayers))
  return team
}

async function playRound(team, roundNo) {
  // chaque joueur joue son tour jusqu'à changer de phase
  for (let i = 0; i < 20; i++) {
    const st = team[0].latest
    if (st.phase !== 'playing') return
    const all = team.filter((c) => c.connected)
    const tc = all.find((c) => c.id === st.turnPlayerId)
    if (!tc) return
    await emit(tc, 'hint', 'idx-' + roundNo + '-' + i)
    await until(() => team[0].latest.turnPlayerId !== st.turnPlayerId || team[0].latest.phase !== 'playing')
  }
}

async function main() {
  // ---- 1. hint non-string ne crashe pas le serveur
  {
    const team = await createAndJoin(3, { rounds: 2, sameAnime: true, imposteurs: 0 })
    const sr = await emit(team[0], 'start')
    check('démarrage ok', sr.ok)
    await until(() => team.every((c) => c.latest?.phase === 'playing'))
    const st = team[0].latest
    const tc = clients.find((c) => c.id === st.turnPlayerId)
    const r1 = await emit(tc, 'hint', 42)
    check('hint numérique rejeté proprement', r1.ok === false && !!r1.error)
    const r2 = await emit(tc, 'hint', { evil: true })
    check('hint objet rejeté proprement', r2.ok === false && !!r2.error)
    const r3 = await emit(tc, 'hint', null)
    check('hint null rejeté proprement', r3.ok === false && !!r3.error)
    const probe = mk(); clients.push(probe)
    const alive = await until(() => probe.id, 3000)
    check('serveur toujours en vie', alive)
    const r4 = await emit(tc, 'hint', 'bon indice')
    check('hint valide accepté après', r4.ok === true)
  }

  // ---- 2. imposteurs multiples : éliminer 1 imposteur => victoire citoyens
  {
    const team = await createAndJoin(5, { rounds: 1, sameAnime: true, imposteurs: 2 })
    const sr = await emit(team[0], 'start')
    check('démarrage 5 joueurs / 2 imposteurs', sr.ok)
    await until(() => team.every((c) => c.latest?.phase === 'playing'))
    const counts = {}
    for (const c of team) counts[String(c.latest.myCharacter.id)] = (counts[String(c.latest.myCharacter.id)] || 0) + 1
    const imposteurChar = Object.keys(counts).find((id) => counts[id] === 2)
    const imposteurs = team.filter((c) => String(c.latest.myCharacter.id) === imposteurChar)
    check('2 imposteurs détectés', imposteurs.length === 2)
    await playRound(team, 1)
    await until(() => team[0].latest?.phase === 'voting')
    const target = imposteurs[0].id
    for (const c of team) {
      const t = c.id === target ? team.find((x) => String(x.latest.myCharacter.id) !== imposteurChar).id : target
      await emit(c, 'vote', t)
    }
    await until(() => team[0].latest?.phase === 'results')
    check('1 imposteur sur 2 éliminé => citoyens gagnent', team[0].latest.results.winner === 'citoyens')
    check('detail correct', /imposteur/.test(team[0].latest.results.detail))
  }

  // ---- 3. déconnexion pendant son tour => la partie continue
  {
    const team = await createAndJoin(4, { rounds: 2, sameAnime: true, imposteurs: 0 })
    const sr = await emit(team[0], 'start')
    check('démarrage 4 joueurs', sr.ok)
    await until(() => team.every((c) => c.latest?.phase === 'playing'))
    const victim = team[1]
    const victimId = victim.id
    for (let i = 0; i < 8; i++) {
      const st = team[0].latest
      if (st.phase !== 'playing') break
      if (st.turnPlayerId === victimId) break
      const tc = team.find((c) => c.id === st.turnPlayerId)
      await emit(tc, 'hint', 'pre-' + i)
      await until(() => team[0].latest.turnPlayerId !== st.turnPlayerId || team[0].latest.phase !== 'playing')
    }
    check('victime a le tour', team[0].latest.turnPlayerId === victimId)
    victim.disconnect()
    await wait(300)
    check('victime retirée du turnOrder', !team[0].latest.turnOrder.includes(victimId))
    check('tour rejoué par un joueur présent', team[0].latest.players.some((p) => p.id === team[0].latest.turnPlayerId))
    const next = team.find((c) => c.connected && c.id === team[0].latest.turnPlayerId)
    const hr = await emit(next, 'hint', 'après déco')
    check('le tour du suivant fonctionne', hr.ok === true)
    check('phase toujours playing', team[0].latest.phase === 'playing')
  }

  // ---- 4. déconnexion du dernier non-votant pendant le vote => résultats
  {
    const team = await createAndJoin(3, { rounds: 1, sameAnime: true, imposteurs: 0 })
    const sr = await emit(team[0], 'start')
    check('démarrage 3 joueurs', sr.ok)
    await until(() => team.every((c) => c.latest?.phase === 'playing'))
    await playRound(team, 1)
    await until(() => team[0].latest?.phase === 'voting')
    const nonVoter = team[2]
    await emit(team[0], 'vote', nonVoter.id)
    await emit(team[1], 'vote', team[0].id)
    check('2 votes enregistrés', team[0].latest.haveVoted.length === 2)
    nonVoter.disconnect()
    await until(() => team[0].latest?.phase === 'results')
    check('résultats calculés après déco du non-votant', team[0].latest.phase === 'results')
  }

  // ---- 5. égalité au vote enchères : revote puis départage aléatoire
  {
    const team = await createAndJoin(2, { game: 'encheres', auctionAnime: 'One Piece', money: 1, target: 1, skips: 0 })
    const sr = await emit(team[0], 'start')
    check('démarrage enchères', sr.ok)
    // chacun mise 1€ au premier tour puis passe (budget épuisé)
    for (let i = 0; i < 20 && team[0].latest?.phase === 'encheres'; i++) {
      const a = team[0].latest.auction
      if (!a.current) { await wait(100); continue }
      const me = team.find((c) => c.id === a.current.turnId)
      if (!me) { await wait(100); continue }
      if (a.current.bid === 0) await emit(me, 'bid', 1)
      else await emit(me, 'pass')
      await wait(100)
    }
    await until(() => team[0].latest?.phase === 'debat')
    check('enchères finies (budget épuisé)', team[0].latest.phase === 'debat')
    team[0].emit('startVote') // pas d'ack côté serveur
    await until(() => team[0].latest?.phase === 'vote')
    // tour 1 : chacun vote pour l'autre => égalité
    await emit(team[0], 'voteAuction', team[1].id)
    await emit(team[1], 'voteAuction', team[0].id)
    await wait(300)
    check('égalité => retour au vote', team[0].latest.phase === 'vote' && team[0].latest.haveVoted.length === 0)
    // tour 2 : encore égalité => départage aléatoire
    await emit(team[0], 'voteAuction', team[1].id)
    await emit(team[1], 'voteAuction', team[0].id)
    await until(() => team[0].latest?.phase === 'results')
    check('2e égalité => résultats (départage)', team[0].latest.phase === 'results')
    check('un gagnant désigné', team[0].latest.results.winnerId !== null)
  }

  // ---- 6. validations d'entrée
  {
    const s = mk(); clients.push(s)
    await until(() => s.id)
    const longName = 'X'.repeat(100)
    const r1 = await emit(s, 'createRoom', { name: longName, settings: {} })
    check('createRoom nom trop long ok (tronqué)', r1.ok)
    const view = s.latest
    check('nom tronqué à 20', view.players[0].name.length === 20)
    const r2 = await emit(s, 'createRoom', { name: 'Again', settings: {} })
    check('createRoom refusé si déjà dans une salle', r2.ok === false)
    const r3 = await emit(s, 'joinRoom', { code: 'ZZZZ', name: 'Nope' })
    check('joinRoom refusé si déjà dans une salle', r3.ok === false)
    const empty = mk(); clients.push(empty)
    await until(() => empty.id)
    const r4 = await emit(empty, 'createRoom', { name: '', settings: {} })
    check('nom vide => Joueur', empty.latest.players[0].name === 'Joueur')
    check('createRoom nom vide ok', r4.ok)
  }

  // ---- 7. mode hôte : l'arbitre part => le nouveau host continue de jouer
  {
    const team = []
    const host = mk(); clients.push(host); team.push(host)
    await until(() => host.id)
    const res = await emit(host, 'createRoom', { name: 'H', settings: { rounds: 2, mode: 'host', imposteurs: 0 } })
    for (let i = 0; i < 3; i++) {
      const c = mk(); clients.push(c); team.push(c)
      await until(() => c.id)
      await emit(c, 'joinRoom', { code: res.code, name: 'J' + i })
    }
    await until(() => host.latest?.players.length === 4)
    const chars = host.latest.characters
    const cit = chars[0], imp = chars[1]
    await emit(host, 'hostPicks', { citoyenId: cit.id, imposteurId: imp.id })
    const sr = await emit(host, 'start')
    check('démarrage mode hôte', sr.ok)
    await until(() => host.latest?.phase === 'playing' && team.every((c) => c.latest?.phase === 'playing'))
    check('arbitre a le rôle arbitre', host.latest.myRole === 'arbitre')
    // les joueurs jouent, puis l'host/arbitre se déconnecte
    const st = host.latest
    const tc = team.find((c) => c.id === st.turnPlayerId)
    await emit(tc, 'hint', 'x')
    await wait(200)
    const newHostClient = team[1]
    const newHostIdBefore = newHostClient.id
    host.disconnect()
    await wait(400)
    const st2 = newHostClient.latest
    check('host transféré à un joueur', st2.host === newHostIdBefore)
    check('nouveau host garde son personnage', !!st2.myCharacter && st2.myRole !== 'arbitre')
    check('partie toujours en cours', st2.phase === 'playing')
    if (st2.turnPlayerId === newHostIdBefore) {
      const hr = await emit(newHostClient, 'hint', 'en tant que nouveau host')
      check('nouveau host peut jouer son tour', hr.ok === true)
    }
  }

  console.log(`\nRÉSULTAT: ${passed} passés, ${failed} échecs`)
  done(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); done(1) })
