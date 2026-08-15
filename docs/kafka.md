# JobDog Streaming Pipeline — Design & Talking Points

This document covers the streaming ingestion pipeline: what it does, the decisions
behind it, and how to discuss those decisions with confidence.

Status: **implemented, not yet the default path.** `services/scraper-worker/streaming`
has the producer, consumer, and topic setup described below; `cmd/classifier`
is the consumer process. Greenhouse is wired as the first producer
(`GreenhouseScraper.SetProducer`) — set `KAFKA_BROKERS` to opt it onto the
streaming path; unset (the default), every scraper still classifies and
upserts synchronously exactly as before this existed. Verified end-to-end
against a real Redpanda + Postgres: publish → consume → classify → persist →
republish to `enriched.postings`, including that dedup and the
description-richness guard on `UpsertJob` hold on the streaming path too.
The other four scrapers (Lever, Ashby, Workday, the GitHub aggregators) still
only support the synchronous path — extending `SetProducer` to them is
mechanical, same pattern, not yet done. Numbers marked `[MEASURE]` still need
filling in from a real run with real traffic before they go on a résumé —
one canary message through a local pipeline proves the mechanism works, not
a throughput number.

---

## The broker question, answered once

We run **Redpanda**, which implements the Kafka wire protocol. If someone asks what
broker you used, say "Redpanda — Kafka-compatible." That is a completely ordinary
answer; Redpanda is a normal production choice and nobody will blink.

Why this is not a weakness in an interview: **nothing you'd be asked about changes.**
Producers and consumers use standard Kafka client libraries. Topics, partitions,
consumer groups, offsets, consumer lag, and rebalancing are the same concepts with
the same semantics. Spark reads it with the standard Kafka connector. The design
decisions below — the ones interviewers actually probe — are broker-independent.

What genuinely differs, so you're never caught flat:

| | Redpanda | Apache Kafka |
|---|---|---|
| Implementation | C++, single binary, no JVM | Scala/Java on the JVM |
| Coordination | Built in | KRaft (modern) or ZooKeeper (legacy) |
| Ops surface | No heap tuning, no GC pauses | JVM heap and GC tuning matter |
| Licence | Source-available (BSL) | Apache 2.0 |
| Ecosystem | Kafka Connect/Streams need extra setup | Native |

If asked *why* Redpanda: it runs in ~300MB against roughly 1GB for JVM Kafka, and
this pipeline shares a 2GB EC2 instance with Postgres, Redis, and two services.
That is a real constraint driving a real tradeoff — a good answer, not an excuse.

**Résumé phrasing that is both accurate and strong:**

> Built a Kafka-based streaming ingestion pipeline (Redpanda) processing
> `[MEASURE]`+ job postings daily, feeding a Spark aggregation layer.

---

## Why streaming at all

The honest version — and the one that survives follow-up questions.

The scraper runs on a 2-hour cron. Every cycle re-scrapes every source, re-parses
every posting, and upserts row by row. Three problems:

1. **Latency is bounded by the cron interval, not the work.** A job posted at
   09:01 isn't visible until 11:00, even though scraping it takes seconds.
2. **Coupled failure.** Scraping, parsing, classification, and persistence are one
   synchronous path. A slow Workday tenant delays everything behind it.
3. **No replay.** A classifier bug means re-scraping every source to fix stored
   rows — hammering third-party APIs to repair our own mistake.

Decoupling ingestion from processing fixes all three: the scraper's only job is to
publish raw postings; consumers process independently, at their own pace, and can
be re-run over retained history without touching the source APIs again.

> **Interview framing:** lead with replay and decoupling, not latency. Anyone can
> say "streaming is faster." Explaining that retention gives you re-processing
> without re-scraping shows you understand what the log is actually *for*.

---

## Architecture

```
scrapers ──► raw.postings ──► classifier ──► enriched.postings ──► Postgres (serving)
  (producer)    (topic)        (consumer)        (topic)      └──► S3 Parquet ──► Spark
```

| Topic | Key | Carries |
|---|---|---|
| `raw.postings` | `source_job_id` | Posting exactly as scraped, unprocessed |
| `enriched.postings` | `source_job_id` | Adds experience level, grad-year window, skills |

**Partition key is `source_job_id`.** This is the decision most worth being able to
defend. Keying by job ID means every event for a given posting lands on the same
partition and is therefore processed in order by exactly one consumer. Without it,
two updates to the same posting can be handled concurrently by different consumers
and land out of order — the newer state overwritten by the older one.

Rejected alternatives, and why:

- **Key by company** — fewer distinct keys, so partitions skew badly. One large
  Workday tenant would dominate a single partition while others idle.
- **No key (round-robin)** — best balance, but gives up per-posting ordering, which
  is the one guarantee we actually need.

**Partition count: 6.** Enough to parallelize consumers past current volume; low
enough not to waste file handles on a shared box. Partition count can be increased
later but never decreased — and increasing it changes key→partition mapping, so
ordering guarantees break across the resize. Worth over-provisioning slightly.

**Delivery semantics: at-least-once.** Consumers commit offsets *after* the DB
write, so a crash between write and commit replays the message. That's safe because
the upsert is idempotent — keyed on `(source, source_job_id)`, applying it twice is
identical to applying it once. Exactly-once would need transactional writes across
Kafka and Postgres, which is real complexity to buy nothing here.

> **Interview framing:** "at-least-once plus an idempotent consumer" is the answer
> senior engineers want. Claiming exactly-once invites a question about how you
> coordinate the commit with the database write — a question with no easy answer.

**Retention: 7 days.** Long enough to replay a bad classifier deploy; short enough
that disk stays bounded on a small instance.

---

## Consumer groups

The classifier runs as a consumer group. Scale it by adding instances up to the
partition count — 6 partitions means at most 6 useful consumers; a 7th sits idle.

Adding or losing a consumer triggers a **rebalance**: partitions are reassigned
across the surviving members. During the rebalance, processing for those partitions
pauses briefly. This is why consumers must be quick to commit and must tolerate
seeing a message twice — a rebalance mid-batch means the reassigned consumer
restarts from the last committed offset.

**Consumer lag** — the gap between the latest offset and the committed offset — is
the health metric to watch. Growing lag means consumers can't keep up with
producers, and it's the first thing to check when data goes stale.

---

## Spark aggregation

Databricks reads Parquet from S3 and produces hiring-trend aggregates: postings per
company over time, which skills are rising, how quickly roles close, grad-year
cohort mix.

Batch, not streaming, and deliberately so: trends over weeks don't need
second-level freshness, and a scheduled batch job is dramatically cheaper and
simpler to operate than a always-on structured-streaming cluster. Databricks Free
Edition runs this at no cost.

> **Interview framing:** being able to say why a piece *isn't* streaming is a
> stronger signal than streaming everything. "Streaming where latency matters,
> batch where it doesn't" shows judgment.

---

## Claims to measure before using them

Do not put a number on a résumé that you cannot reproduce. Each of these needs a
real measurement:

| Claim | How to measure |
|---|---|
| `[MEASURE]` postings/day | Count distinct `source_job_id` published to `raw.postings` over 24h |
| `[MEASURE]`% latency reduction | Time from ATS publish → visible in JobDog, before vs. after. Baseline is dominated by the 2h cron, so record it before cutover — you only get one chance. |
| `[MEASURE]` companies | `jq '[.greenhouse,.lever,.workday,.ashby]｜map(length)｜add' config/sources.json` |

If a measured number comes out *lower* than you hoped, use the real one. An
interviewer who asks "how did you measure that?" is far more common than one who is
impressed by a big figure, and having a crisp answer is worth more than the number.

---

## Questions you should be ready for

**"Why Kafka instead of a queue like SQS or RabbitMQ?"**
Retention and replay. A queue deletes a message once consumed; the log keeps it,
so we can add a new consumer that re-reads history, or re-run a fixed classifier
over the last week without re-scraping. Multiple independent consumer groups read
the same topic at their own offsets — a queue would need a separate copy per
consumer.

**"What happens if a consumer dies mid-message?"**
The offset was never committed, so on rebalance another consumer re-reads from the
last commit and reprocesses. Duplicates are safe because the DB write is an
idempotent upsert keyed on `(source, source_job_id)`.

**"How do you handle a poison message?"**
Bounded retries, then publish to a dead-letter topic and commit the offset so the
partition isn't blocked. A single malformed posting must never stall the partition
behind it.

**"How would you scale this 100x?"**
Partition count is the ceiling on consumer parallelism, so raise it first — but
during a resize, key→partition mapping changes and per-key ordering breaks across
the boundary, so it needs a planned cutover. Past that, the bottleneck moves to the
Postgres write path, and the fix is batching writes rather than adding consumers.

**"Why not just make the cron run more often?"**
It would cut latency but fix neither of the real problems: still no replay, still
one coupled failure path, and it multiplies load on third-party APIs — which is how
you get rate-limited or IP-banned by the ATS providers we depend on.
