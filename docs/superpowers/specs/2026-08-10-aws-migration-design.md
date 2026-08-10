# AWS Migration — Design

Status: Approved for planning
Sub-project: 3 of 4 (Infrastructure/AWS migration), part of the broader JobDog infra + feature overhaul
Owner context: budget-constrained ("lowest budget I can get away with"), Kafka/Databricks (sub-project 4)
is deferred but this migration should leave headroom for it. Kafka/Databricks are for learning/resume
purposes, not driven by current load — the app's current ~3,000 users don't require real horizontal
scale yet, so this migration prioritizes cost over scalability, while keeping the door open for a
later, low-effort upgrade to managed services.

## Goal

Move the backend stack (Postgres, Redis, `backend-api`, `scraper-worker`) off the DigitalOcean droplet
onto AWS, at the lowest reasonable monthly cost, without touching the frontend (stays on Vercel) or
resume storage (stays on Cloudflare R2).

## Background / current state

- Production stack today: a single DigitalOcean droplet running `docker-compose.yml`
  (`postgres:15-alpine`, `redis:7-alpine`, `backend-api` (Spring Boot/Java), `scraper-worker` (Go)),
  fronted by `nginx-jobdog.conf` (TLS termination, reverse proxy to `backend-api:8080`, WebSocket/OAuth
  passthrough, and a separate proxy rule for the Vercel-hosted frontend).
- Frontend is on Vercel — confirmed out of scope for this migration.
- Resume PDFs are stored on Cloudflare R2 via the AWS S3-compatible client already in
  `backend-api` (`software.amazon.awssdk:s3`) — stays on R2, no migration needed, no egress fees.
- Secrets today live in a `.env` file on the droplet, referenced by `docker-compose.yml`'s
  `environment:` blocks (JWT secret, R2 keys, OpenAI key, OAuth client secrets, CORS origins).
- No existing backup mechanism has been confirmed beyond whatever DigitalOcean droplet snapshots
  may or may not be enabled.

## Design

### 1. Compute

Single EC2 instance, `t4g.small` (2 vCPU, 2GB RAM, ARM/Graviton — cheaper than x86 equivalents),
running the same `docker-compose.yml` stack as today, effectively unchanged. Sized one tier above
bare-minimum (`t4g.micro`, 1GB RAM) specifically to leave headroom for a future self-hosted
Kafka/Redpanda instance (sub-project 4) to potentially run on the same box without a resize.

Postgres and Redis remain self-hosted containers (not RDS/ElastiCache) — this is the single biggest
cost lever (~$50-80/mo+ saved) and is not a durability downgrade versus what's already true on the
DigitalOcean droplet today. They're kept as standalone services on standard ports/config (not
tightly coupled into app-specific setup) so a future upgrade to managed RDS/ElastiCache is a
connection-string change, not a rewrite.

### 2. Networking & TLS

- Elastic IP attached to the instance (static — DNS doesn't need to change if the instance is ever
  replaced).
- Security group: inbound 80/443 open to the public, 22 (SSH) restricted to the operator's IP only.
  No other inbound ports exposed.
- TLS via Let's Encrypt/certbot running directly on the instance, matching the commented-out setup
  already present in `nginx-jobdog.conf`. No Application Load Balancer — an ALB's fixed hourly cost
  (~$16-20/mo minimum) isn't justified at this scale and would roughly double the infra bill for a
  single-instance deployment.

### 3. Secrets

Move secrets currently in the droplet's `.env` file (JWT secret, R2 access/secret keys, OpenAI API
key, OAuth client secrets) into AWS Systems Manager Parameter Store as `SecureString` parameters
(free at this parameter count on the Standard tier). On instance boot, a small script fetches them
via `aws ssm get-parameters-by-path` and writes them to the `.env` file `docker-compose.yml` already
expects — no changes to `docker-compose.yml` itself, just how the `.env` file gets populated. This
avoids secrets sitting in plaintext in a file that has to be manually copied/edited on the box.

### 4. Data migration & cutover

1. Provision the EC2 instance, deploy the stack via `docker-compose up -d`, pointed at a fresh,
   empty Postgres.
2. `pg_dump` the DigitalOcean Postgres instance; `pg_restore` into the new instance's Postgres
   container. This is the only real downtime window — scheduled off-peak, expected to be a few
   minutes for the current data volume.
3. Smoke-test the new instance directly via its IP (or a temporary staging DNS entry) before
   flipping production DNS: auth (login/register/OAuth), resume upload + parsing, job listing +
   scraper cron execution, resume roast/grading.
4. Lower the `jobdog.dev` DNS A record's TTL ahead of time, then flip it to the new instance's
   Elastic IP once the smoke test passes.
5. Keep the DigitalOcean droplet stopped (not deleted) for roughly one week as a rollback option,
   then decommission it.

### 5. Backups

Since Postgres is self-hosted rather than RDS (which would include automated backups), add a cron
job on the EC2 instance: nightly `pg_dump`, gzip-compressed, uploaded to a dedicated S3 bucket
(S3 Standard-IA, lifecycle rule expiring objects after 30 days). This is the one piece of net-new
operational infrastructure this migration adds beyond a straight lift-and-shift — without it, losing
the EC2 instance means losing data, which would be a regression versus whatever snapshot protection
DigitalOcean may currently provide.

### 6. Testing / validation

No application code changes in this sub-project — validation is operational, not unit tests:
- Confirm the full stack boots cleanly on the new instance from a fresh `docker-compose up -d`.
- Confirm the smoke-test checklist from step 4.3 above passes against the new instance before DNS
  cutover.
- Confirm the nightly backup job actually produces a valid, restorable dump — test one real restore
  (into a scratch Postgres, not production) before considering this sub-project done.

## Cost estimate

| Item | Monthly cost |
|---|---|
| EC2 `t4g.small` | ~$12-13 |
| EBS 20-30GB gp3 | ~$2-3 |
| Elastic IP (attached to running instance) | $0 |
| S3 backup bucket (30-day retention, this data volume) | ~$1 |
| **Total** | **~$15-18/mo** |

Versus $50-80/mo+ for an equivalent managed-services (RDS + ElastiCache) version of the same stack.

## Out of scope (deferred to other sub-projects)

- Kafka/Redpanda streaming pipeline, Databricks/Spark integration, "Trending Keywords" widget
  (sub-project 4) — this migration only ensures the chosen instance size leaves headroom for it.
- Job card UI refactor / contextual tags, New Grad ingestion focus, dead-listing purge
  (sub-project 2, not yet started).
- Any move to managed RDS/ElastiCache — explicitly deferred until user growth justifies the cost;
  this design keeps that upgrade path low-effort (config change, not rewrite) rather than building
  it now.
