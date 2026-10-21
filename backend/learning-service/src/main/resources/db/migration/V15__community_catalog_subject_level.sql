ALTER TABLE community_posts
    ADD COLUMN catalog_subject_id BIGINT REFERENCES catalog_subjects(id) ON DELETE SET NULL,
    ADD COLUMN catalog_level_id BIGINT REFERENCES catalog_levels(id) ON DELETE SET NULL;

CREATE INDEX idx_community_posts_catalog_subject ON community_posts(catalog_subject_id);
CREATE INDEX idx_community_posts_catalog_level ON community_posts(catalog_level_id);

-- Backfill only exact, case-insensitive subject/level pairs with one unique catalog match.
-- Ambiguous names and legacy labels without an exact catalog equivalent remain untouched.
WITH exact_candidates AS (
    SELECT cp.id AS post_id,
           MIN(cs.id) AS catalog_subject_id,
           MIN(cl.id) AS catalog_level_id
    FROM community_posts cp
    JOIN subjects legacy_subject ON legacy_subject.id = cp.subject_id
    JOIN catalog_subjects cs
      ON cs.active = TRUE
     AND LOWER(BTRIM(cs.name)) = LOWER(BTRIM(legacy_subject.name))
    JOIN catalog_levels cl
      ON cl.subject_id = cs.id
     AND cl.active = TRUE
     AND LOWER(BTRIM(cl.name)) = LOWER(BTRIM(cp.education_level))
    WHERE cp.catalog_subject_id IS NULL
      AND cp.catalog_level_id IS NULL
      AND cp.education_level IS NOT NULL
    GROUP BY cp.id
    HAVING COUNT(DISTINCT cs.id) = 1
       AND COUNT(DISTINCT cl.id) = 1
)
UPDATE community_posts cp
SET catalog_subject_id = candidate.catalog_subject_id,
    catalog_level_id = candidate.catalog_level_id
FROM exact_candidates candidate
WHERE cp.id = candidate.post_id;
