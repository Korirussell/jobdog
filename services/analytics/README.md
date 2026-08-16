# Hiring-trend batch aggregation

The Spark/Databricks half of the streaming pipeline in [`docs/kafka.md`](../../docs/kafka.md).
`services/scraper-worker/sink` (`cmd/s3sink`) writes the `enriched.postings`
Kafka topic to Parquet at `s3://<bucket>/enriched-postings/date=YYYY-MM-DD/`.
`trends_job.py` reads that feed and produces:

| Output | What it is |
|---|---|
| `trends/postings_by_company/` | posting count per company per day |
| `trends/skill_trends_daily/` | posting count per skill per day |
| `trends/skill_trends_growth/` | recent-7-days vs prior-7-days count per skill, ranked — which skills are actually rising, not just common |
| `trends/entry_type_mix/` | INTERN / NEW_GRAD_COHORT / ENTRY_LEVEL_OPEN / EXPERIENCED mix per day |
| `trends/grad_cohort_years/` | grad-year distribution for cohort-gated postings specifically |

Not computed: "how quickly roles close" (mentioned as a future trend in
`docs/kafka.md`). That needs job-close timestamps, which live in Postgres'
`job_snapshots` table, not in this Kafka-derived feed — left out rather than
faked from data that doesn't have it.

## Running locally (no Databricks account needed)

This is what was actually used to verify the job works — plain PySpark
against a local MinIO bucket, zero AWS/Databricks cost:

```bash
# 1. Start a local S3-compatible bucket (already in docker-compose.yml)
docker compose up -d minio

# 2. Generate some sample data to aggregate (skip this once real data exists)
pip install -r requirements.txt
python generate_sample_data.py \
  --s3-endpoint http://localhost:9000 --s3-bucket jobdog-test \
  --s3-access-key jobdog --s3-secret-key jobdog-minio-local

# 3. Run the actual job
python trends_job.py \
  --s3-endpoint http://localhost:9000 --s3-bucket jobdog-test \
  --s3-access-key jobdog --s3-secret-key jobdog-minio-local
```

Needs a JRE on the machine running `spark-submit`/`python trends_job.py` —
PySpark is a JVM process under the hood. `pip install pyspark` alone is not
enough; `apt install default-jre-headless` (or equivalent) too.

The first run downloads `hadoop-aws` (the S3A connector) from Maven Central
via Spark's `spark.jars.packages` config — that's what makes `s3a://` paths
work outside Databricks, which bundles this already.

## Running in Databricks

The job itself (`build_spark`, `load_enriched_postings`, and the three
aggregation functions) is unchanged — no Databricks-only APIs. Only the
`parse_args()` block needs replacing:

```python
# Instead of argparse, read from job parameters / a secret scope:
s3_endpoint = dbutils.widgets.get("s3_endpoint")
s3_bucket = dbutils.widgets.get("s3_bucket")
s3_access_key = dbutils.secrets.get(scope="jobdog", key="s3-access-key")
s3_secret_key = dbutils.secrets.get(scope="jobdog", key="s3-secret-key")
```

And `spark.jars.packages` in `build_spark` can be dropped — Databricks
already bundles the S3A connector, so setting it again is a harmless no-op
at best and an unnecessary Maven fetch on every cluster start at worst.

Point `--s3-endpoint` at whichever bucket is actually live: Cloudflare R2
(what `backend-api` already pays for, for resume storage — reuse it here at
no additional cost) or a real AWS S3 bucket if one gets provisioned
separately. Nothing in this repo has provisioned either.

## Verified

Ran end-to-end against real local Spark + real MinIO: generated 14 days of
synthetic data (560 rows, 7 companies, 10 skills, all 4 entry types), ran the
job, read every output table back, and confirmed the aggregations were
correct — including that `skill_trends_growth`'s ranking genuinely reflected
which skills had more mentions in the recent window vs the prior one.
