# L'Imposteur Anime

Deux jeux multijoueurs en ligne sur personnages d'anime.

## 🕵️ L'Imposteur

Un joueur (ou plus) a un personnage d'un anime, les autres ont un personnage d'un autre anime (ou du même), mais proche en apparence/caractéristiques. Chacun donne des indices, puis on vote pour démasquer l'imposteur. Deux variantes : personnages tirés automatiquement, ou l'hôte choisit lui-même les deux personnages (il devient arbitre et ne joue pas).

## 💰 Enchères

Chaque joueur a 20€. Le créateur choisit **une anime** parmi Dragon Ball Z, JoJo, One Piece et Naruto (les rosters y sont étoffés). Un personnage est proposé, on enchérit **au tour par tour** : à ton tour, tu mises le montant que tu veux ou tu passes (obligatoire de miser 1€ au minimum pour lancer). Si tu n'as pas assez pour surenchérir, tu ne peux que passer. La partie s'arrête quand tout le monde a 4 combattants ou n'a plus d'argent. Puis on débat, on vote (y compris pour sa propre équipe), et la meilleure équipe de combat gagne.

## Lancer

```bash
npm install
npm start        # ou : node server.js
```

Le serveur affiche les URLs (locale + réseau). Le port se règle avec `PORT=8080 npm start`.

## Nix

Avec Nix (flakes) :

```bash
nix develop            # shell de dev (Node.js + npm)
nix build .            # construit le package (binaire `imposteur-anime`)
nix run .              # lance le serveur
```

Au premier `nix build`, remplace `npmDepsHash` dans `flake.nix` par le hash affiché dans l'erreur, puis génère `flake.lock` avec `nix flake lock`.

## Reconstruire le dataset

Les personnages, leurs traits et leur force (`power`) sont dans `data/characters.json` (généré via l'API AniList). Pour régénérer :

```bash
npm run build-data
node scripts/expand-roster.mjs   # ajoute les persos manquants + power
```

## Tests

```bash
npm install        # installe aussi les deps de test (socket.io-client, puppeteer-core)
npm run test       # suites backend (nécessite un serveur lancé, voir ci-dessous)
npm run test:e2e   # E2E navigateur (nécessite google-chrome-stable)
```

Les suites backend se connectent à `http://localhost:3000` (ou `TEST_URL=http://localhost:3100`). Lancer d'abord :

```bash
PORT=3100 node server.js &
TEST_URL=http://localhost:3100 npm run test
```

```bash
node test-game.mjs              # flux imposteur complet
node test-extended.mjs          # modes et cas limites imposteur
node test-replay.mjs            # rejouer + nombre de tours
node test-hostmode.mjs          # mode hôte arbitre
node test-encheres.mjs          # mode enchères (tour par tour)
node test-fixes.mjs             # régressions sécurité/robustesse
node test-browser.mjs           # E2E navigateur imposteur
node test-browser-encheres.mjs  # E2E navigateur enchères
```

## Sécurité

- Les clés API (Porkbun) vivent uniquement dans `.env`, jamais commité (`.gitignore` + filtre de source Nix qui l'exclut du store).
- Si une clé a été exposée un jour (capture d'écran, partage…), la révoquer/régénérer depuis le dashboard Porkbun.