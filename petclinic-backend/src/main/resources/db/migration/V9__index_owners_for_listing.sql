-- Indexes backing the paginated Owners listing (GitHub issue #25).
--
-- Both end in `id` because the listing pages with LIMIT/OFFSET: rows tied on the leading
-- column have no guaranteed relative order, so without a unique tiebreaker the same owner
-- can appear on two consecutive pages while another is never shown.
--
-- The database collation is C (byte order), so a plain btree on last_name also serves the
-- existing `LIKE 'Dav%'` prefix filter -- no text_pattern_ops variant is needed.

CREATE INDEX owners_last_name_first_name_id_idx ON owners (last_name, first_name, id);

CREATE INDEX owners_city_last_name_id_idx ON owners (city, last_name, id);
