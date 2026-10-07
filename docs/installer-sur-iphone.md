# Installer KoraHome sur un iPhone (servi par le Mac)

## Sur le Mac
Dans le dossier du projet :

```sh
npm run serveur
```

Le script récupère la dernière version, construit l'app et la sert en https sur le wifi de la maison. Il affiche l'adresse (par exemple `https://MacBook-Air.local:4443`) et le chemin du profil à installer. Le Mac doit rester allumé et sur le même wifi que les iPhones.

**Mettre à jour** : arrêter le serveur (Ctrl+C) et relancer `npm run serveur`. Dans l'app, le bandeau « Nouvelle version prête » apparaît : toucher « Mettre à jour ». On peut aussi aller dans Réglages > Vérifier les mises à jour. La version installée s'affiche dans les Réglages (par exemple « Kora 0.0.1 »).

## Une seule fois par iPhone : le profil
1. Envoyer `.certificats/KoraHome-certificat.mobileconfig` du Mac vers l'iPhone par AirDrop.
2. Sur l'iPhone : Réglages, « Profil téléchargé », Installer.
3. Puis Réglages, Général, Informations, Réglages des certificats : activer « KoraHome - certificat local ».

Le profil ne contient que le certificat public de ce Mac. Il permet à l'iPhone de faire confiance au serveur KoraHome de la maison, et à rien d'autre. Pour le retirer : Réglages, Général, VPN et gestion de l'appareil.

## Installer l'app
1. Ouvrir l'adresse affichée par le Mac dans **Safari**.
2. Partager, « Sur l'écran d'accueil ».

L'app s'ouvre ensuite en plein écran et fonctionne même quand le Mac est éteint. Les données restent sur chaque iPhone tant que la synchro n'est pas en place.
