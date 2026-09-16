# Build roda a partir da raiz do monorepo (app/) — precisa dos workspaces
# irmãos (packages/supabase, packages/ui) pra resolver @biodinamica/*.
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

RUN npm run build:sistema

FROM nginx:alpine
COPY --from=build /repo/apps/sistema/dist /usr/share/nginx/html
COPY apps/sistema/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
