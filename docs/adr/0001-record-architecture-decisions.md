# 1. Record architecture decisions

Date: 2026-07-10

## Status

Accepted

## Context

Focus Guard implements reliability controls at the proxy layer with optional AI-assisted decisions. Trade-offs around determinism vs TARS should be documented.

## Decision

Use ADRs in `docs/adr/` for threshold policy, TARS boundaries, and observability contracts.

## Consequences

- Operators and reviewers can verify callback-safety constraints explicitly.

---

**Maintained by:** [Dark Heart Labs](https://darkheartlabs.technology)  
**Author:** Jennifer ([@jv-darkheartlabs](https://github.com/jv-darkheartlabs))  
**Site:** https://darkheartlabs.technology
