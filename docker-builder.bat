@echo off
REM Stop the container if running, ignore errors if not found
docker stop main-backend || true
REM Remove the container if it exists, ignore errors if not found
docker rm -f main-backend || true
REM Build the Docker image
docker build -t main-backend .
REM Run the Docker container
docker run --network mapper-cluster-network --name main-backend -d -p 2000:3000 main-backend
