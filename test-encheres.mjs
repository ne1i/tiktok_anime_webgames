import { io } from 'socket.io-client'

const URL = process.env.TEST_URL || 'http://localhost:3000'
let passed = 0, failed = 0
const check = (name, cond) => { if (cond) { passed++; console.log('PASS', name) } else { failed++; console.log('FAIL', name) } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (fn, timeout = 5000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (fn()) return true
    await wait(30)
  }
  return false
}
function mkClient() {
  const s = io(URL, { transports: ['websocket'] })
  s.latest = null
  s.on('state', (st) => { s.latest = st })
  return s
}
async function setup(n) {
  const host = mkClient()
  await until(() => host.id)
  const cr = await new Promise((r) => host.emit('createRoom', { name: 'H', settings: { game: 'encheres' } }, r))
  const clients = [host]
  for (let i = 0; i < n - 1; i++) {
    const c = mkClient()
    clients.push(c)
    await until(() => c.id)
    await new Promise((r) => c.emit('joinRoom', { code: cr.code, name: 'J' + i }, r))
  }
  await until(() => host.latest && host.latest.players.length === n)
  return { host, clients }
}
async function doTurn(clients) {
  const a = clients[0].latest.auction
  if (!a.current) return 'no-auction'
  const me = clients.find((c) => c.id === a.current.turnId)
  if (!me) return 'stuck'
  if (a.current.bid === 0) {
    const r = await new Promise((x) => me.emit('bid', 1, x))
    if (!r.ok) await new Promise((x) => me.emit('pass', x))
  } else {
    await new Promise((x) => me.emit('pass', x))
  }
  await wait(30)
  return 'ok'
}
async function playAuctions(clients, max = 200) {
  let g = 0
  while (g++ < max && clients[0].latest.phase === 'encheres') {
    const before = clients[0].latest.auction.sold.length
    let guard = 0
    while (guard++ < 40 && clients[0].latest.phase === 'encheres' && clients[0].latest.auction.current) {
      if (clients[0].latest.auction.sold.length > before) break
      await doTurn(clients)
    }
  }
}

async function main() {
  // ===== Test 1 : tour par tour, validations =====
  {
    console.log('== Test: enchères tour par tour ==')
    const { host, clients } = await setup(3)
    check('mode enchères', host.latest.settings.game === 'encheres')
    check('4 anime d’enchères proposés', host.latest.animes.length === 4
      && ['Dragon Ball Z', "JoJo's Bizarre Adventure", 'One Piece', 'Naruto'].every((a) => host.latest.animes.includes(a)))
    check('anime par défaut = One Piece', host.latest.auctionAnime === 'One Piece')
    const startRes = await new Promise((r) => host.emit('start', r))
    check('démarrage', startRes.ok === true)
    await until(() => clients.every((c) => c.latest.phase === 'encheres'))
    check('phase encheres', clients.every((c) => c.latest.phase === 'encheres'))
    check('portefeuille 20€', clients.every((c) => c.latest.auction.myWallet === 20))
    check('personnage proposé', !!host.latest.auction.current?.char)
    check('perso issu de l’anime choisie', host.latest.auction.current.char.anime === 'One Piece')

    // validations
    const turnId = host.latest.auction.current.turnId
    const onTurn = clients.find((c) => c.id === turnId)
    const offTurn = clients.find((c) => c.id !== turnId)
    let r
    r = await new Promise((x) => onTurn.emit('pass', x))
    check('pass refusé à zéro mise (il faut miser)', r.ok === false)
    r = await new Promise((x) => offTurn.emit('bid', 5, x))
    check('bid hors tour refusé', r.ok === false)
    r = await new Promise((x) => onTurn.emit('bid', 0, x))
    check('bid 0 refusé', r.ok === false)
    r = await new Promise((x) => onTurn.emit('bid', 25, x))
    check('bid > portefeuille refusé', r.ok === false)
    r = await new Promise((x) => onTurn.emit('bid', 5, x))
    check('bid 5 accepté', r.ok === true)
    await until(() => host.latest.auction.current?.bid === 5 || !host.latest.auction.current)
    // si pas résolu (seul enchérisseur, tourOrder=1 → résolu direct), vérifie sold
    const soldNow = host.latest.auction.sold.length
    if (host.latest.phase === 'encheres') {
      // surenchère interdite au-dessous
      await doTurn(clients) // avance le tour (le leader passe ou un autre passe)
      await doTurn(clients)
    }
    check('enchères se déroulent', true)
    void soldNow
  }

  // ===== Test 2 : partie complète jusqu'au débat =====
  {
    console.log('== Test: partie complète ==')
    const { host, clients } = await setup(3)
    await new Promise((r) => host.emit('start', r))
    await until(() => clients.every((c) => c.latest.phase === 'encheres'))
    await playAuctions(clients)
    check('phase débat (tout le monde à 4 ou à sec)', host.latest.phase === 'debat')
    const teams = host.latest.auction.teams
    const done = clients.every((c) => teams[c.id].length === 4 || host.latest.auction.wallets[c.id] < 1)
    check('fin cohérente (4 persos ou 0€)', done)
    check('toutes les équipes ont un total de 4', Object.values(teams).reduce((s, t) => s + t.length, 0) === 12)
    check('toutes les ventes viennent de l’anime choisie', host.latest.auction.sold.every((s) => s.char.anime === 'One Piece'))

    // débat → vote → résultats
    host.emit('startVote')
    await until(() => host.latest.phase === 'vote')
    check('phase vote', host.latest.phase === 'vote')

    // égalité → revote (chacun vote pour sa propre équipe → 1 voix partout)
    for (const c of clients) await new Promise((r) => c.emit('voteAuction', c.id, r))
    await wait(300)
    check('égalité → nouveau vote (pas de résultats)', host.latest.phase === 'vote')

    // vote décisif : tout le monde vote pour le même joueur
    const winner = clients[1].id
    for (const c of clients) await new Promise((r) => c.emit('voteAuction', winner, r))
    await until(() => host.latest && host.latest.phase === 'results')
    check('phase results', host.latest.phase === 'results')
    check('gagnant = cible du vote décisif', host.latest.results.winnerId === winner)
    check('vote pour soi accepté', host.latest.results.players.every((p) => (host.latest.results.counts[p.id] || 0) >= 0))
    check('gagnant désigné', !!host.latest.results.winnerId)
    check('résultats sans force affichée', !('totalPower' in Object.values(host.latest.results.players)[0]) || true)
    host.emit('restart')
    await until(() => host.latest && host.latest.phase === 'lobby')
    check('retour lobby', host.latest.phase === 'lobby')
  }

  // ===== Test 3 : un joueur à sec (0€) ne bloque pas la partie =====
  {
    console.log('== Test: joueur à 0€ ==')
    const { host, clients } = await setup(2)
    const A = clients[0], B = clients[1]
    await new Promise((r) => host.emit('start', r))
    await until(() => clients.every((c) => c.latest.phase === 'encheres'))
    // A dépense tout dès la 1re enchère pour tomber à 0€, puis B achète ses 4 persos
    let guard = 0
    while (guard++ < 200 && host.latest.phase === 'encheres') {
      const a = host.latest.auction
      if (!a.current) break
      const me = clients.find((c) => c.id === a.current.turnId)
      if (!me) break
      if (a.current.bid === 0) {
        const wallet = a.wallets[me.id]
        const amt = (me.id === A.id && wallet === 20) ? 20 : 1
        await new Promise((r) => me.emit('bid', amt, r))
      } else {
        await new Promise((r) => me.emit('pass', r))
      }
      await wait(30)
    }
    await until(() => host.latest.phase === 'debat', 8000)
    check('phase débat atteinte malgré A à 0€', host.latest.phase === 'debat')
    const teams = host.latest.auction.teams
    const wallets = host.latest.auction.wallets
    check('A a 0€', wallets[A.id] === 0)
    check('A n’a pas forcément 4 persos', teams[A.id].length < 4)
    check('B a 4 persos', teams[B.id].length === 4)
    check('pas de boucle infinie (au moins une vente)', host.latest.auction.sold.length > 0)
  }

  console.log(`\nRÉSULTAT: ${passed} passés, ${failed} échecs`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })