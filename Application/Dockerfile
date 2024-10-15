FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production && npm cache clean --force

COPY . .
EXPOSE 3000

CMD ["node", "app.js"]