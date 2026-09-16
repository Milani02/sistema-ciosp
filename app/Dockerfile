# Dockerfile único pros dois apps do monorepo — qual deles builda é
# escolhido pelo build arg APP (sistema | inscricao). Existe porque
# algumas versões do Coolify só têm o campo "Base Directory" (sem um
# campo separado de "Dockerfile Location"), então os dois recursos
# apontam pro mesmo Base Directory (a raiz do monorepo, "app") e
# usam esse mesmo Dockerfile, diferenciando só pelo build arg.
FROM node:22-alpine AS build
WORKDIR /repo

COPY . .
RUN npm ci

# Vite grava essas variáveis DENTRO do bundle na hora do build — não dá
# pra trocar depois só reiniciando o container, tem que rebuildar.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

ARG APP=sistema
RUN npm run build:$APP

FROM nginx:alpine
ARG APP=sistema
COPY --from=build /repo/apps/${APP}/dist /usr/share/nginx/html
COPY apps/${APP}/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
