# syntax=docker/dockerfile:1

# Node 24 (Active LTS) — satisfaz o engines do package.json (>=22.12).
FROM node:24-alpine AS development
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
# npm ci exige package-lock.json em sincronia com o package.json.
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM development AS build
RUN npm run build

FROM nginx:1.29-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
