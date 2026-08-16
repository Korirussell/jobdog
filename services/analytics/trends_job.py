"""Hiring-trend batch aggregation over the enriched-postings Parquet feed.

This is the Databricks/Spark half of docs/kafka.md's architecture: cmd/s3sink
(services/scraper-worker/sink) writes enriched.postings to
s3://<bucket>/enriched-postings/date=YYYY-MM-DD/*.parquet; this job reads that
feed and produces three trend tables:

  - postings_by_company : posting count per company per day
  - skill_trends        : per-skill posting count per day, plus a simple
                           recent-vs-prior-week growth ratio to surface which
                           skills are rising, not just which are common
  - grad_cohort_mix      : entry_type mix per day, and grad-year distribution
                           for cohort-gated postings specifically

Portable by design — plain PySpark, no Databricks-only APIs — so it runs
identically via `spark-submit` against a local/MinIO bucket (see
services/analytics/README.md for how this was verified) or pasted into a
Databricks notebook. The one thing that changes between the two is *how you
set the four --s3-* arguments*: locally they're CLI flags; in Databricks,
replace the argparse block with widgets (`dbutils.widgets.get(...)`) reading
the same four values from a job parameter or secret scope — everything below
that point is unchanged.

Does NOT compute "how quickly roles close" (mentioned as a future trend in
docs/kafka.md) — that needs job-close timestamps, which live in Postgres'
job_snapshots table, not in this Kafka-derived Parquet feed. Left out rather
than faked from data that doesn't have it.
"""

import argparse
import sys

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--s3-endpoint", required=True, help="S3-compatible endpoint (R2, MinIO, or omit for real AWS S3 by passing the AWS endpoint)")
    parser.add_argument("--s3-bucket", required=True)
    parser.add_argument("--s3-access-key", required=True)
    parser.add_argument("--s3-secret-key", required=True)
    parser.add_argument("--input-prefix", default="enriched-postings")
    parser.add_argument("--output-prefix", default="trends")
    parser.add_argument("--path-style-access", action="store_true", default=True,
                         help="Required for R2/MinIO; real AWS S3 with virtual-hosted-style DNS can omit this")
    return parser.parse_args()


def build_spark(args) -> SparkSession:
    spark = (
        SparkSession.builder.appName("jobdog-hiring-trends")
        # hadoop-aws + its aws-java-sdk-bundle give Spark's S3A filesystem
        # client, which is what makes s3a:// paths work at all — Databricks
        # bundles this already, so this line is a no-op there but required
        # for a plain local/CI Spark install.
        .config("spark.jars.packages", "org.apache.hadoop:hadoop-aws:3.3.4")
        .config("spark.hadoop.fs.s3a.endpoint", args.s3_endpoint)
        .config("spark.hadoop.fs.s3a.access.key", args.s3_access_key)
        .config("spark.hadoop.fs.s3a.secret.key", args.s3_secret_key)
        .config("spark.hadoop.fs.s3a.path.style.access", str(args.path_style_access).lower())
        .config("spark.hadoop.fs.s3a.connection.ssl.enabled", str(args.s3_endpoint.startswith("https")).lower())
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
        .getOrCreate()
    )
    return spark


def load_enriched_postings(spark: SparkSession, bucket: str, prefix: str):
    path = f"s3a://{bucket}/{prefix}/"
    # basePath makes Spark treat date=YYYY-MM-DD as a discovered partition
    # column ("date") rather than folding it into the file scan silently.
    df = spark.read.option("basePath", path).parquet(path + "date=*/*.parquet")
    return df.withColumn("date", F.to_date(F.regexp_extract(F.input_file_name(), r"date=([\d-]+)", 1)))


def postings_by_company(df):
    return df.groupBy("date", "company").agg(F.count("*").alias("posting_count"))


def skill_trends(df):
    # required + preferred skills, one row per (posting, skill).
    skills = df.select(
        "date",
        F.explode(F.array_union(F.coalesce(F.col("required_skills"), F.array()),
                                 F.coalesce(F.col("preferred_skills"), F.array()))).alias("skill"),
    )
    daily = skills.groupBy("date", "skill").agg(F.count("*").alias("mention_count"))

    # Recent-vs-prior-week growth: sum the last 7 available days per skill
    # against the 7 days before that. A skill with recent=0 is excluded from
    # the ratio (nothing to compare growth against) but still shows up in the
    # raw daily counts above.
    dates = [row.date for row in daily.select("date").distinct().orderBy(F.desc("date")).collect()]
    if len(dates) >= 2:
        latest = dates[0]
        recent_start = dates[min(6, len(dates) - 1)]
        prior_end = recent_start
        prior_start = dates[min(13, len(dates) - 1)]

        recent = (
            daily.filter((F.col("date") >= recent_start) & (F.col("date") <= latest))
            .groupBy("skill").agg(F.sum("mention_count").alias("recent_count"))
        )
        prior = (
            daily.filter((F.col("date") >= prior_start) & (F.col("date") < prior_end))
            .groupBy("skill").agg(F.sum("mention_count").alias("prior_count"))
        )
        growth = (
            recent.join(prior, "skill", "left")
            .withColumn("prior_count", F.coalesce(F.col("prior_count"), F.lit(0)))
            .withColumn(
                "growth_ratio",
                F.when(F.col("prior_count") > 0, F.col("recent_count") / F.col("prior_count")),
            )
            .orderBy(F.desc("recent_count"))
        )
        return daily, growth
    return daily, None


def grad_cohort_mix(df):
    entry_type_mix = df.groupBy("date", "entry_type").agg(F.count("*").alias("posting_count"))

    cohort_years = (
        df.filter(F.col("entry_type") == "NEW_GRAD_COHORT")
        .filter(F.col("grad_year_min").isNotNull())
        .groupBy("date", "grad_year_min", "grad_year_max")
        .agg(F.count("*").alias("posting_count"))
    )
    return entry_type_mix, cohort_years


def main():
    args = parse_args()
    spark = build_spark(args)

    df = load_enriched_postings(spark, args.s3_bucket, args.input_prefix)
    df.cache()
    total = df.count()
    print(f"Loaded {total} enriched postings")
    if total == 0:
        print("No data to aggregate; exiting without writing output.")
        spark.stop()
        return

    out = f"s3a://{args.s3_bucket}/{args.output_prefix}"

    postings_by_company(df).write.mode("overwrite").parquet(f"{out}/postings_by_company")

    daily_skills, skill_growth = skill_trends(df)
    daily_skills.write.mode("overwrite").parquet(f"{out}/skill_trends_daily")
    if skill_growth is not None:
        skill_growth.write.mode("overwrite").parquet(f"{out}/skill_trends_growth")

    entry_type_mix, cohort_years = grad_cohort_mix(df)
    entry_type_mix.write.mode("overwrite").parquet(f"{out}/entry_type_mix")
    cohort_years.write.mode("overwrite").parquet(f"{out}/grad_cohort_years")

    print(f"Wrote trend tables under {out}/")
    spark.stop()


if __name__ == "__main__":
    sys.exit(main())
