-- Recollate owners text columns to Romanian ICU collation so ORDER BY sorts diacritics
-- (ă, â, î, ș, ț) correctly (D9), then add the sort/prefix-search indexes (D10).

ALTER TABLE owners ALTER COLUMN last_name TYPE text COLLATE "ro-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE text COLLATE "ro-x-icu";
ALTER TABLE owners ALTER COLUMN city TYPE text COLLATE "ro-x-icu";

CREATE INDEX owners_name_sort_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_sort_idx ON owners (city, last_name, first_name, id);
CREATE INDEX owners_lastname_pattern_idx ON owners (last_name text_pattern_ops);
