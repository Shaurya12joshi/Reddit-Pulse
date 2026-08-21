# Reddit Brand Intelligence — architecture review and plan

Review of the proposed three-stage design, measured against what this repo
already does and what its collected data actually contains. Every number below
is measured from `server/reddit.db` (13 brands, ~1,600 items each), not
estimated.

---

## 0. What already exists

The plan should start from what's built, not from zero.

| Proposed stage | Status in this repo | Where |
|---|---|---|
| 1. Discovery | **Built.** Facet-expanded search, verification, community ranking with separated signals | `src/analysis/buzz.js`, `reddit-scraper-extension/background.js` |
| 2. Collection | **Built, but shallow** — see W2 | `background.js` → `POST /api/ingest` → `server/db.js` |
| 3. AI intelligence | **Not built.** Current sentiment/topics are lexicon heuristics | `src/analysis/{sentiment,topics,lexicon}.js` |

The existing lexicon sentiment and fixed topic taxonomy are placeholders for
Stage 3, not components of it. They have no negation handling, no sarcasm, and
a taxonomy hard-coded to SaaS (`pricing`, `ux`, `ai`) which is exactly the
"hard-coded to one industry" failure the spec warns against.

---

## 1. What the proposed architecture gets right

- **The scraper must not decide importance.** Correct, and it is the single
  most important boundary in the design. Collection is re-runnable, cacheable
  and testable only while it stays free of judgment.
- **Deterministic code for volume, LLM for judgment.** Correct in principle,
  though the line is drawn in the wrong place in a few spots (§6).
- **"Do not assume the subreddit."** Already validated in practice — the
  facet-expansion work found r/AmazonDSPDrivers (delivery-driver complaints)
  and r/RealTesla, neither of which any predefined list would contain.

---

## 2. Weaknesses, in order of how much they will hurt

### W1 — Discovery cannot precede collection; they are one loop

The diagram says `DISCOVERY → COLLECTION`, but you cannot rank a community for
"brand relevance, volume, recency, engagement" without first *collecting* posts
from inside it. The current implementation already interleaves them, and had
to.

**Resolution:** these are not two stages, they are two *depths* of the same
collection primitive.

- **Depth 1 (wide, shallow):** ~100 posts per candidate community, no comments.
  Purpose: decide where to look. ~70 requests.
- **Depth 2 (narrow, deep):** full comment trees for the specific threads that
  survived scoring. Purpose: provide Stage 3 with actual conversations.

Keeping one `collect(target, depth)` primitive with two callers preserves the
boundary you want (the scraper still decides nothing) without pretending
discovery is data-free.

### W2 — Comment coverage is 3%, and Stage 3 needs comments most

Measured, per brand:

| Brand | Posts stored | Comments stored | **Threads with ≥1 comment** |
|---|---|---|---|
| amazon | 955 | 650 | **33** |
| slack | 991 | 613 | **25** |
| tesla | 914 | 644 | **33** |
| claude | 883 | 658 | **25** |
| openai | 689 | 638 | **25** |

The collector pulls comment trees from 18 threads per run. Everything else is a
title plus body. So a Stage 3 that reasons about "the conversation", "whether
influential users are involved", or "whether it is gaining traction" would, for
97% of threads, be reasoning about a headline.

This is the highest-value fix in the whole plan and it is cheap: comment
fetching should be *driven by the importance prescore*, not by a fixed
`COMMENT_THREADS = 18` at collection time. Score first on cheap signals, then
spend ~40 requests fetching trees for the ~40 threads that matter.

### W3 — The scaling ceiling is Reddit access, not tokens

Reddit login-gates programmatic access; this repo works because the extension's
service worker carries the user's own session cookies (`ROADMAP.md` documents
the investigation). Consequences:

- ~70 requests × 500ms ≈ **50s per brand**, single-threaded, in one person's
  browser, which must be open and signed in.
- No server-side scheduling, no parallelism across brands, no multi-tenant
  operation without each tenant running the extension.
- 1,000 brands refreshed weekly = ~14 hours of continuous browser time per
  cycle.

Meanwhile the Stage 3 cost, computed against real digest sizes (§8), is
**~$0.50 per brand per run** on Claude Opus 5, or ~$0.27 via the Batch API.

**The token-efficiency section of the spec optimizes the cheap half.** Two of
its ten rules (cache key design, batching) are worth real effort; the rest are
worth one afternoon. The collection tier deserves the architectural attention:
queueing, incremental re-collection, partial-failure recovery, and an explicit
decision about whether this stays browser-bound.

*Assumption I am making explicitly:* you intend to keep the browser-extension
collection model for now. If the product needs server-side collection, that is
a procurement decision (Reddit's paid API tier) rather than an architecture
one, and it should be settled before Stage 3 is built out, because it changes
the refresh cadence that trend velocity depends on.

### W4 — "Conversation" is never defined as a unit

Stage 3 talks about conversations; Stage 2 collects posts and comments. Without
a defined unit, importance scoring, caching, and the participation
recommendation each mean something different.

**Definition to adopt:**

- **Unit of analysis = a thread** (post + its top comment subtree).
- **Unit of action = a specific target** (the post itself, or one comment id).
  A recommendation that says "reply to this thread" is not actionable; "reply
  to comment `t1_xyz`, which asserts X" is.

### W5 — Brand identity resolution is missing entirely, and it is the hardest part

The spec has no stage for "which entity does this word refer to". In practice
this dominates output quality. Measured failures from building Stage 1:

- **Slack** — the first ranking put r/webcomics, r/comics and r/DotA2 in the
  top five. *Slack Wyrm* is a webcomic; "cut me some slack" is an idiom.
- **Notion** — "notion" is a common noun, so r/science, r/nba and
  r/todayilearned ranked on threads containing "the notion that…".
- **Amazon** — the mined vocabulary came out entirely consumer-delivery
  (*delivery, prime, driver, package*), which caused r/technology — AWS,
  antitrust, layoffs — to be discarded as a different sense of the word.

Heuristics got these right (proper-noun capitalisation testing, calibrated
inside the brand's own community), but this is precisely the work an LLM does
better, once, for pennies. It belongs in the architecture as **Stage 0**.

### W6 — The competitor set has no origin

Stage 3 is asked to identify "competitor mentions" and "competitor comparison",
but nothing says where the competitor list comes from. Today it is a hard-coded
lexicon in `src/analysis/competitors.js`. For an arbitrary brand that list is
empty or wrong. Competitor discovery belongs in Stage 0 (LLM, once) and
competitor *matching* belongs in code (regex over a resolved alias list).

### W7 — Trend velocity has no time-series store

Velocity is currently inferred from post timestamps inside a single sample,
which is only valid when the sample reaches back past the comparison window —
the code returns `null` and says "sample too shallow" otherwise. That is honest
but weak. Real trend detection needs a `snapshots` table written once per run:
`(company, subreddit, run_at, threads, comments, score_sum)`. Two runs give you
a real derivative; the current approach never will for a fast-moving community
whose sample is capped.

### W8 — There is no evaluation loop

Ranking weights, relevance thresholds and exclusion cutoffs were tuned by
inspecting five brands by hand. That does not generalise and it silently
regresses. Needed before more tuning:

- A labelled set: ~150 (brand, subreddit) pairs marked relevant / not.
- ~200 threads labelled important / not, and with a category.
- `precision@10` for community ranking, and category agreement for Stage 3,
  run as a test.

Without this, every future weight change is a guess, and Stage 3's prompt
changes are unfalsifiable.

### W9 — Collection is all-or-nothing

`runScrape` accumulates everything in memory and POSTs once at the end. A
failure at request 60 of 70 loses the entire run. Ingest should stream per
phase (seed → expansion → per-community → comments), so a partial run still
produces usable data and a resumable cursor.

### W10 — Re-analysis churn has no defined trigger

"Cache analysis for conversations that have not materially changed" needs a
concrete key, or it degenerates into re-analysing everything (score drifts by
one upvote and the hash changes) or nothing (thread doubles in size and the
cache still hits). Proposal in §8.

### W11 — Participation recommendations carry compliance risk

The output of this system is advice to post, as a brand, into communities with
strong anti-marketing norms. Reddit's rules and most subreddit rules restrict
undisclosed brand participation, and getting this wrong produces exactly the
brand damage the product exists to prevent.

**Recommendation:** the system produces a *reviewed action queue*, never an
autonomous poster. Every recommendation carries the target, the draft, the
disclosure requirement, and the subreddit's own rules (fetchable from
`/r/<sub>/about/rules.json`) so a human can approve against them. Treat
"self-promotion allowed?" as a collected field, not an assumption.

---

## 3. Revised architecture

```
BRAND (free text)
  │
  ▼
STAGE 0 — RESOLUTION                                    [LLM ×1, cached ~forever]
  canonical name · entity type · aliases
  positive/negative disambiguation markers · competitor set · expected facets
  │
  ▼
STAGE 1 — DISCOVERY                                     [code + shallow collect]
  facet expansion → candidate communities → verification
  → community scoring (relevance gate, separated signals)
  │  ranked communities
  ▼
STAGE 2 — COLLECTION                                    [code, deterministic]
  2a shallow: ~100 posts per ranked community, no comments      [exists]
  2b deep:    comment trees for prescored threads only          [NEW — W2]
  │  structured conversation dataset + run snapshot
  ▼
STAGE 2.5 — CANDIDATE SELECTION                         [code — the funnel]
  brand-sense filter · near-duplicate collapse · recency window
  · deterministic importance prescore · top-K cut · cache check
  │  ~40–60 thread digests per brand per run
  ▼
STAGE 3 — INTELLIGENCE                                  [LLM, batched]
  3a taxonomy induction (per brand, periodic)
  3b per-thread: importance · category · topic · sentiment · competitors
  3c participation recommendation (only for survivors of 3b)
  │
  ▼
STAGE 4 — ACTION QUEUE                                  [code + human]
  dedup against prior recommendations · subreddit rule attachment
  · human approve/reject · outcome logging → feeds W8 eval set
```

Two cross-cutting stores the current design lacks:

- **`snapshots`** — one row per (run, community) and per (run, thread): counts
  and scores at that moment. This is what makes velocity real (W7).
- **`analyses`** — LLM output keyed by content hash (W10), so re-runs cost
  nothing for unchanged threads.

---

## 4. Data flow contracts

Each boundary is a stable, serialisable object. Everything else is internal.

**Stage 0 → 1** (`brand_identity`, stored once per brand)

```json
{
  "brand": "indigo",
  "canonical_name": "IndiGo",
  "entity_type": "airline",
  "aliases": ["6E"],
  "positive_markers": ["flight", "airport", "baggage", "boarding", "DGCA"],
  "negative_markers": ["dye", "pantone", "hex", "chapters bookstore"],
  "competitors": [
    { "name": "Air India", "aliases": ["AI Express"] },
    { "name": "SpiceJet", "aliases": ["SG"] }
  ],
  "expected_facets": ["delays", "baggage", "fares", "safety", "loyalty", "service"],
  "confidence": 0.9
}
```

`negative_markers` is the piece that most improves Stage 1 today: it turns the
Slack/Notion disambiguation from a capitalisation heuristic into a direct test,
for one LLM call per brand.

**Stage 1 → 2** (`collection_plan`)

```json
{
  "brand": "indigo",
  "communities": [
    { "name": "IndiGo6E", "priority": 1, "reason": "brand-named", "sample": 100 },
    { "name": "indianrailways", "priority": 3, "reason": "facet:travel", "sample": 100 }
  ],
  "queries": [{ "term": "refund", "facet": "service" }],
  "since": 1755000000000
}
```

**Stage 2 → 2.5** (`thread`, the storage unit — mostly exists today)

```json
{
  "id": "t3_abc123", "subreddit": "flights", "title": "...", "body": "...",
  "author": "u/x", "created_utc": 1755000000, "score": 842, "num_comments": 210,
  "permalink": "/r/flights/comments/abc123/...", "collected_at": 1755100000,
  "comments": [
    { "id": "t1_d1", "parent": "t3_abc123", "author": "u/y", "body": "...",
      "score": 310, "created_utc": 1755001000, "depth": 0 }
  ]
}
```

**Stage 2.5 → 3** (`digest` — the only thing that ever reaches the LLM) — §8.

**Stage 3 → 4** (`analysis`) — §8.

---

## 5. Minimum viable version of each stage

**Stage 0 (MVP):** one Claude call, structured output, result cached in a
`brand_identity` table. Fallback to the existing heuristic derivation when the
API is unavailable, so the pipeline degrades rather than stops. ~1 day.

**Stage 1 (MVP):** already built. The only MVP-blocking change is consuming
`positive_markers` / `negative_markers` from Stage 0 in place of the
corpus-derived vocabulary when Stage 0 succeeded. ~half a day.

**Stage 2 (MVP):** add depth-2. Concretely: after prescoring, fetch comment
trees for the top 40 threads (`/comments/<id>.json?limit=100&sort=top`,
~40 requests, ~25s) and store them. Stream ingest per phase (W9). ~2 days.

**Stage 2.5 (MVP):** deterministic funnel, no LLM. Detailed in §7. ~2 days.

**Stage 3 (MVP):** one batched call type — analyse 10 digests, return
importance + category + topic + sentiment + competitors. Participation
recommendation as a *second* call over only the top ~10 by importance, because
that output is longer and higher-stakes. ~3 days.

**Stage 4 (MVP):** a table and a list view. No autonomy. ~1 day.

Deliberately **not** in the MVP: author influence scoring (needs per-author
history fetches — a whole extra request budget), cross-brand comparison,
real-time alerting.

---

## 6. Where AI is necessary, and where it is not

The useful framing is not "code vs LLM" per task, but **who defines the
classifier versus who runs it.**

| Job | Do it with | Why |
|---|---|---|
| Brand resolution, aliases, negative markers | **LLM, once per brand** | World knowledge. No amount of corpus statistics knows "6E" is IndiGo. Cached ~forever. |
| Competitor set | **LLM, once per brand** | Same. Matching them afterwards is regex. |
| Taxonomy induction | **LLM, once per brand/industry, refreshed when "other" > 15%** | This is how the taxonomy stays extensible without being re-invented per thread. |
| Applying the taxonomy at volume | **Code, then LLM only on survivors** | Keyword/embedding match handles the obvious cases; the LLM adjudicates the ambiguous top-K. |
| Search expansion / facet clustering | **Code** | Co-occurrence statistics, already built, deterministic and free. |
| Community ranking | **Code** | Needs to be reproducible, explainable and time-series comparable. An LLM ranking 25 communities is unauditable and cannot be diffed run to run. |
| Deduplication, pagination, aggregation, trend maths | **Code** | Obviously. |
| Sentiment on the final ~50 threads | **LLM** | The current lexicon cannot do negation or sarcasm. But run it on 50 threads, not 1,600. |
| Importance judgment | **Hybrid** — code prescore, LLM adjudicates top-K | §7. |
| Participation recommendation | **LLM** | Lowest volume, highest value, genuinely requires reasoning. |

The one non-obvious move: **let the LLM write the classifier, then run the
classifier in code.** Taxonomy induction over a sample of 100 digests produces a
brand-specific category list with definitions and keyword hints; code applies
it to thousands of threads for free; the LLM only sees what code could not
confidently place.

---

## 7. Scoring and ranking design

### 7.1 Community ranking (built)

Relevance is a **multiplicative gate**, not a weighted component, so a
20M-member subreddit where the brand name merely appears cannot climb.
Remaining weights: volume 24%, recency 15%, brand-share-of-community 15%,
engagement 14%, velocity 13%, consistency 9%, depth 5%, **size 5%**. Unmeasured
signals are dropped and the remaining weights renormalised, never defaulted to
zero or to the mean.

The signal that actually separates "large community" from "high brand buzz" is
**brand share of the community's own output** — brand threads per day ÷ the
community's overall posts per day, from `/r/<sub>/new.json`. This is
size-independent by construction. It is the design's answer to the spec's
explicit requirement, and it is worth protecting in any refactor.

### 7.2 Thread importance prescore (deterministic, Stage 2.5)

Runs over every candidate thread. All inputs already exist in storage.

```
reach        = log10(1 + score + 2·num_comments)              / 5
velocity     = (score / max(age_hours, 2)) vs sub median      → 0..1
relevance    = brand mention density × sense test × marker hit → 0..1   [gate]
sub_weight   = community buzz score / 100                      → 0..1
recency      = exp(-age_days / 14)                             → 0..1
intensity    = |lexicon sentiment| (cheap proxy only)          → 0..1
unanswered   = 1 if question-shaped and low reply count        → 0/1

prescore = relevance × (0.30·reach + 0.25·velocity + 0.20·sub_weight
                        + 0.15·recency + 0.10·max(intensity, unanswered))
```

Take the top K (start at 60) plus any thread whose `analysis` cache is stale
but which is still in the top 200. This is the funnel's whole job.

Two deliberate choices:

- **`velocity` uses score-per-hour against the subreddit's own median**, not
  raw upvotes — which is how a 40-upvote post in a 5k-member sub outranks a
  4,000-upvote post in r/pics. This is the concrete answer to "do not rank
  purely by upvotes".
- **`unanswered`** promotes low-engagement threads that are cheap wins: a
  purchase-intent question with two replies is worth more to the brand than a
  1,000-upvote joke.

### 7.3 Final importance (LLM-adjudicated)

The LLM returns `importance 0–100` per thread. Store both. Rank by the LLM
score, but **log disagreement** — the top-20 threads where `|llm − prescore|`
is largest are the eval set that tells you whether the prescore weights are
wrong (W8). Do not let the LLM re-derive reach or age; it has them as inputs
and should be judging what code cannot measure: whether the issue is systemic,
whether the claim is false, whether intervention would help.

---

## 8. AI input/output schemas

Model: **`claude-opus-5`** (1M context, $5/$25 per MTok). All three call types
use structured outputs via `output_config.format` so parsing never fails.
Whether to move the high-volume classification call to a cheaper tier is a
quality/cost tradeoff to decide with the eval set from W8 in hand, not before.

### 8.1 Call 1 — Brand resolution (once per brand)

Input: brand string + 20 sampled titles from the seed sweep (to disambiguate).
Output: the `brand_identity` object in §4. ~1.5k in / ~400 out ≈ $0.02.

### 8.2 Call 2 — Taxonomy induction (once per brand, refreshed on drift)

Input: 100 digest titles + the entity type. Output:

```json
{
  "categories": [
    { "id": "flight_disruption", "label": "Flight disruption",
      "definition": "cancellation, delay, diversion or missed connection",
      "hints": ["cancelled", "delayed", "diverted", "stranded"] }
  ]
}
```

Base categories (`praise`, `complaint`, `question`, `purchase_intent`,
`competitor_comparison`, `misinformation`, `neutral`) are fixed; induction adds
brand-specific ones. That keeps the taxonomy extensible *and* comparable across
brands.

### 8.3 Call 3 — Thread analysis (batched, the volume call)

**Input digest** — built by code, ~400 tokens per thread. Never send raw
threads:

```json
{
  "id": "t3_abc123",
  "sub": "flights",
  "sub_members": 440000,
  "title": "IndiGo cancelled my flight 3 hours before departure, no refund 11 days on",
  "body": "…first 400 chars…",
  "age_days": 3,
  "score": 842,
  "comments": 210,
  "velocity_pct": 96,
  "top_comments": [
    { "s": 310, "t": "…first 200 chars…" },
    { "s": 88, "t": "…" }
  ],
  "competitor_hits": ["Air India"],
  "prescore": 71
}
```

**Output**, one object per input id — no echoing of input fields:

```json
{
  "id": "t3_abc123",
  "importance": 84,
  "drivers": ["high_reach", "recurring_issue", "unresolved"],
  "category": "flight_disruption",
  "secondary": ["customer_complaint"],
  "topic": "refund delay after cancellation",
  "sentiment": "negative",
  "intensity": 0.8,
  "competitors": [{ "name": "Air India", "stance": "favoured_over_brand" }],
  "recurring": true,
  "factual_risk": "none",
  "participation_worthy": true
}
```

`drivers` is an enum array, not prose — it is the explanation the product needs
without paying for a paragraph.

### 8.4 Call 4 — Participation (only `participation_worthy` threads)

```json
{
  "id": "t3_abc123",
  "should_participate": true,
  "action": "address_complaint",
  "target": "t3_abc123",
  "objective": "Recover the customer and demonstrate responsiveness publicly",
  "rationale": "Unresolved 11-day refund with 210 comments and a competitor favourably compared",
  "say": ["Acknowledge the delay directly", "Offer a named escalation path", "Give a concrete timeline"],
  "avoid": ["Boilerplate apology", "Asking them to DM without a reference", "Disputing the timeline publicly"],
  "disclosure_required": true,
  "confidence": 0.72
}
```

`action` enum includes `monitor_only`, `escalate_internally` and
`do_not_participate`, and the prompt must state that these are the expected
outputs for most threads. A recommender that says "reply" to everything is
worse than useless because it destroys trust in the queue.

### 8.5 Token budget, measured

Digest ≈ 400 tokens. 60 threads = 24k tokens. Batches of 10 → 6 calls.

| Item | Tokens | Cost (Opus 5) |
|---|---|---|
| System prompt + taxonomy (cached, `ttl: "1h"`) | 1.5k × 6 | ~$0.005 cached |
| Digests | 24k | $0.12 |
| Output (60 × ~250) | 15k | $0.375 |
| Participation (10 × ~400 out) | 4k | $0.10 |
| **Per brand per run** | | **~$0.60** |

Halve it with the Batch API if a few hours' latency is acceptable. Put the
system prompt + taxonomy before the digests so the cached prefix is stable, and
keep run timestamps *out* of the system prompt — a `Date.now()` there silently
invalidates the cache every call. Verify with `usage.cache_read_input_tokens`.

### 8.6 Cache key and re-analysis trigger (W10)

```
key = sha256(thread_id, hash(body), top5_comment_ids, bucket(score), bucket(num_comments))
bucket(n) = floor(log1.5(n + 1))          // ~50% growth before it moves
```

Re-analyse only when: the key changes, **or** the thread re-enters the top-K
having previously been analysed below it, **or** 14 days elapsed *and* the
thread gained comments. Everything else is a cache hit costing nothing.

---

## 9. Implementation plan

> **Status: phases 1–7 are built.** What follows is the plan as written; each
> phase now carries what actually happened, including where the acceptance
> criterion was met differently than expected. The LLM half is written and
> wired but has never executed — no credentials are configured in this
> environment — so everything runs on the deterministic fallbacks and reports
> `degraded: true`.
>
> | Priority | Built | Where |
> |---|---|---|
> | 1. Comment coverage via prescore | ✅ | `src/analysis/importance.js`, `/api/collection-plan` |
> | 2. `collect(target, depth)` | ✅ | `reddit-scraper-extension/background.js` |
> | 3. Stage 0 + negative markers | ✅ (LLM untested) | `server/intelligence/resolve.js` |
> | 4. Competitor origin | ✅ | `mineCompetitors()` + LLM path |
> | 5. Snapshots / real velocity | ✅ | `snapshots` table, `velocityFromSnapshots()` |
> | 6. Evaluation framework | ✅ | `server/eval/`, `npm test` |
> | 7. Compliance gate | ✅ | `server/intelligence/compliance.js` |
> | 8. LLM-written classifier | ✅ (induction untested) | `taxonomy.js` + `src/analysis/classify.js` |


Ordered by dependency, with acceptance criteria that are checkable rather than
aspirational.

**Phase 1 — Stage 0 resolution** *(~1 day)*
`server/intelligence/resolve.js`, `brand_identity` table, `@anthropic-ai/sdk`.
Wire `positive_markers`/`negative_markers` into the existing relevance gate.
*Accept when:* "indigo" resolves to the airline, not the colour; r/webcomics
disappears from Slack's ranking via markers rather than heuristics; existing
heuristics still run when `ANTHROPIC_API_KEY` is absent.

**Phase 2 — Snapshots + streaming ingest** *(~1 day)*
`snapshots` table written per run; ingest per phase instead of once at the end.
*Accept when:* a run killed halfway leaves usable data, and two consecutive
runs produce a real velocity number for a community whose sample is capped.

**Phase 3 — Prescore + depth-2 collection** *(~2 days)*
Implement §7.2 in `src/analysis/importance.js`; collector fetches comment trees
for the top 40 prescored threads instead of a fixed 18.
*Accept when:* threads-with-comments per brand goes from ~30 to ~40 **and every
one of them is in the top 40 by prescore** — coverage moves from arbitrary to
targeted.

**Phase 4 — Funnel** *(~2 days)*
`src/analysis/funnel.js`: sense filter → near-duplicate collapse (simhash on
title, catches crossposts and reposted news) → recency window → prescore →
top-K → cache check → digest builder.
*Accept when:* 1,600 stored items reduce to 40–60 digests, and a manual read of
20 of them says all 20 are genuinely about the brand.

**Phase 5 — Stage 3 analysis** *(~3 days)*
Taxonomy induction + batched thread analysis, structured outputs, prompt
caching, `analyses` table keyed by §8.6.
*Accept when:* cost per brand-run is under $1 measured from `usage`, a second
identical run costs ~$0, and category agreement with 50 hand-labelled threads
exceeds 80%.

**Phase 6 — Participation + action queue** *(~2 days)*
Second call over `participation_worthy` threads; `/r/<sub>/about/rules.json`
attached to each recommendation; human approve/reject with outcome logging.
*Accept when:* fewer than 30% of analysed threads produce a "respond"
recommendation, and every recommendation names a specific target id.

**Phase 7 — Evaluation harness** *(~2 days, do not skip)*
Labelled sets from W8; `precision@10` for communities, category agreement and
importance correlation for Stage 3, wired into `npm test`.
*Accept when:* changing a ranking weight produces a measurable, reported delta.

UI comes after Phase 4 at the earliest — before that there is nothing stable to
render.

---

## 10. Assumptions I am making explicitly

1. **Collection stays browser-bound** for now (W3). If not, Phase 2 changes
   shape entirely and should be re-planned first.
2. **One brand at a time, refreshed on the order of days** — not real-time
   alerting. Velocity windows of 30 days and a 14-day re-analysis trigger both
   assume this.
3. **Recommendations are advisory**, reviewed by a human before anything is
   posted (W11). If the product intends autonomous posting, the compliance
   design needs to come before the intelligence design.
4. **English-only** for now. The sense/capitalisation tests and the lexicon
   assume it; `r/india` threads about IndiGo will contain Hinglish and will
   degrade quietly rather than loudly.
5. **`num_comments` from Reddit is trustworthy** for reach, even where we have
   not fetched the tree. This is what makes the prescore possible before
   depth-2 collection.

## 11. Open questions for you

1. How many brands, at what refresh cadence? This decides whether W3 is a
   footnote or the whole problem.
2. Is the consumer a dashboard, an alert feed, or an export into an existing
   social-listening tool? It changes what Stage 4 stores.
3. Is there an existing human workflow this feeds (a support team, a social
   team)? The participation schema should match their queue, not invent one.
4. Do you want Stage 3 to run on a cheaper model tier once the eval harness can
   measure the quality difference? That is a decision worth making with data
   rather than up front.
