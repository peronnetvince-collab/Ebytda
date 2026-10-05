# EBYTDA V33 — Règles convenues, simulation

Extraire tout le ZIP et remplacer les fichiers du dépôt GitHub à sa racine. Conserver les variables Netlify. Fermer les anciens onglets et actualiser après le déploiement. Identifiants inchangés : admin@ebytda.local / EBYTDA-ADMIN-2026. Verrou navigateur de démonstration.

## Règles actives
Cinq positions maximum, sans minimum forcé. Long et short simulés. Mise normale 100 USDT. Une position Banger automatique de 200 USDT par jour Paris seulement : consensus renforcé, ouverture enregistrée dans les positions puis l'historique, jamais doublement d'une perte. Si aucun signal suffisant, aucune obligation d'utiliser le Banger. Le plafond ne supprime pas les positions historiques au chargement.

Enveloppe quotidienne fixe de référence 500 USDT, portée à 600 USDT si un Banger est ouvert ce jour. Réutiliser une mise ne multiplie pas le dénominateur. Objectifs 5 / 7 / 10 %, non garantis. P&L réalisé net et frais estimés ; gains latents séparés. Pause des nouvelles entrées à -3 % réalisé de cette enveloppe. La V32 utilisait le capital du wallet : V33 corrige cela.

Sortie prioritaire à +15 USDT nets par position, y compris Banger. Sur 200 USDT cela correspond à 7,5 %, donc cette règle peut empêcher d'atteindre 10 %. Protection basée sur la volatilité, trailing après gains, prise de gain si essoufflement, retournement confirmé sur deux scans distincts. Une perte en dollars seule ne suffit pas. Après 24 h, maintien jusqu'à 48 h seulement si consensus frais et favorable. Stop de protection reste prioritaire même avec une thèse positive. Prix périmés suspendent les clôtures automatiques : simulation uniquement, sans protection broker.

## Macro et actualités
Fonction macro-news et panneau de collecte des flux publics officiels Fed et BCE, requête navigateur toutes les 60 secondes. Publication et première détection affichées ; pas de garantie de latence du flux éditeur. Sources indisponibles identifiées. Aucun ordre fondé sur une interprétation de ces titres. Pas d'IA externe connectée. Scores directionnels existants utilisent notamment BTC/ETH et régime crypto ; ils restent heuristiques.

Couverture mondiale (bourses, pétrole, gaz, or, monnaies, géopolitique, réseaux sociaux) NON connectée. Corrélations historiques et mémoire des événements sur plusieurs années NON constituées. Aucun avantage prédictif démontré. Ces besoins nécessitent des fournisseurs de données, historique, backend persistant et validation hors échantillon ; ils ne sont pas présentés comme terminés.

## Exécution et vérification
Aucun ordre réel. Fonctions live et auto broker restent bloquées. Aucune surveillance permanente lorsque navigateur fermé. Aucun déploiement réalisé par cette livraison. 16 tests unitaires, démarrage jsdom, test RSS horodatage réussis ; pas de backtest de performance ni essai broker. Frais estimés avec l'ancien taux, sans slippage, spread ou financement : ce ne sont pas les coûts d'une exécution réelle. Les anciennes notices archivées peuvent concerner V31 : cette notice V33 prévaut.
