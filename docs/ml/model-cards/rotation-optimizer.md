# Method card: Rotation optimization

| Field | Value |
|---|---|
| Status | **Not built** (planned for Phase 4) |
| Method label shown in the app | Optimization |
| Code | `src/lib/rotation/optimize.ts` (to be created), using `src/lib/rotation/score.ts` |

## Purpose
Search all allowed multi-season crop sequences and return the best balanced
options under the farmer's priorities and constraints. It optimizes the
**existing rule-based criteria**; it is not machine learning.

## Search space
9 crops. 3 seasons: 729 sequences × 2 (with or without cover crops) = 1,458.
4 seasons: 6,561 × 2 = 13,122. Small enough for **exhaustive search**, which
finds the exact Pareto front; a genetic algorithm would only approximate it.

## Objectives
The eight engine criteria: water, nitrogen, soil organic matter, pest and
disease break, erosion, climate fit, soil fit, income and feed.

## Constraints kept
Market list, row planter, cover-crop choice, irrigation, soil, previous crops
(the current rotation is always included for comparison).

## Selection
1. Keep non-dominated (Pareto) sequences.
2. Rank them with the farmer's priority weights.
3. Return the top option plus up to two clearly different alternatives.

## Limitations
Only as good as the rule-based criteria and the prototype crop values.
Sequences are scored, not simulated.

## Validation (planned)
Unit tests: constraints never violated; Pareto set matches brute force on a
small case; the current rotation is always compared.
