# EBYTDA V31.2 — TradingView + passerelle d'ordres Spot Kraken OPTIONNELLE

Base préservée : **EBYTDA V30 FORCE CORE → V31 → V31.1**. Cette archive ajoute un module optionnel V31.2 ; elle **n'active pas le trading réel à l'installation**.

## Fonctionnalités

- Historique V30 inchangé : Dashboard, Top 200, AutoPilot **papier**, Positions, Historique, langues et devise d'affichage.
- V31.1 inchangée : graphique TradingView intégré, ouverture externe, choix de la place de cotation (y compris Bitget), scan EBYTDA, ticket et journal **papier**.
- V31.2 ajoutée : **deuxième ticket indépendant** de Kraken Spot LIMIT en EUR/USDC, vérification du cours et du solde par API **serveur** (`AssetPairs`, `Ticker`, `BalanceEx`), validation `AddOrder` (`validate=true`) à l'étape aperçu, ordre effectif `AddOrder` UNIQUEMENT après confirmation explicite et nouvelle saisie de la phrase secrète.
- Ordres DAY et WEEK : date d'expiration de l'**ordre LIMIT non exécuté** à 24 h / 7 jours. Cela ne ferme PAS une position acquise à l'échéance.
- Garde-fous V31.2 : plafond 50 EUR/USDC par ordre (ou moins via configuration), 5 % max du solde disponible en devise d'achat / actif vendu, BUY/SELL au comptant uniquement, prix LIMIT à +/-2,5 % du cours Kraken, taille minimale et décimales vérifiées, mot de passe par opération, aperçu signé 45 s, anti-doublon via écriture conditionnelle Netlify Blobs, registre serveur qui bloque toute répétition d'un ticket dont le résultat est incertain. AUCUN retrait, levier, short, marge, futures, stop ou take-profit automatiques.
- Le bouton et l'endpoint V31 historiques d'exécution réelle continuent de renvoyer 403 ; AutoPilot réel reste **inactif**.

## POUR TESTER TOUT DE SUITE

Ouvrir `index.html` dans un navigateur, ou l'aperçu HTML autonome fourni à côté de cette archive. Le Trading Desk et TradingView restent accessibles ; le ticket réel V31.2 affiche **VERROUILLÉ** sans Netlify Functions et secrets configurés. Le ticket papier reste disponible.

## DÉPLOIEMENT NETLIFY (GITHUB RECOMMANDÉ)

1. Décompresser le ZIP dans la racine du dépôt GitHub. Garder la structure `public/`, `functions/`, `package.json` et `netlify.toml`. `public/` est le dossier public déployé ; **aucun secret** dans les fichiers du dépôt.
2. Relier le dépôt à Netlify. Le build `npm install --omit=dev` et le déploiement du dossier `public` sont configurés dans `netlify.toml`. L'API utilise les fonctions Netlify sous `/.netlify/functions/`.
3. Sans configuration additionnelle, **TOUT RESTE BLOQUÉ CÔTÉ RÉEL**. Vous pouvez tester la démo papier de manière identique à la V31.1.

## ACTIVER LE CONNECTEUR KRAKEN MANUEL (POUR UN COMPTE ÉLIGIBLE, À VOTRE INITIATIVE)

Ne transmettez PAS les clés API, le mot de passe d'ordre ni la seed dans cette conversation ni dans GitHub.

1. Vérifier que le compte Kraken est personnel, vérifié et habilité à trader les paires Spot choisies. Pour une résidence EEE, **USDT est délisté** : la V31.2 utilise exclusivement `EUR` ou `USDC`. Les actifs eux-mêmes peuvent être restreints selon le compte.
2. Sur Kraken, créer une nouvelle paire de clés API dédiée au Spot, avec **consultation des fonds et création d'ordres**, idéalement consultation des ordres. **AUCUNE PERMISSION DE RETRAIT**, dépôt ou transfert. Activer les restrictions IP si une sortie IP stable existe. Le nom des permissions Kraken peut évoluer.
3. Générer localement une phrase secrète aléatoire de 20+ caractères et son hash scrypt, par exemple (sur votre PC avec Node.js ; ne pas conserver la phrase en clair dans Git) :

   ```sh
   node -e "const c=require('node:crypto');const s=c.randomBytes(16);const p=c.randomBytes(24).toString('base64url');console.log('Phrase à conserver dans un gestionnaire:',p);console.log('Hash à mettre dans Netlify:',s.toString('hex')+':'+c.scryptSync(p,s,64).toString('hex'));console.log('Clé HMAC à mettre dans Netlify:',c.randomBytes(32).toString('hex'))"
   ```

4. Dans **Netlify → Project configuration → Environment variables**, enregistrer séparément :

   | Variable | Valeur |
   | --- | --- |
   | `EBYTDA_ENABLE_MANUAL_KRAKEN` | `true` (mettre `false` pour couper immédiatement les NOUVEAUX ordres EBYTDA) |
   | `KRAKEN_SPOT_API_KEY` | clé API personnelle Kraken, **serveur seulement** |
   | `KRAKEN_SPOT_API_SECRET` | secret API personnel Kraken, **serveur seulement** |
   | `EBYTDA_ORDER_PASSPHRASE_SCRYPT` | hash `sel:hash` généré ci-dessus |
   | `EBYTDA_PREVIEW_HMAC_SECRET` | clé HMAC aléatoire générée ci-dessus |
   | `EBYTDA_LIVE_MAX_QUOTE` | montant maximum par ordre EUR/USDC, ex. `20` ; jamais supérieur à 50 |

5. Redéployer le site afin que les functions chargent les variables. Onglet Trading Desk → Kraken manuel → paire EUR/USDC et prix limite **dans cette devise** → entrer phrase secrète → Prévisualiser → relire → cocher l'accord → ressaisir la phrase secrète → confirmer dans la boîte de dialogue. Le signal et la cotation USDT du V30 ne sont **jamais réutilisés** pour le prix d'ordre Kraken EUR.

**Le déploiement de ce code et les tests mock ne prouvent pas l'acceptation d'une vraie paire par le compte ni une exécution réelle.** La validation et les fonds ne peuvent être vérifiés qu'avec les clés correctes sur le serveur et le compte du titulaire ; commencer par la prévisualisation sans ordre puis un très petit ordre LIMIT manuel si vous choisissez d'activer le réel.

## LIMITES IMPORTANTES

- Les quotes et les frais du moteur papier V30/V31 restent des estimations USDT, indépendantes de Kraken. Le ticket Kraken ne donne pas de devis ferme de frais : Kraken prélèvera les frais réels selon le compte/produit.
- `SUBMITTED_UNRECONCILED` signifie que Kraken a ACCEPTÉ l'envoi ; l'ordre peut rester ouvert, partiellement rempli, annulé, expiré ou rempli. Le module n'implémente PAS d'interface complète de suivi des fills, d'annulation, de journaux réels ou de protection stop/TP. Vérifier le portefeuille et les ordres directement chez Kraken.
- Si l'appel à Kraken expire ou échoue APRÈS tentative d'envoi, `ORDER_RESULT_UNCERTAIN` interdit toute répétition du même ticket. Vérifier Kraken AVANT une nouvelle prévisualisation.
- La fermeture automatique d'une position et l'AutoPilot réel **ne sont pas implémentés**. **NE PAS laisser ce projet prendre des décisions autonomes sur un capital significatif.**
- La connexion historique V30 du dashboard reste une authentification **front-end de démonstration**. La passerelle d'ordre réelle a sa propre phrase secrète forte vérifiée côté serveur et ne réutilise jamais ce mot de passe front-end. Avant d'en faire un service multi-utilisateur, remplacer la connexion du portail et réaliser un audit de sécurité, une authentification et journalisation nominatives, ainsi qu'un examen de conformité.
- Bitget : ne pas utiliser le connecteur d'ordres Bitget pour un compte de résident français, Bitget ayant suspendu ses services en France depuis mars 2026. Le choix Bitget dans TradingView reste un simple graphique ; aucun ordre Bitget n'est envoyé.

## TESTS

`node --test tests/*.test.js`

Les tests de la passerelle réelle sont exécutés sur un **FAUX BROKER** (réponses simulées), jamais avec un compte ni des clés réels. Ils valident la signature, le statut désactivé par défaut, l'origine, les seuils, le besoin de confirmation et l'anti-doublon.
