import fs from 'node:fs'

const d = JSON.parse(fs.readFileSync('data/characters.json', 'utf8'))
const ALIASES = {
  'Naruto': ['naruto'], 'One Piece': ['one piece'], 'Dragon Ball Z': ['dragon ball'], 'Bleach': ['bleach'],
  'Jujutsu Kaisen': ['jujutsu'], 'Demon Slayer': ['demon slayer', 'kimetsu'], "L'Attaque des Titans": ['attack on titan', 'shingeki'],
  'My Hero Academia': ['my hero academia', 'boku no hero'], 'Fullmetal Alchemist': ['fullmetal'], 'Hunter x Hunter': ['hunter x hunter'],
  'Death Note': ['death note'], 'Tokyo Ghoul': ['tokyo ghoul'], 'Chainsaw Man': ['chainsaw'], 'Code Geass': ['code geass'],
  'Sword Art Online': ['sword art online'], 'Black Clover': ['black clover'], 'One Punch Man': ['one punch'], 'Mob Psycho 100': ['mob psycho'],
  'Vinland Saga': ['vinland'], 'Berserk': ['berserk'], 'Spy x Family': ['spy x family', 'spy family'], 'Steins;Gate': ['steins'],
  'Cowboy Bebop': ['bebop'], 'Evangelion': ['evangelion'], 'Tokyo Revengers': ['tokyo revengers'], 'Haikyuu !!': ['haikyu'],
  'Frieren': ['frieren'], 'Kaiju No. 8': ['kaiju'], "Hell's Paradise": ['hells paradise', 'jigokuraku'], 'Dorohedoro': ['dorohedoro'],
  'Re:Zero': ['re:zero', 'rezero'], 'Solo Leveling': ['solo leveling'], 'Fire Force': ['fire force'], 'Gintama': ['gintama'],
  'Yu Yu Hakusho': ['yu yu hakusho', 'yuuyuu'], 'Fairy Tail': ['fairy tail'], "JoJo's Bizarre Adventure": ['jojo'],
  'Seven Deadly Sins': ['seven deadly sins', 'nanatsu'], 'Soul Eater': ['soul eater'], 'Dr. Stone': ['dr stone', 'dr.stone'],
  'Noragami': ['noragami'], 'Dandadan': ['dandadan'], 'Boruto': ['boruto'], 'Inuyasha': ['inuyasha'], 'Akame ga Kill': ['akame ga kill'],
}
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const matches = (titles, aliases) => {
  for (const t of titles) {
    const tw = norm(t).split(' ')
    for (const a of aliases) {
      const aw = norm(a).split(' ')
      if (aw.every((w) => tw.includes(w))) return true
    }
  }
  return false
}
const q = `query($ids:[Int]){Page(page:1,perPage:50){characters(id_in:$ids){id name{full} media(perPage:10){edges{node{title{romaji english}}}}}}}`
const ids = d.characters.map((c) => c.id)
const mediaMap = {}
for (let i = 0; i < ids.length; i += 50) {
  const batch = ids.slice(i, i + 50)
  let ok = false
  for (let a = 0; a < 5 && !ok; a++) {
    const r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: { ids: batch } }) })
    if (r.status === 429) { await new Promise((x) => setTimeout(x, 3000)); continue }
    const j = await r.json()
    for (const c of j.data?.Page?.characters || []) mediaMap[c.id] = (c.media?.edges || []).flatMap((e) => [e.node.title?.romaji, e.node.title?.english].filter(Boolean))
    ok = true
  }
  await new Promise((x) => setTimeout(x, 600))
}
const suspects = []
for (const c of d.characters) {
  const titles = mediaMap[c.id] || []
  if (!matches(titles, ALIASES[c.anime])) {
    suspects.push({ name: c.name, anime: c.anime, firstTitles: titles.slice(0, 3) })
  }
}
console.log('SUSPECTS (' + suspects.length + '):')
for (const s of suspects) console.log(' -', s.name, '[' + s.anime + '] ->', s.firstTitles.join(' / '))