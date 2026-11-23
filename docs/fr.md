# SENEC.Home

Suivez et pilotez votre batterie **SENEC.Home** et votre **SENEC.Wallbox**
dans Gladys : niveau de batterie, production solaire, consommation de la
maison, échanges avec le réseau, état du système, charge de sécurité et mode
de charge de la wallbox. Tout passe **directement par votre réseau local**,
via la même API que l'interface web du système (`lala.cgi`) : pas de compte
mein-senec.de, pas de cloud, et les valeurs continuent d'arriver quand
Internet est coupé.

## Systèmes compatibles

- **SENEC.Home V3 hybrid / hybrid duo** (dont les versions LFP) ;
- **SENEC.Home V2.1** et les SENEC.Home V2 récents ;
- les **SENEC.Wallbox** déclarées sur ces systèmes (jusqu'à 4).

Les **SENEC.Home 4 / P4** n'ont pas d'API locale : ils ne sont pas pris en
charge par cette intégration.

## Prérequis

1. Le système doit être joignable depuis Gladys sur le réseau local : ouvrez
   `https://<adresse-du-senec>/` dans un navigateur, la page web du SENEC doit
   s'afficher (le navigateur avertit d'un certificat auto-signé : c'est
   normal).
2. Donnez au système une **adresse IP fixe** (une réservation DHCP dans votre
   box suffit).

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Dans **Adresse du SENEC.Home**, saisissez son adresse IP, par exemple
   `192.168.1.40`. Plusieurs systèmes : séparez-les par des virgules.
3. **Protocole** : laissez **HTTPS** (firmwares actuels). Choisissez HTTP
   seulement pour un ancien firmware qui ne répond pas en HTTPS.
4. **Intervalle de rafraîchissement** : fréquence de lecture, 30 secondes par
   défaut (10 secondes minimum).
5. **Seuil de surplus solaire** : la puissance injectée dans le réseau (en W,
   500 par défaut) à partir de laquelle le déclencheur « Début de surplus
   solaire » se déclenche.
6. Enregistrez, puis cliquez sur **Tester la connexion** : les systèmes qui
   ont répondu s'affichent, avec leur modèle et leurs wallbox, ou la raison de
   l'échec.
7. Ouvrez l'onglet **Découverte** et ajoutez le SENEC.Home et ses wallbox.

## Ce que vous obtenez

**Un appareil SENEC.Home**, nommé d'après son modèle et son numéro de série :

| Fonctionnalité                                            | Type                      |
| --------------------------------------------------------- | ------------------------- |
| Niveau de batterie (%)                                    | stockage batterie         |
| Puissance de charge / de décharge de la batterie (W)      | stockage batterie         |
| Production solaire (W)                                    | production d'énergie      |
| Consommation de la maison (W)                             | consommation de la maison |
| Puissance soutirée / injectée sur le réseau (W)           | réseau                    |
| Index d'énergie (kWh) : solaire, maison, réseau, batterie | selon le firmware \*      |
| Température batterie et boîtier (°C)                      | sonde                     |
| État du système (texte SENEC, ex. `CHARGE`)               | texte                     |
| **Charge de sécurité** (interrupteur)                     | pilotable                 |

\* Les firmwares récents (image NPU 2408 et suivantes) ne publient plus les
compteurs d'énergie : ces fonctionnalités n'apparaissent alors pas.

**Un appareil par SENEC.Wallbox** : puissance de charge (W), véhicule branché,
état de la wallbox, et **mode de charge** pilotable (Rapide, Optimisé solaire,
Verrouillé).

La **charge de sécurité** charge la batterie depuis le réseau jusqu'à 100 %,
puis la maintient : utile avant une coupure annoncée ou pendant les heures
creuses. Arrêtez-la pour revenir au fonctionnement normal.

Chaque appareil affiche un badge **local / injoignable**.

## Scènes

Déclencheurs :

- **Batterie SENEC pleine** / **Batterie SENEC vide** ;
- **Changement de mode du SENEC** : en charge, en décharge, batterie pleine,
  batterie vide, en veille, charge de sécurité, maintenance, erreur,
  injoignable… filtrable par nouveau mode ; les variables `mode`,
  `previous_mode` et `state_name` (état SENEC brut) sont disponibles ;
- **Début de surplus solaire** / **Fin de surplus solaire**, avec la puissance
  injectée (`export_power`) ;
- **Véhicule branché / débranché** sur une SENEC.Wallbox.

Actions :

- **Lire un SENEC.Home** : lit tout de suite les valeurs et les rend
  disponibles aux actions suivantes (niveau de batterie, production,
  consommation, réseau, mode…) ;
- **Charge de sécurité SENEC** : lancer ou arrêter ;
- **Mode de charge SENEC.Wallbox** : Rapide, Optimisé solaire ou Verrouillé.

Pour un seuil sur une valeur (batterie au-dessus de 80 %…), utilisez le
déclencheur standard **Changement d'état d'un appareil** de Gladys.

## Widgets du tableau de bord

- **SENEC.Home** : production, maison, réseau, batterie, jauge de niveau,
  courbe de la journée, mode de fonctionnement et bouton de charge de
  sécurité ;
- **SENEC.Wallbox** : puissance de charge, véhicule, mode, et un bouton par
  mode de charge.

## Dépannage

- **« … does not answer »** : vérifiez l'adresse IP et que la page web du
  SENEC s'ouvre depuis le réseau de Gladys ; essayez l'autre protocole.
- **« … without a SENEC serial number »** : l'adresse répond, mais ce n'est
  pas un SENEC.Home compatible (ou c'est un SENEC.Home 4).
- **Valeurs figées** : le système n'accepte qu'un nombre limité de requêtes ;
  n'utilisez pas un intervalle de rafraîchissement trop court si d'autres
  outils l'interrogent aussi.
- Les logs de l'intégration (page Supervision de Gladys) donnent le détail de
  chaque erreur.

## Confidentialité et sécurité

L'intégration ne parle qu'à votre SENEC.Home, sur votre réseau local. Elle ne
stocke rien de secret. Le certificat auto-signé du système n'est pas vérifié :
ne l'exposez jamais sur Internet.
