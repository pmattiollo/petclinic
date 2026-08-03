-- Billing needs somewhere to send the statement.
ALTER TABLE owners ADD COLUMN email text;
