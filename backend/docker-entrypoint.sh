#!/bin/sh
# Apply database migrations and load the (idempotent) topic catalog, then start the API.
set -e
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "Applying database migrations..."
  alembic upgrade head
  python -m app.db.seed
fi
exec "$@"
