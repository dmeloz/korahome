#!/bin/bash
# Sert KoraHome en https depuis ce Mac, pour l'installer sur les iPhones du foyer.
#
#   npm run serveur        récupère la dernière version, construit et sert l'app
#   npm run serveur -- --sans-maj   sert sans faire de git pull
#
# Au premier lancement, crée une autorité de certification locale propre à ce Mac
# et le profil à installer une fois sur chaque iPhone (voir docs/installer-sur-iphone.md).
# Les clés restent dans .certificats/, ignoré par Git.
set -euo pipefail

cd "$(dirname "$0")/.."
DOSSIER=".certificats"
PORT="${KORAHOME_PORT:-4443}"
mkdir -p "$DOSSIER"
chmod 700 "$DOSSIER"

# Nom et adresse du Mac sur le réseau local.
if command -v scutil >/dev/null 2>&1; then
  HOTE="$(scutil --get LocalHostName).local"
else
  HOTE="$(hostname -s).local"
fi
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

# 1. Autorité de certification locale (une seule fois, valable 10 ans).
if [ ! -f "$DOSSIER/ca.key" ]; then
  echo "Création de l'autorité de certification locale de ce Mac…"
  openssl genrsa -out "$DOSSIER/ca.key" 2048 2>/dev/null
  chmod 600 "$DOSSIER/ca.key"
  openssl req -x509 -new -key "$DOSSIER/ca.key" -sha256 -days 3650 \
    -subj "/CN=KoraHome - certificat local de $HOTE/O=KoraHome" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -out "$DOSSIER/ca.crt"
fi

# 2. Certificat du serveur, refait si le nom ou l'adresse du Mac ont changé.
#    825 jours au plus : c'est la limite acceptée par iOS.
SAN="DNS:$HOTE,DNS:localhost,IP:127.0.0.1"
[ -n "$IP" ] && SAN="$SAN,IP:$IP"
if [ ! -f "$DOSSIER/serveur.crt" ] || [ "$(cat "$DOSSIER/san.txt" 2>/dev/null)" != "$SAN" ]; then
  echo "Création du certificat du serveur pour $HOTE ${IP:+($IP)}…"
  openssl genrsa -out "$DOSSIER/serveur.key" 2048 2>/dev/null
  chmod 600 "$DOSSIER/serveur.key"
  openssl req -new -key "$DOSSIER/serveur.key" -subj "/CN=$HOTE" -out "$DOSSIER/serveur.csr"
  printf "subjectAltName=%s\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\n" "$SAN" > "$DOSSIER/serveur.ext"
  openssl x509 -req -in "$DOSSIER/serveur.csr" -CA "$DOSSIER/ca.crt" -CAkey "$DOSSIER/ca.key" \
    -CAserial "$DOSSIER/ca.srl" -CAcreateserial -days 825 -sha256 -extfile "$DOSSIER/serveur.ext" -out "$DOSSIER/serveur.crt" 2>/dev/null
  echo "$SAN" > "$DOSSIER/san.txt"
fi

# 3. Profil iPhone qui contient uniquement le certificat public de l'autorité.
PROFIL="$DOSSIER/KoraHome-certificat.mobileconfig"
if [ ! -f "$PROFIL" ] || [ "$DOSSIER/ca.crt" -nt "$PROFIL" ]; then
  CERT_B64="$(openssl x509 -in "$DOSSIER/ca.crt" -outform der | base64 | tr -d '\n')"
  UUID1="$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)"
  UUID2="$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)"
  cat > "$PROFIL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadCertificateFileName</key><string>KoraHome.cer</string>
      <key>PayloadContent</key><data>$CERT_B64</data>
      <key>PayloadDisplayName</key><string>Certificat local KoraHome</string>
      <key>PayloadIdentifier</key><string>fr.korahome.certificat.$UUID1</string>
      <key>PayloadType</key><string>com.apple.security.root</string>
      <key>PayloadUUID</key><string>$UUID1</string>
      <key>PayloadVersion</key><integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key><string>Permet à cet iPhone d'ouvrir KoraHome servi par le Mac de la maison.</string>
  <key>PayloadDisplayName</key><string>KoraHome (Mac de la maison)</string>
  <key>PayloadIdentifier</key><string>fr.korahome.profil.$UUID2</string>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>$UUID2</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
PLIST
fi

# 4. Dernière version, dépendances, build.
if [ "${1:-}" != "--sans-maj" ] && [ -d .git ]; then
  git pull --ff-only || echo "Attention : git pull impossible, je sers la version locale."
fi
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  npm ci
fi
npm run build

echo
echo "KoraHome est servi sur :"
echo "  https://$HOTE:$PORT"
[ -n "$IP" ] && echo "  https://$IP:$PORT"
echo "Profil à installer une fois sur chaque iPhone : $(pwd)/$PROFIL"
echo "Arrêt : Ctrl+C. Pour mettre à jour, relancer npm run serveur."
echo

KORAHOME_HTTPS="$DOSSIER" exec npx vite preview --host 0.0.0.0 --port "$PORT" --strictPort
