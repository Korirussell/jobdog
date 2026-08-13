-- benchmark_jobs backs BenchmarkJobEntity but no migration in this history ever
-- creates it — V7 through V10 only ALTER it, each guarded with "IF EXISTS", which
-- made every one of them a silent no-op on a database that never had the table.
-- That's exactly what happened here: Hibernate's ddl-auto=validate then refuses to
-- start with "missing table [benchmark_jobs]" on any environment provisioned from
-- this migration history alone — the table only ever existed on whichever
-- developer's machine originally ran a schema-generating ddl-auto mode.
--
-- IF NOT EXISTS makes this safe to run on an environment where the table already
-- exists (from that ddl-auto history) as well as one where it doesn't.
CREATE TABLE IF NOT EXISTS benchmark_jobs (
    id               UUID PRIMARY KEY,
    title            VARCHAR(255) NOT NULL,
    company          VARCHAR(255) NOT NULL,
    category         VARCHAR(64)  NOT NULL,
    description      TEXT         NOT NULL,
    difficulty_level INTEGER      NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
