#!/bin/bash

echo "Deploying with relative VITE_API_BASE for reverse-proxying over port 80..."

# Stop existing containers
sudo docker compose down

# Rebuild and start in background
sudo docker compose build --build-arg VITE_API_BASE=""
sudo docker compose up -d

echo "Deployment complete! App served on port 80 (API reverse-proxied internally)."
