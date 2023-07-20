FROM node:lts-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . ./

RUN npm run build

FROM node:lts-alpine as production
RUN apk add --no-cache \
	  bash \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV IS_DOCKER_CONTAINER=true
ENV DEBUG="bot:* investing-scrapper:main browser-factory:main"

RUN addgroup -S pptruser && addgroup node pptruser \
    && mkdir -p /home/node/Downloads /home/node/app \
    && chown -R node:pptruser /home/node


USER node
WORKDIR /home/node/app

COPY --chown=node:pptruser package*.json ./

RUN npm ci --production

COPY --chown=node:pptruser --from=builder /usr/src/app/dist ./dist

CMD ["node", "dist/index.js"]
