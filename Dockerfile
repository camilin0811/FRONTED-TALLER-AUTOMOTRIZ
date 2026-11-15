# =============================================================================
#  Imagen del frontend del taller
#
#  El resultado es estatico: nginx sirviendo el bundle. La imagen final no
#  contiene Node ni las dependencias de desarrollo.
# =============================================================================

FROM node:20-alpine AS construccion

WORKDIR /origen

# Primero el manifiesto, para que npm ci quede en cache mientras no cambien
# las dependencias.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# La URL de la API se fija en tiempo de compilacion: Vite la incrusta en el
# bundle. Hay que pasarla al construir, no al ejecutar.
ARG VITE_API_URL=http://localhost:8080/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine AS ejecucion

COPY --from=construccion /origen/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost/ > /dev/null || exit 1
