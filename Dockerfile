# Use Node.js LTS (Debian-based by default, works perfectly on Ubuntu hosts)
FROM node:22-bookworm

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the default Metro bundler port
EXPOSE 8081

# Start the Expo development server, binding to all interfaces
CMD ["npx", "expo", "start", "--localhost"]