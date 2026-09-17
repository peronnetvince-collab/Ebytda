# EBYTDA V18 — Clean Engine

Version reconstruite à partir de la V17, sans OR/PAXG et avec un moteur JavaScript nettoyé.

## Correctifs majeurs
- Nouveau namespace localStorage V18 : aucune ancienne position corrompue n’est importée.
- Capital initial : 3 000 USDT.
- 100 USDT par position, sans levier.
- 3 positions minimum si des candidats LIVE valides existent, 15 maximum.
- Scan complet des 300 plus grosses capitalisations toutes les 15 minutes.
- Valorisation des positions toutes les 15 secondes.
- AutoPilot suspendu automatiquement lorsque les données CoinGecko LIVE sont indisponibles.
- Mode fallback visuel pour éviter un dashboard figé.
- LONG + SHORT, TECH / QUANT / Fondamental / Régime / FOMO / IA.
- Listing Top 300, Top 3, Top 10, graphique, ordres manuels et historique.
- P&L cohérent : capital réalisé = 3 000 + P&L net clôturé ; capital disponible = capital réalisé - 100 × positions ouvertes ; equity = capital réalisé + P&L latent.
- USDT pour tous les calculs. EUR = affichage uniquement. Aucun OR.

## Connexion
- Login : admin@ebytda.local
- Code : EBYTDA-ADMIN-2026

## Déploiement
Remplacer :
- index.html
- styles.css
- app.js
- assets/

Puis forcer une actualisation navigateur une fois (Ctrl+F5).

## Important
Simulation / paper-trading uniquement. Aucun ordre réel n’est envoyé à un broker.
