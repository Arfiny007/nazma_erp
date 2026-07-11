#!/bin/sh
set -e

echo "Applying database migrations..."
attempt=1
max_attempts=15

while [ "$attempt" -le "$max_attempts" ]; do
  if npx prisma migrate deploy; then
    echo "Database migrations applied."
    break
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    echo "Migration failed after ${max_attempts} attempts."
    exit 1
  fi

  echo "Database not ready (attempt ${attempt}/${max_attempts}), retrying in 3s..."
  sleep 3
  attempt=$((attempt + 1))
done

echo "Starting application..."
exec npm start
