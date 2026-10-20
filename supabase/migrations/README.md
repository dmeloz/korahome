# Historique du schéma

`../schema.sql` reste la référence complète : c'est lui qu'on colle pour monter un serveur neuf
(voir `docs/activer-le-partage.md`).

`20261020000000_base.sql` est la copie de `schema.sql` au 20 octobre 2026 : le point de départ.

À partir de là, chaque changement du schéma du serveur se fait à deux endroits :

1. dans `schema.sql`, pour qu'il reste complet ;
2. dans un nouveau fichier daté de ce dossier, `AAAAMMJJHHMMSS_nom.sql`, qui contient seulement
   le changement (et peut être relancé sans risque).

Le fichier s'applique au serveur du foyer avec l'éditeur SQL de Supabase (« SQL Editor »), ou par
`apply_migration` du MCP Supabase en lui donnant le même nom.
