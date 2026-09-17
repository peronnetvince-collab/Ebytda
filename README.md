# EBYTDA Crypto IA V6 — SwingDay AutoPilot 300

Cette version corrige le comportement de sur-trading de la V5.

## Principales corrections
- les **positions ouvertes persistent** entre les scans et les rechargements ; elles ne sont plus remises à zéro toutes les 15 minutes ;
- le scan 15 min sert à **réévaluer** le marché et les positions, pas à recréer le portefeuille ;
- univers = **300 plus grosses capitalisations** CoinGecko (2 pages, tri market cap desc), avec stablecoins affichés mais exclus des signaux directionnels ;
- scoring désormais **LONG et SHORT** : le moteur compare deux scénarios directionnels et retient le meilleur consensus ;
- Top 3 = 3 meilleurs consensus directionnels sur 300 ;
- jusqu’à **10 positions simultanées**, 100 USDC de marge par position ;
- levier virtuel 1×–5× selon IA, Risk, volatilité et liquidité ;
- stop basé sur un **proxy de volatilité**, volontairement plus large que la V5 pour laisser un delta de respiration ;
- TP1 = sécurisation 50 %, TP2 = clôture automatique ;
- TP2 peut fermer une belle opération rapidement, même en quelques minutes ;
- sortie IA anticipée beaucoup moins agressive : délai minimum + invalidation réellement forte ;
- horizons privilégiés de 6 h à plusieurs jours, avec **prolongation dynamique** de 15 min, 1 h, 2 h, 6 h ou 12 h lorsque le consensus reste favorable ;
- durée absolue maximale : **5 jours** ;
- cooldown de **6 h** avant réentrée automatique sur un actif clôturé ;
- P&L permanent et cumulatif : **réalisé + latent**, capital total, capital libre, marge engagée ;
- historique protégé et porté à 1 500 positions clôturées / 1 200 décisions de scan.

## Persistance importante
Les clés localStorage V5 sont volontairement conservées pour ne pas perdre les positions et l’historique existants lors du déploiement de la V6. Les positions V5 encore ouvertes sont migrées automatiquement vers la stratégie V6.

## Connexion
- Login : `admin@ebytda.local`
- Code : `EBYTDA-ADMIN-2026`

## Déploiement GitHub / Netlify
Remplacer :
- `index.html`
- `styles.css`
- `app.js`
- `assets/` (inchangé visuellement)

## Important
Cette version reste un moteur de **paper-trading** côté navigateur. Aucun ordre réel n’est envoyé à un broker. Pour du 24/7 navigateur fermé ou de l’exécution réelle, le moteur doit être déplacé côté serveur avec authentification et API broker sécurisées.
