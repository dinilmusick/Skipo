-- E2E03: exact Kloks FOD source adapter queries, pinned to inspected source.
-- Publication source blob: cceb1ccd67eca3d73067b16a1206b78a3c08854f
-- Grant source blob: 6c660990e040d55561bdf107f2d266f8233f6859
-- Discovery source blob: 64f35917fd86b4bfd3b35eafaf4dc402a1b983a0
-- Source PR: Kloks #118 (stacked W7), test only on isolated Neon branch.
-- Test uses synthetic records and a complete outer transaction rollback.
-- psql -X -v ON_ERROR_STOP=1 -f db/tests/009_fod_publication_grant_discovery_contracts.test.sql
BEGIN;

INSERT INTO public."ultrst-apps"(id,app_id,name,status,ecosystem_id)
VALUES ('e2e03-fod-owner','e2e03-fod-owner','FOD owning app fixture','active','ultrst-armada'),
       ('e2e03-fod-caller','e2e03-fod-caller','FOD caller app fixture','active','ultrst-armada');

PREPARE e2e03_fod_publish AS
WITH withdrawn AS (
  UPDATE skipo_ecosystem.workflow_publications
     SET publication_state='withdrawn', withdrawn_at=clock_timestamp()
   WHERE app_id=$1 AND owner_user_id=$2 AND workspace_id=$3 AND workflow_id=$4
     AND publication_state='published'
     -- Only older versions are withdrawn here. The equal-version
     -- tombstone is inserted or updated by withdrawal_marker below.
     AND version<$5::integer
  RETURNING id
), withdrawal_marker AS (
  -- A withdrawal must leave a durable marker EVEN IF a publish never reached
  -- this registry. Otherwise a delayed publish could resurrect that version.
  INSERT INTO skipo_ecosystem.workflow_publications
    (app_id,owner_user_id,workspace_id,workflow_id,version,display_name,
     description,publication_state,withdrawn_at)
  SELECT $1,$2,$3,$4,$5,$6,$7,'withdrawn',clock_timestamp()
   WHERE $8::text='withdrawn'
  ON CONFLICT (app_id,owner_user_id,workspace_id,workflow_id,version)
    DO UPDATE SET publication_state='withdrawn',
                  withdrawn_at=COALESCE(
                    skipo_ecosystem.workflow_publications.withdrawn_at,
                    clock_timestamp()
                  )
     WHERE skipo_ecosystem.workflow_publications.publication_state='published'
  RETURNING id
), published AS (
  INSERT INTO skipo_ecosystem.workflow_publications
    (app_id,owner_user_id,workspace_id,workflow_id,version,display_name,description,publication_state)
  SELECT $1,$2,$3,$4,$5,$6,$7,'published'
   WHERE $8::text='published'
     -- Never replay an older version after a newer one has been observed.
     AND NOT EXISTS (
       SELECT 1 FROM skipo_ecosystem.workflow_publications newer
        WHERE newer.app_id=$1 AND newer.owner_user_id=$2 AND newer.workspace_id=$3
          AND newer.workflow_id=$4 AND newer.version>$5::integer
     )
  -- Publication identity, description, timestamps and withdrawal are immutable.
  -- An old withdrawn version can never be reactivated by a delayed retry.
  ON CONFLICT (app_id,owner_user_id,workspace_id,workflow_id,version)
    DO NOTHING
  RETURNING id
)
SELECT (SELECT count(*) FROM withdrawn) AS withdrawn_count,
       (SELECT count(*) FROM withdrawal_marker) AS tombstone_count,
       (SELECT count(*) FROM published) AS published_count;

PREPARE e2e03_fod_grant AS
WITH target_publication AS (
  SELECT id
    FROM skipo_ecosystem.workflow_publications
   WHERE app_id=$1 AND owner_user_id=$2 AND workspace_id=$3
     AND workflow_id=$4 AND version=$5::integer
     AND publication_state='published'
   FOR SHARE
), granted AS (
  INSERT INTO skipo_ecosystem.workflow_grants
    (publication_id,owner_user_id,target_workspace_id,caller_app_id,
     source_workspace_id,granted_by_user_id,grant_state)
  SELECT id,$2,$3,$6,$7,$2,'active'
    FROM target_publication
  ON CONFLICT
    (publication_id,caller_app_id,source_workspace_id,target_workspace_id)
    WHERE grant_state='active'
  DO UPDATE SET grant_state='active'
  RETURNING id
)
SELECT count(*)::integer AS affected FROM granted;

PREPARE e2e03_fod_revoke AS
WITH target_publications AS (
  SELECT id
    FROM skipo_ecosystem.workflow_publications
   WHERE app_id=$1 AND owner_user_id=$2 AND workspace_id=$3 AND workflow_id=$4
), revoked AS (
  UPDATE skipo_ecosystem.workflow_grants grant_row
     SET grant_state='revoked',
         revoked_at=clock_timestamp(),
         revoked_by_user_id=$2
   WHERE grant_row.publication_id IN (SELECT id FROM target_publications)
     AND grant_row.owner_user_id=$2
     AND grant_row.target_workspace_id=$3
     AND grant_row.caller_app_id=$5
     AND grant_row.source_workspace_id=$6
     AND grant_row.grant_state='active'
  RETURNING grant_row.id
)
SELECT count(*)::integer AS affected FROM revoked;

PREPARE e2e03_fod_authorized AS
SELECT EXISTS (
  SELECT 1
    FROM skipo_ecosystem.workflow_publications publication
    JOIN skipo_ecosystem.workflow_grants grant_row
      ON grant_row.publication_id=publication.id
   WHERE publication.app_id=$1
     AND publication.owner_user_id=$2
     AND publication.workspace_id=$3
     AND publication.workflow_id=$4
     AND publication.version=$5::integer
     AND publication.publication_state='published'
     AND grant_row.owner_user_id=publication.owner_user_id
     AND grant_row.target_workspace_id=publication.workspace_id
     AND grant_row.caller_app_id=$6
     AND grant_row.source_workspace_id=$7
     AND grant_row.granted_by_user_id=publication.owner_user_id
     AND grant_row.grant_state='active'
     AND grant_row.revoked_at IS NULL
) AS authorized;

PREPARE e2e03_fod_discover AS
SELECT publication.app_id,publication.owner_user_id,
       publication.workspace_id,publication.workflow_id,
       publication.version,publication.display_name,publication.description
  FROM skipo_ecosystem.workflow_publications publication
  JOIN skipo_ecosystem.workflow_grants grant_row
    ON grant_row.publication_id=publication.id
 WHERE publication.app_id=$1
   AND publication.owner_user_id=$2
   AND publication.workspace_id=ANY($5::text[])
   AND publication.publication_state='published'
   AND grant_row.owner_user_id=publication.owner_user_id
   AND grant_row.target_workspace_id=publication.workspace_id
   AND grant_row.caller_app_id=$3
   AND grant_row.source_workspace_id=$4
   AND grant_row.granted_by_user_id=publication.owner_user_id
   AND grant_row.grant_state='active'
   AND grant_row.revoked_at IS NULL
 ORDER BY publication.workspace_id,publication.workflow_id,publication.version;

-- Publish exact version 1 in the owning workspace and grant this caller only.
EXECUTE e2e03_fod_publish('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',1,
'FOD source version one','Metadata only','published');
EXECUTE e2e03_fod_grant('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',1,
'e2e03-fod-caller','e2e03-caller-ws');
EXECUTE e2e03_fod_grant('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',1,
'e2e03-fod-caller','e2e03-caller-ws');
EXECUTE e2e03_fod_authorized('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',1,
'e2e03-fod-caller','e2e03-caller-ws');
EXECUTE e2e03_fod_discover('e2e03-fod-owner','e2e03-fod-user','e2e03-fod-caller','e2e03-caller-ws',
ARRAY['e2e03-own-ws']::text[]);
-- Caller/source/target scope substitutions return zero results.
EXECUTE e2e03_fod_discover('e2e03-fod-owner','e2e03-fod-user','e2e03-fod-caller','another-caller-ws',
ARRAY['e2e03-own-ws']::text[]);
EXECUTE e2e03_fod_discover('e2e03-fod-owner','e2e03-fod-user','e2e03-fod-caller','e2e03-caller-ws',
ARRAY['another-target-ws']::text[]);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM skipo_ecosystem.workflow_grants
   WHERE caller_app_id='e2e03-fod-caller' AND grant_state='active')<>1 THEN
   RAISE EXCEPTION 'idempotent owner grant must create only one active row';
 END IF;
END $assert$;

-- Version 2 publication withdraws v1. Previous v1 grant is no longer eligible.
EXECUTE e2e03_fod_publish('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',2,
'FOD source version two','Metadata only','published');
EXECUTE e2e03_fod_authorized('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',1,
'e2e03-fod-caller','e2e03-caller-ws');
EXECUTE e2e03_fod_grant('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',2,
'e2e03-fod-caller','e2e03-caller-ws');
EXECUTE e2e03_fod_discover('e2e03-fod-owner','e2e03-fod-user','e2e03-fod-caller','e2e03-caller-ws',
ARRAY['e2e03-own-ws']::text[]);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM skipo_ecosystem.workflow_publications
  WHERE app_id='e2e03-fod-owner' AND workflow_id='e2e03-test-flow'
  AND publication_state='published')<>1
 OR (SELECT version FROM skipo_ecosystem.workflow_publications
     WHERE app_id='e2e03-fod-owner' AND workflow_id='e2e03-test-flow'
       AND publication_state='published')<>2 THEN
   RAISE EXCEPTION 'exact latest-version publication state mismatch';
 END IF;
END $assert$;

-- Revocation covers all historical versions and is terminal.
EXECUTE e2e03_fod_revoke('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',
'e2e03-fod-caller','e2e03-caller-ws');
EXECUTE e2e03_fod_authorized('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',2,
'e2e03-fod-caller','e2e03-caller-ws');
EXECUTE e2e03_fod_discover('e2e03-fod-owner','e2e03-fod-user','e2e03-fod-caller','e2e03-caller-ws',
ARRAY['e2e03-own-ws']::text[]);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM skipo_ecosystem.workflow_grants
   WHERE caller_app_id='e2e03-fod-caller' AND grant_state='revoked')<>2 THEN
   RAISE EXCEPTION 'revocation must revoke every older published grant';
 END IF;
END $assert$;

-- Owner re-grant creates a new active row without rewriting revoked history.
EXECUTE e2e03_fod_grant('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',2,
'e2e03-fod-caller','e2e03-caller-ws');
DO $assert$
BEGIN
 IF (SELECT count(*) FROM skipo_ecosystem.workflow_grants
   WHERE caller_app_id='e2e03-fod-caller' AND grant_state='active')<>1 THEN
   RAISE EXCEPTION 're-grant did not create one new active row';
 END IF;
END $assert$;

-- Publication withdrawal blocks discovery/re-grant even when history has grants.
EXECUTE e2e03_fod_publish('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',2,
'FOD source version two','Metadata only','withdrawn');
EXECUTE e2e03_fod_discover('e2e03-fod-owner','e2e03-fod-user','e2e03-fod-caller','e2e03-caller-ws',
ARRAY['e2e03-own-ws']::text[]);
EXECUTE e2e03_fod_publish('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',2,
'FOD source version two','Metadata only','published');
-- An interrupted withdrawn version 3 still leaves a terminal tombstone.
EXECUTE e2e03_fod_publish('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',3,
'FOD version three','Metadata only','withdrawn');
EXECUTE e2e03_fod_publish('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',3,
'FOD version three','Metadata only','published');
DO $assert$
BEGIN
 IF EXISTS(SELECT 1 FROM skipo_ecosystem.workflow_publications
   WHERE app_id='e2e03-fod-owner' AND workflow_id='e2e03-test-flow'
     AND version IN (2,3) AND publication_state='published') THEN
   RAISE EXCEPTION 'withdrawn version resurrected by delayed publish';
 END IF;
END $assert$;

-- Publication of a new version remains possible after withdrawal.
EXECUTE e2e03_fod_publish('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',4,
'FOD source version four','Metadata only','published');
EXECUTE e2e03_fod_grant('e2e03-fod-owner','e2e03-fod-user','e2e03-own-ws','e2e03-test-flow',4,
'e2e03-fod-caller','e2e03-caller-ws');
EXECUTE e2e03_fod_discover('e2e03-fod-owner','e2e03-fod-user','e2e03-fod-caller','e2e03-caller-ws',
ARRAY['e2e03-own-ws']::text[]);

ROLLBACK;
