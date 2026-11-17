BEGIN;

CREATE SCHEMA IF NOT EXISTS skipo_ecosystem;
REVOKE ALL ON SCHEMA skipo_ecosystem FROM PUBLIC;

CREATE TABLE IF NOT EXISTS skipo_ecosystem.deployments (
  app_id text NOT NULL CHECK (app_id ~ '^[a-z][a-z0-9-]{0,62}$'),
  app_url text NOT NULL,
  capabilities text[] NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_refresh_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (app_id, app_url)
);

CREATE INDEX IF NOT EXISTS deployments_by_refresh
  ON skipo_ecosystem.deployments (app_id, last_refresh_at DESC, app_url);

CREATE TABLE IF NOT EXISTS skipo_ecosystem.invocations (
  id uuid PRIMARY KEY,
  caller_app text NOT NULL,
  target_app text NOT NULL,
  target_url text NOT NULL,
  capability text NOT NULL,
  user_id text,
  params jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS invocations_by_expiry
  ON skipo_ecosystem.invocations (expires_at);
REVOKE ALL ON ALL TABLES IN SCHEMA skipo_ecosystem FROM PUBLIC;

COMMIT;
