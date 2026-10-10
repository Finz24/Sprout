FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
WORKDIR /workspace
ENV COREPACK_HOME=/opt/corepack
RUN npm install --global corepack@0.36.0 && corepack prepare pnpm@10.34.6 --activate
RUN chown node:node /workspace
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --chown=node:node apps/web/package.json ./apps/web/
COPY --chown=node:node apps/api/package.json ./apps/api/
COPY --chown=node:node apps/worker/package.json ./apps/worker/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/database/package.json ./packages/database/
COPY --chown=node:node packages/runtime/package.json ./packages/runtime/
COPY --chown=node:node packages/ui/package.json ./packages/ui/
USER node
RUN corepack pnpm install --frozen-lockfile
COPY --chown=node:node . .
ENV NX_DAEMON=false COREPACK_ENABLE_NETWORK=0
