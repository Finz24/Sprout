#!/bin/sh
set -eu
# Official Docker Compose v2.39.4 Linux x86_64 release asset.
artifact="$(mktemp)"
trap 'rm -f "$artifact"' EXIT
curl --fail --silent --show-error --location \
  https://github.com/docker/compose/releases/download/v2.39.4/docker-compose-linux-x86_64 \
  --output "$artifact"
echo "7af95166a730b87e172d4fc9aefea8725d3c6c7327d59149267b452114ddb7d4  $artifact" | sha256sum --check
mkdir -p "$HOME/.docker/cli-plugins"
install -m 755 "$artifact" "$HOME/.docker/cli-plugins/docker-compose"
docker compose version
