# EBYTDA — Crypto IA V1

Dashboard front-end autonome (HTML / CSS / JavaScript), prêt à déposer sur GitHub Pages ou Netlify.

## Fonctions incluses

- Interface sombre premium, responsive desktop/mobile
- Français par défaut + bouton FR / EN
- EUR par défaut + bouton EUR / USD
- Top 100 cryptos via CoinGecko
- Fallback automatique en données de démonstration si l'API est indisponible
- 4 scores : Technique, Fondamental, Régime, FOMO
- Score IA global à deux décimales
- Top 3 FOMO
- Statuts : ORDRE CONSEILLÉ / PRÉ-ORDRE / À SURVEILLER / NEUTRE
- Choix IA #1 parmi les 100
- Zone d'entrée, invalidation, TP1, TP2 et scénarios de gain
- Top 10 Quantum Algorithm
- Synchronisation automatique toutes les heures
- Passage automatique en mode FOCUS toutes les 30 minutes lorsque la volatilité moyenne augmente
- Pause nocturne 01:00–08:00 pour le scan automatique
- Historique local des choix IA
- Bouton d'actualisation manuelle
- Liens Bitget / XTB / eToro
- Aucun ordre envoyé automatiquement

## Installation

Ouvrir simplement `index.html`, ou publier le dossier entier sur Netlify / GitHub Pages.

Pour GitHub Pages :
1. Créer un dépôt.
2. Envoyer `index.html`, `styles.css`, `app.js`.
3. Activer Pages sur la branche principale.

## Important pour une vraie V2

Le score "fondamental" de cette V1 utilise des proxys disponibles depuis les données de marché (capitalisation, liquidité, drawdown historique). Pour un moteur fondamental profond, brancher ensuite :
- tokenomics / unlocks,
- activité développeurs,
- données on-chain,
- news / catalyseurs,
- sentiment,
- historique réel des signaux et backtests.

Le calcul actuel est volontairement explicable et non aléatoire.

Les scénarios de gain affichés ne constituent pas des promesses de performance.
