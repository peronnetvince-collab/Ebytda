# EBYTDA Crypto IA V21 — AUTO EXEC

Version axée sur le passage automatique des ordres papier.

- Univers : 200 cryptos matures (2 ans+)
- Multi-timeframe : 1 h, 24 h, 7 j, 14 j, 30 j, 200 j, 1 an
- CoinGecko : source principale LIVE
- Twelve Data : contrôle secondaire via Netlify Function
- 100 USDT par position, sans levier
- 3 positions de base visées si des candidats LIVE valides existent
- jusqu’à 15 positions simultanées
- jusqu’à 5 nouvelles ouvertures par scan
- activation AutoPilot => recherche immédiate, sans attendre 15 min
- scan complet toutes les 15 min
- mark-to-market des positions toutes les 15 secondes
- aucun stop-loss fixe / aucun take-profit fixe
- clôture dynamique selon consensus IA, momentum, MTF, continuation et horizon
- journal des ouvertures automatiques

IMPORTANT : les ordres de cette version sont des ordres de paper-trading/simulation. Aucun ordre réel n’est envoyé à Bitget, XTB, eToro ou un autre broker. Pour du trading réel, il faut une intégration backend sécurisée aux API officielles du broker.

Pour Twelve Data, définir TWELVE_DATA_API_KEY dans les variables d’environnement Netlify. Ne jamais exposer la clé dans app.js.
