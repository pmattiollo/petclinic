-- Serve the Owners grid's ORDER BY ... LIMIT ... OFFSET ... paging queries from an
-- index instead of a seq scan as the table grows. The first index also covers the
-- existing last_name LIKE 'x%' prefix filter.
CREATE INDEX ON owners (last_name, first_name, id);
CREATE INDEX ON owners (city, last_name, first_name, id);
