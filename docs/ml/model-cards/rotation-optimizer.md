# Method card: Rotation optimization

| Field | Value |
|---|---|
| Status | **Built and tested** (2026-11-15). Not yet shown in the app (Phase 5–6). |
| Method label shown in the app | Optimization |
| Code | `src/lib/rotation/optimize.ts`, scoring in `src/lib/rotation/score.ts`, crop limits in `src/lib/rotation/pool.ts` |
| Tests | `src/lib/rotation/optimize.test.ts` |

## Purpose
Search all allowed multi-season crop sequences and return the best balanced
options under the farmer's priorities and constraints. It optimizes the
**existing rule-based criteria**; it is not machine learning and it does not
make the criteria more accurate.

## Search space
9 crops, sequences with repetition. Rotations that are the same cycle started
from a different season are counted once. With the cover-crop option:

| Seasons | Raw sequences | Scored after limits and de-duplication (test farm) | Pareto front | Time (Node) |
|---|---|---|---|---|
| 3 | 9³ × 2 = 1,458 | 496 | 128 | ≈ 9 ms |
| 4 | 9⁴ × 2 = 13,122 | 3,328 | 371 | ≈ 75 ms |

Exhaustive search finds the **exact** Pareto front, which a genetic algorithm
would only approximate, so no genetic algorithm is used. A Web Worker is not
needed at these timings (browser timing still to be checked in Phase 6).

## Objectives
The eight engine criteria: water, nitrogen, soil organic matter, pest and
disease break, erosion, climate fit, soil fit, income and feed.

## Constraints kept
- Market list and row-planter availability (same rules as the strategy builder; relaxed with a notice when fewer than two crops remain).
- Cover crops only if the farmer accepts them.
- The first season does not repeat the crop that is in the field now.
- Irrigation, soil and slope act through the criteria.

## Selection
1. Keep the non-dominated (Pareto) sequences: no other sequence is at least as good on every criterion and better on one.
2. Rank them by the farmer's weighted overall score.
3. Return the top option plus up to two **clearly different** alternatives (a different set of crops, or a different cover-crop choice).

## Verified by tests
- Pareto front equals a brute-force check on 300 random items.
- Constraints are never violated (market list, planter, cover-crop choice).
- Relaxed constraints are reported.
- The top option scores at least as well as every hand-built strategy on the test farm.
- Changing priorities shifts the result in the expected direction (water versus income and feed).

## Limitations
Only as good as the rule-based criteria and the prototype crop values.
Sequences are scored, not simulated. Many Pareto-optimal options differ by
only a few points; the app should present them as similar, not ranked
precisely.
