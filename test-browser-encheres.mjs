import puppeteer from 'puppeteer-core'

const URL = process.env.TEST_URL || 'http://localhost:3000'
const CHROME = '/usr/bin/google-chrome-stable'
let passed = 0, failed = 0
const check = (name, cond) => { if (cond) { passed++; console.log('PASS', name) } else { failed++; console.log('FAIL', name) } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function newPlayer(browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: 420, height: 900 })
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(URL, { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForSelector('input[placeholder="Ton pseudo"]', { timeout: 10000 })
      return page
    } catch {
      if (attempt === 2) throw new Error('page introuvable après 3 essais')
    }
  }
  return page
}
async function clickButton(page, text) {
  await page.evaluate((t) => { [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t).click() }, text)
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })

  // 1. Home : choix Enchères + création
  const host = await newPlayer(browser)
  await host.waitForSelector('input[placeholder="Ton pseudo"]')
  await host.type('input[placeholder="Ton pseudo"]', 'Host')
  await host.evaluate(() => [...document.querySelectorAll('.game-card')].find((c) => c.textContent.includes('Enchères')).click())
  await wait(100)
  const activeCard = await host.$eval('.game-card.active .gc-name', (el) => el.textContent)
  check('carte Enchères sélectionnée', activeCard.includes('Enchères'))
  await clickButton(host, 'Créer une partie')
  await host.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Salle'))
  const code = await host.$eval('h1', (el) => el.textContent.replace('💰 Salle ', '').trim())

  // 2. Rejoindre 1 joueur
  const p2 = await newPlayer(browser)
  await p2.type('input[placeholder="Ton pseudo"]', 'J1')
  await clickButton(p2, 'Rejoindre une partie')
  await p2.waitForSelector('input[placeholder="Code de la salle"]')
  await p2.type('input[placeholder="Code de la salle"]', code)
  await clickButton(p2, 'Rejoindre')
  await p2.waitForSelector('.player-list')
  await host.waitForFunction(() => document.querySelectorAll('.player-list li').length === 2)
  check('2 joueurs', true)
  const picks = await host.$$eval('.anime-radio', (l) => l.map((x) => x.textContent))
  check('sélecteur d’anime : 4 choix', picks.length === 4 && picks.includes('One Piece'))

  // 3. Démarrer
  await clickButton(host, '▶️ Démarrer les enchères')
  await host.waitForSelector('.phase-bar', { timeout: 4000 })
  check('barre de phases visible', true)
  await host.waitForSelector('.auction-char .name', { timeout: 4000 })
  check('personnage proposé', (await host.$eval('.auction-char .name', (el) => el.textContent)).length > 0)
  check('portefeuille 20€', (await host.$eval('.wallet', (el) => el.textContent)).includes('20'))
  check('indicateur de tour visible', (await host.$('.auction-turn-name')) !== null)

  // 4. Amener le tour au host (l'autre joueur mise le minimum) puis miser
  let turns = 0
  while (turns++ < 8) {
    if (await host.$('.bid-input')) break
    if (await p2.$('.bid-input')) {
      await clickButton(p2, 'Enchérir')
    }
    await wait(250)
  }
  const hostHasTurn = await host.$('.bid-input')
  if (hostHasTurn) {
    await host.evaluate(() => { document.querySelector('.bid-input').value = '7' })
    await clickButton(host, 'Enchérir')
    await wait(300)
    const status = await host.$eval('.auction-bid-status', (el) => el.textContent)
    check('enchère enregistrée (7€)', status.includes('7€'))
  } else {
    check('tour du host atteint', false)
  }

  console.log(`\nRÉSULTAT: ${passed} passés, ${failed} échecs`)
  await browser.close()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1) })