#!/bin/bash

# Fetch VM IP dynamically
VM_IP=$(curl -s ifconfig.me)
echo "Deploying with VITE_API_BASE=http://${VM_IP}:8000"

# Stop existing containers
sudo docker compose down

# Rebuild and start in background
sudo docker compose build --build-arg VITE_API_BASE=http://${VM_IP}:8000
sudo docker compose up -d

echo "Deployment complete! API running on port 8000, Frontend running on port 80."
