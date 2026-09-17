# EBYTDA V22 — DATA PROXY FIXED

Correctif données LIVE pour Netlify.

## Ce qui change
- Un seul dossier serveur : `functions/`
- `netlify.toml` force Netlify à déployer ce dossier
- CoinGecko passe maintenant par `/.netlify/functions/coingecko`
- Twelve Data passe par `/.netlify/functions/twelve`
- Aucune clé API n'est exposée dans `app.js`
- Top 200 mature, MTF, paper AutoPilot et comptabilité conservés

## Variables Netlify
Dans **Site configuration > Environment variables** :
- Twelve Data : `TWELVE_DATA_API_KEY`
- CoinGecko Demo : `COINGECKO_DEMO_API_KEY`
- OU CoinGecko payant : `COINGECKO_PRO_API_KEY`

Ne mettez jamais les clés dans GitHub ou `app.js`.

## Déploiement
À la racine du dépôt, remplacer :
- `index.html`
- `styles.css`
- `app.js`
- `assets/`
- `functions/`
- `netlify.toml`

Le vieux dossier `netlify/functions/` peut être supprimé pour éviter toute confusion.
