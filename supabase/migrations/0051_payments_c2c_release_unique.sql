-- Migration 0051_payments_c2c_release_unique.sql
CREATE UNIQUE INDEX uniq_payments_c2c_release_per_order
    ON payments (reference_id)
    WHERE kind = 'c2c_release';