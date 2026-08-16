"""Generates synthetic multi-day enriched-postings Parquet data for local
testing of trends_job.py, matching the schema services/scraper-worker/sink
writes. Not part of the production pipeline — a dev-only utility so this job
can be tested against realistic-shaped data without running the full
scraper -> Kafka -> classifier -> sink chain for several simulated days.

Usage: python generate_sample_data.py --s3-endpoint http://localhost:9000 \
    --s3-bucket jobdog-analytics-test --s3-access-key jobdog --s3-secret-key jobdog-minio-local
"""

import argparse
import datetime
import random
import uuid

import boto3
import pyarrow as pa
import pyarrow.parquet as pq
import io

COMPANIES = ["Anduril", "Scale AI", "Databricks", "Anthropic", "Ramp", "Notion", "Figma"]
SKILLS_POOL = ["python", "go", "kubernetes", "rust", "typescript", "react", "sql", "aws", "pytorch", "terraform"]
ENTRY_TYPES = ["NEW_GRAD_COHORT", "ENTRY_LEVEL_OPEN", "INTERN", "EXPERIENCED"]


def gen_rows_for_day(n, day):
    rows = []
    for _ in range(n):
        entry_type = random.choices(ENTRY_TYPES, weights=[3, 2, 2, 3])[0]
        grad_year = random.choice([2026, 2027]) if entry_type == "NEW_GRAD_COHORT" else None
        skills = random.sample(SKILLS_POOL, k=random.randint(1, 4))
        rows.append({
            "job_id": str(uuid.uuid4()),
            "source_job_id": f"sample-{uuid.uuid4()}",
            "title": "Software Engineer",
            "company": random.choice(COMPANIES),
            "experience_level": "NEW_GRAD" if entry_type != "EXPERIENCED" else "SENIOR",
            "entry_type": entry_type,
            "grad_year_min": grad_year,
            "grad_year_max": grad_year,
            "required_skills": skills[:2],
            "preferred_skills": skills[2:],
            "classified_at": int(datetime.datetime.combine(day, datetime.time(12, 0)).timestamp() * 1000),
        })
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--s3-endpoint", required=True)
    parser.add_argument("--s3-bucket", required=True)
    parser.add_argument("--s3-access-key", required=True)
    parser.add_argument("--s3-secret-key", required=True)
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--rows-per-day", type=int, default=40)
    args = parser.parse_args()

    s3 = boto3.client(
        "s3",
        endpoint_url=args.s3_endpoint,
        aws_access_key_id=args.s3_access_key,
        aws_secret_access_key=args.s3_secret_key,
    )

    schema = pa.schema([
        ("job_id", pa.string()),
        ("source_job_id", pa.string()),
        ("title", pa.string()),
        ("company", pa.string()),
        ("experience_level", pa.string()),
        ("entry_type", pa.string()),
        ("grad_year_min", pa.int32()),
        ("grad_year_max", pa.int32()),
        ("required_skills", pa.list_(pa.string())),
        ("preferred_skills", pa.list_(pa.string())),
        ("classified_at", pa.int64()),
    ])

    today = datetime.date.today()
    for offset in range(args.days):
        day = today - datetime.timedelta(days=offset)
        rows = gen_rows_for_day(args.rows_per_day, day)
        table = pa.Table.from_pylist(rows, schema=schema)

        buf = io.BytesIO()
        pq.write_table(table, buf)
        buf.seek(0)

        key = f"enriched-postings/date={day.isoformat()}/part-{uuid.uuid4()}.parquet"
        s3.put_object(Bucket=args.s3_bucket, Key=key, Body=buf.getvalue())
        print(f"wrote {len(rows)} rows to {key}")


if __name__ == "__main__":
    main()
