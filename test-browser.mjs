import puppeteer from 'puppeteer-core'

const URL = process.env.TEST_URL || 'http://localhost:3000'
const CHROME = '/usr/bin/google-chrome-stable'
let passed = 0, failed = 0
const check = (name, cond) => { if (cond) { passed++; console.log('PASS', name) } else { failed++; console.log('FAIL', name) } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function newPlayer(browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: 420, height: 900 })
  await page.goto(URL, { waitUntil: 'networkidle0' })
  return page
}

async function clickButton(page, text) {
  await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t)
    btn.click()
  }, text)
}

async function setPseudo(page, name) {
  await page.waitForSelector('input[placeholder="Ton pseudo"]')
  await page.type('input[placeholder="Ton pseudo"]', name)
}

async function createRoom(page) {
  await clickButton(page, 'Créer une partie')
  await page.waitForFunction(() => document.querySelector('h1')?.textContent.startsWith('Salle'))
  const code = await page.$eval('h1', (el) => el.textContent.replace('Salle ', '').trim())
  return code
}

async function joinRoom(page, code) {
  await clickButton(page, 'Rejoindre une partie')
  await page.waitForSelector('input[placeholder="Code de la salle"]')
  await page.type('input[placeholder="Code de la salle"]', code)
  await clickButton(page, 'Rejoindre')
  await page.waitForSelector('.player-list')
}

async function currentTurnPage(pages) {
  for (const pg of pages) {
    const txt = await pg.$eval('h1', (el) => el.textContent).catch(() => '')
    if (txt === 'À toi !') return pg
  }
  return null
}

async function waitForText(page, selector, text, timeout = 4000) {
  try {
    await page.waitForFunction(
      (sel, txt) => {
        const el = document.querySelector(sel)
        return el && el.textContent.includes(txt)
      },
      { timeout },
      selector,
      text
    )
    return true
  } catch {
    return false
  }
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })

  const host = await newPlayer(browser)
  await setPseudo(host, 'Host')
  const code = await createRoom(host)
  check('salle créée avec code 4 lettres', code.length === 4)
  await host.waitForSelector('.player-list li')
  check('host seul au départ', (await host.$$eval('.player-list li', (l) => l.length)) === 1)

  const p2 = await newPlayer(browser)
  await setPseudo(p2, 'Joueur2')
  await joinRoom(p2, code)
  const p3 = await newPlayer(browser)
  await setPseudo(p3, 'Joueur3')
  await joinRoom(p3, code)

  await host.waitForFunction(() => document.querySelectorAll('.player-list li').length === 3)
  check('3 joueurs dans la salle', true)

  // Anime + recherche
  const animeCount = await host.$$eval('.anime-item', (l) => l.length)
  check('grille anime affichée (' + animeCount + ')', animeCount > 10)
  await host.type('.search', 'naruto')
  await wait(300)
  const filtered = await host.$$eval('.anime-item', (l) => l.map((x) => x.textContent))
  check('recherche filtre vers Naruto', filtered.length === 1 && filtered[0].includes('Naruto'))

  // Re-cocher toutes les animes : on vide la recherche et on remet tout coché par défaut
  // (les toggles côté serveur n'ont pas été touchés, tout est sélectionné)
  await host.evaluate(() => { const s = document.querySelector('.search'); s.value = ''; })
  await wait(200)

  await clickButton(host, '▶️ Démarrer la partie')
  await wait(500)
  check('jeu démarré', (await host.$('.char-card')) !== null)

  // jouer les 9 tours (3 rounds x 3 joueurs)
  const pages = [host, p2, p3]
  let allTurnOk = true
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 3; i++) {
      const turn = await currentTurnPage(pages)
      if (!turn) { allTurnOk = false; console.log('  pas de tour pour r' + round + '-' + i); break }
      await turn.type('input[placeholder*="évoque"]', 'indice')
      await clickButton(turn, 'Envoyer')
      await wait(250)
    }
  }
  check('tous les tours joués', allTurnOk)

  // Phase vote
  const votingOk = await waitForText(host, 'h1', 'Vote final')
  check('phase vote atteinte', votingOk)

  // Votes
  for (const pg of pages) {
    await pg.waitForSelector('.vote-btn', { timeout: 3000 })
    await pg.evaluate(() => {
      const btns = [...document.querySelectorAll('.vote-btn')]
      btns[1].click()
    })
    await wait(200)
  }
  await wait(500)
  check('résultats affichés', await host.waitForSelector('.winner-banner', { timeout: 3000 }).then(() => true).catch(() => false))
  const chars = await host.$$eval('.char-card .name', (l) => l.map((x) => x.textContent))
  check('2 persos révélés dans résultats', chars.length === 2)

  // Rejouer : reload -> retour menu
  await host.reload({ waitUntil: 'networkidle0' })
  await host.waitForSelector('input[placeholder="Ton pseudo"]')
  check('retour au menu après reload', true)

  console.log(`\nRÉSULTAT: ${passed} passés, ${failed} échecs`)
  await browser.close()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1) })