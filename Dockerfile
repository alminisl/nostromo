FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production
RUN cd server && npm ci --only=production
RUN cd client && npm ci --only=production

# Copy source code
COPY server/ ./server/
COPY client/ ./client/

# Build client
RUN cd client && npm run build

# Create necessary directories
RUN mkdir -p uploads data certs

# Expose ports
EXPOSE 3000 8080

# Start the application
CMD ["npm", "start"]