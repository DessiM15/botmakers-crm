#!/usr/bin/env bash
#
# Demo Recording Environment
# Usage:
#   ./scripts/demo-record.sh start   — Spin up local Postgres, seed demo data, start dev server
#   ./scripts/demo-record.sh stop    — Tear down container, restore real .env.local
#
# Prerequisites: Docker must be running.

set -e
cd "$(dirname "$0")/.."

CONTAINER_NAME="crm-demo-db"
DEMO_PORT=5433
DEMO_DB="crm_demo"
DEMO_PASS="demo"
ENV_FILE=".env.local"
ENV_BACKUP=".env.local.real"
DEMO_DATABASE_URL="postgresql://postgres:${DEMO_PASS}@localhost:${DEMO_PORT}/${DEMO_DB}"

case "${1}" in
  start)
    echo ""
    echo "=== Starting Demo Recording Environment ==="
    echo ""

    # Check Docker
    if ! docker info > /dev/null 2>&1; then
      echo "ERROR: Docker is not running. Start Docker Desktop and try again."
      exit 1
    fi

    # Stop existing container if present
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "Removing existing demo container..."
      docker rm -f "${CONTAINER_NAME}" > /dev/null
    fi

    # Start Postgres
    echo "1/6  Starting local Postgres on port ${DEMO_PORT}..."
    docker run -d \
      --name "${CONTAINER_NAME}" \
      -p "${DEMO_PORT}:5432" \
      -e "POSTGRES_PASSWORD=${DEMO_PASS}" \
      -e "POSTGRES_DB=${DEMO_DB}" \
      postgres:16-alpine > /dev/null

    # Wait for Postgres to be ready
    echo "     Waiting for database..."
    for i in $(seq 1 30); do
      if docker exec "${CONTAINER_NAME}" pg_isready -U postgres > /dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    # Backup real env
    echo "2/6  Backing up .env.local → .env.local.real"
    cp "${ENV_FILE}" "${ENV_BACKUP}"

    # Swap DATABASE_URL to local
    echo "3/6  Switching DATABASE_URL to local Postgres"
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=${DEMO_DATABASE_URL}|" "${ENV_FILE}"
    else
      sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DEMO_DATABASE_URL}|" "${ENV_FILE}"
    fi

    # Push schema
    echo "4/6  Pushing database schema..."
    npx drizzle-kit push 2>&1 | tail -3

    # Seed team users
    echo "5/6  Seeding team users..."
    node src/lib/db/seed.mjs 2>&1 | tail -5

    # Seed demo data
    echo "6/6  Seeding demo data..."
    node src/lib/db/seed-demo.mjs 2>&1 | tail -10

    echo ""
    echo "=== Ready! ==="
    echo ""
    echo "Run:  npm run dev"
    echo "Then record at http://localhost:3000"
    echo ""
    echo "When done:  ./scripts/demo-record.sh stop"
    echo ""
    ;;

  stop)
    echo ""
    echo "=== Tearing Down Demo Environment ==="
    echo ""

    # Restore real env
    if [ -f "${ENV_BACKUP}" ]; then
      echo "1/2  Restoring .env.local from backup"
      mv "${ENV_BACKUP}" "${ENV_FILE}"
    else
      echo "1/2  No backup found at ${ENV_BACKUP} — skipping restore"
    fi

    # Remove container
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "2/2  Removing Docker container"
      docker rm -f "${CONTAINER_NAME}" > /dev/null
    else
      echo "2/2  No container to remove"
    fi

    echo ""
    echo "=== Done! Real environment restored. ==="
    echo ""
    ;;

  *)
    echo "Usage: $0 {start|stop}"
    echo ""
    echo "  start  — Spin up local Postgres, seed demo data"
    echo "  stop   — Tear down and restore real .env.local"
    exit 1
    ;;
esac
