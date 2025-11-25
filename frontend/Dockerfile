# Use an official Node.js runtime.
FROM node:18-slim

# Install pnpm globally
RUN npm install -g pnpm

# Set the working directory in the container
WORKDIR /app

# Copy package management files
# This is done to leverage Docker's build cache.
COPY package*.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Expose the port the app runs on
EXPOSE 3000

# The command to run the app will be specified in docker-compose.yml,
# but this is a good default.
CMD ["pnpm", "dev"]