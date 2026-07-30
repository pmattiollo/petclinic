-- Order matters: an index built under the old collation cannot serve an ORDER BY under the
-- new one, so the collation change must land before the indexes that rely on it.
ALTER TABLE owners ALTER COLUMN last_name  TYPE varchar(30) COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE varchar(30) COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE varchar(80) COLLATE "en-US-x-icu";

-- Covers name,asc (forward scan) and name,desc (backward scan of the same index).
CREATE INDEX owners_last_first_idx ON owners (last_name, first_name, id);

-- city,asc: forward scan.
CREATE INDEX owners_city_name_idx ON owners (city, last_name, first_name, id);

-- city,desc is a mixed-direction ordering (city DESC, name ASC) that a backward scan of
-- owners_city_name_idx cannot serve, hence a dedicated index.
CREATE INDEX owners_city_desc_name_idx ON owners (city DESC, last_name, first_name, id);

-- Under a non-C collation a plain B-tree can no longer serve `LIKE 'prefix%'` with a range
-- scan (verified: findByLastNameStartingWith fell back to a seq scan after the ICU change
-- above). text_pattern_ops restores byte-order comparison for pattern matching only.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);
