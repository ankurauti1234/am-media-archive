#!/bin/bash
# Script to start SSH Tunnel to private RDS Postgres via inditronics-iot-jump-server

PEM_FILE="/home/ankur/.ssh/inditronics-pems/old_acc/inditronics-iot-jump-server.pem"
JUMP_USER="ubuntu"
JUMP_IP="3.109.111.179"
RDS_ENDPOINT="inditronics-iot-rds-labeled-db.c960kiumy09x.ap-south-1.rds.amazonaws.com"
RDS_PORT=5432
LOCAL_PORT=5433

echo "Checking local port $LOCAL_PORT..."
if lsof -i :$LOCAL_PORT >/dev/null 2>&1; then
  echo "Error: Local port $LOCAL_PORT is already in use."
  exit 1
fi

echo "Establishing SSH tunnel to private RDS..."
echo "Local Port: $LOCAL_PORT -> RDS Port: $RDS_PORT"
echo "Jump Server: $JUMP_IP"
echo "Press Ctrl+C to stop the tunnel."

# Ensure correct permissions for the key
chmod 600 "$PEM_FILE" 2>/dev/null

ssh -i "$PEM_FILE" \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=60 \
    -N -L $LOCAL_PORT:$RDS_ENDPOINT:$RDS_PORT \
    $JUMP_USER@$JUMP_IP
