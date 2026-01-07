FROM node:18-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование package файлов
COPY package*.json ./

# Установка всех зависимостей
RUN npm install
RUN npm install @sveltejs/adapter-static

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN npm run build

# Установка serve для продакшена
RUN npm install -g serve

# Открытие порта
EXPOSE 3000

# Запуск приложения через preview
CMD ["npm", "run", "preview"]
