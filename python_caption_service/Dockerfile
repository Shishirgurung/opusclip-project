# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables to prevent Python from writing .pyc files and to buffer output
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies, including ffmpeg for video processing
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Upgrade pip
RUN pip install --no-cache-dir -U pip

# Install PyTorch and its dependencies from a pre-compiled wheel to avoid building from source.
# This is much faster and less resource-intensive.
RUN pip install torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 --index-url https://download.pytorch.org/whl/cpu

# Copy the requirements file into the container
COPY requirements.txt .

# Install the rest of the Python dependencies
# pip will see that torch is already installed and skip it.
RUN pip install --no-cache-dir --requirement requirements.txt
RUN pip install --no-cache-dir gunicorn==20.1.0

# Copy the rest of the application code into the container
COPY . .

# The command to run the service (app.py or worker.py) will be provided by docker-compose
