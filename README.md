# EBYTDA V15 — ENGINE FIXED

Correction majeure : la fonction centrale `scan()` avait disparu dans V14, ce qui figeait le dashboard après connexion.

V15 restaure :
- scan Top 300 toutes les 15 minutes
- moteur TECH / QUANT / FONDAMENTAL / REGIME / FOMO / IA
- Top 3 LONG / SHORT
- AutoPilot 3 à 15 positions, 100 USDT sans levier
- positions live et P&L
- passage d’ordre manuel
- listing Top 300
- graphiques
- traduction FR / EN des éléments principaux
- actualisation manuelle
- timeout + retry CoinGecko
- mode DEMO explicite sans ouverture AutoPilot si l’API LIVE est indisponible
- cache bust `?v=15.2` pour forcer le navigateur/Netlify à charger le nouveau JS/CSS

Connexion : admin@ebytda.local / EBYTDA-ADMIN-2026
