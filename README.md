# Focus Guard

Rust Envoy dynamic module that enforces deterministic HTTP retry thresholds before retry storms amplify outages.

**Tech spec:** [docs/TECH_SPEC.md](docs/TECH_SPEC.md) · **Demo walkthrough:** [STORYBOARD.md](STORYBOARD.md)


## ANZSCO 261312 Skills Snapshot
- Systems-level programming in Rust for production traffic control behavior.
- Reliability engineering through deterministic retry-throttling design.
- Operational observability and test-driven validation for incident workflows.

## Quick Start
### 1) Prerequisites
- Current stable Rust toolchain (`rustc`, `cargo`)
- Clang and libclang for the pinned Envoy SDK’s bindgen build step (Debian/Ubuntu: `sudo apt-get install clang libclang-dev`)
- Built On Envoy CLI (`boe`)

### 2) Run Focus Guard locally
```bash
boe run --local . --config '{
  "retry_threshold": 3,
  "overload_status_code": 429,
  "overload_body": "Focus Guard: retry overload detected.",
  "enable_tars": false
}'
```

### 3) Validate pass/throttle behavior
```bash
curl -i -H "x-envoy-attempt-count: 1" http://localhost:10000/status/200
curl -i -H "x-envoy-attempt-count: 3" http://localhost:10000/status/200
```

### 4) Run tests
```bash
cargo test --locked
cargo build --release --locked
```

### 5) Build the demo video
Use `STORYBOARD.md` for scene-by-scene visual documentation and YouTube-ready assembly instructions.

## Judge Checklist
> [!IMPORTANT]
> **Judge Checklist**
> - [x] Deterministic guardrails are enforced in-path (threshold-based pass/throttle)
> - [x] Callback safety is preserved (no blocking outbound model calls in HTTP stream callbacks)
> - [x] Observability is explicit (headers, dynamic metadata, counters, histogram)
> - [x] Behavior is reproducible with simple CLI commands
> - [x] Validation is covered by unit tests across config parsing and decision paths
> - [x] Demo workflow is documented for submission via `STORYBOARD.md`
## Submission overview
> [!IMPORTANT]
> **Submission Checklist**
> - [x] Clear incident-response problem statement
> - [x] Deterministic proxy-layer approach
> - [x] Distinct technical contribution and safety boundary
> - [x] Practical impact on operator clarity and focus
### Problem
Incident response often degrades into noisy retry loops. That noise increases ambiguity, fragments operator attention, and slows debugging.
### Approach
Focus Guard applies deterministic threshold-based retry controls first, then (optionally) invokes asynchronous TARS AI callouts for below-threshold traffic to produce explicit pass/throttle outcomes with strong observability signals.
### Why this project is distinct
- Reframes resilience controls around cognitive clarity as well as service reliability.
- Implements the control in-path as a native Envoy Rust dynamic module.
- Prioritizes deterministic behavior first; optional AI is intentionally gated behind callback-safe boundaries.
### Practical impact
Focus Guard converts noisy retry churn into explicit, debuggable states (`pass` vs `throttled`), helping teams maintain focus while preserving predictable runtime behavior.
## What Focus Guard does
At request-header time, the filter:
1. Reads `x-envoy-attempt-count` (defaults to `1` if missing or invalid).
2. Records telemetry (`focus_guard.requests_total`, retry histogram).
3. Applies deterministic throttling if `attempt >= retry_threshold`.
4. If below threshold and `enable_tars=true`, sends an asynchronous TARS callout and buffers request progression.
5. Continues decoding on TARS `pass`, or sends a local overload response on TARS `throttle`.
6. Falls back to fail-open/fail-closed behavior when TARS callout initialization or response parsing fails.

At response-header time, it emits deterministic decision headers:
- `x-focus-guard`: `pass` or `throttled`
- `x-focus-guard-retry-attempt`: parsed attempt count
- `x-focus-guard-tars`: `disabled` or `active`
## Architecture
### Components
- `RawFilterConfig`: JSON-deserializable user config.
- `FilterConfigImpl`: validated runtime config and metric handles.
- `FilterConfig`: global config factory and metric definition point.
- `PerRouteFilterConfig`: optional per-route behavior overrides.
- `Filter`: per-stream state (`last_retry_attempt`, `throttled`, `pending_tars_callout_id`) and async callout result handling via `on_http_callout_done`.
### Request/response flow
```mermaid
flowchart LR
  A[Request headers] --> B[Parse x-envoy-attempt-count]
  B --> C[Record metrics and dynamic metadata]
  C --> D{attempt >= retry_threshold?}
  D -- Yes --> E[Mark throttled]
  E --> F[Send local overload response]
  F --> G[StopIteration]
  D -- No --> H{enable_tars?}
  H -- No --> I[Mark pass]
  I --> J[Continue filter chain]
  H -- Yes --> K[Send async TARS callout]
  K --> L[StopAllIterationAndBuffer]
  L --> M[on_http_callout_done]
  M --> N{TARS decision/result}
  N -- pass --> O[Mark pass + continue_decoding]
  N -- throttle --> P[Mark throttled + local overload response]
  N -- error/unparseable --> Q{tars_fail_open?}
  Q -- true --> O
  Q -- false --> P
  J --> R[Response headers callback]
  G --> R
  O --> R
  P --> R
  R --> S[Set x-focus-guard, retry-attempt, tars headers]
```
### Callback-safety and AI boundary
`enable_tars` is callback-safe and non-blocking:
- Uses Envoy async HTTP callouts from the stream filter context.
- Returns `StopAllIterationAndBuffer` while waiting on TARS, then resumes with `continue_decoding()` when appropriate.
- Applies explicit fail-open or fail-closed fallback when callouts fail or responses are unparseable.
- Never performs direct blocking network calls inside stream callbacks.
## Configuration
Focus Guard accepts JSON config through the dynamic-module filter config.

Supported fields:
- `retry_threshold` (default `3`, minimum enforced `1`)
- `overload_status_code` (default `429`, validated to `100..=599`, fallback `429`)
- `overload_body` (default `"Focus Guard throttled request due to retry overload."`)
- `enable_tars` (default `false`; enables async TARS decision callouts)
- `tars_cluster` (default `\"api.router.tetrate.ai:443\"`)
- `tars_authority` (default `\"api.router.tetrate.ai\"`)
- `tars_path` (default `\"/v1/chat/completions\"`)
- `tars_model` (default `\"o3-mini\"`)
- `tars_timeout_milliseconds` (default `250`)
- `tars_fail_open` (default `true`)
- `tars_api_key` (optional bearer token)

Example:
```json
{
  "retry_threshold": 3,
  "overload_status_code": 429,
  "overload_body": "Focus Guard: please pause and retry later.",
  "enable_tars": false
}
```
## Observability
### Metrics
Config-scoped metrics (defined when available):
- `focus_guard.requests_total` (counter)
- `focus_guard.throttled_total` (counter)
- `focus_guard.retry_attempt` (histogram)
### Dynamic metadata
Namespace: `focus_guard`
- `retry_attempt` (number)
- `throttled` (bool)
### Headers
- Request header set by filter: `x-focus-guard`
- Local response headers on throttle:
  - `x-focus-guard: throttled`
  - `x-focus-guard-tars: disabled|active`
  - `content-type: text/plain; charset=utf-8`
- Response headers:
  - `x-focus-guard`
  - `x-focus-guard-retry-attempt`
  - `x-focus-guard-tars`
## Local development
### Prerequisites
- Current stable Rust toolchain (`rustc`, `cargo`)
- Clang and libclang for the pinned Envoy SDK’s bindgen build step (Debian/Ubuntu: `sudo apt-get install clang libclang-dev`)
- Built On Envoy CLI (`boe`)
### Run tests
```bash
cargo test --locked
cargo build --release --locked
```
### Run locally
```bash
boe run --local .
```

Then exercise the route:
```bash
curl -v http://localhost:10000/status/200
```
### Run with explicit config
```bash
boe run --local . --config '{
  "retry_threshold": 3,
  "overload_status_code": 429,
  "overload_body": "Focus Guard: retry overload detected.",
  "enable_tars": false
}'
```
## Storyboard (YouTube-ready demo documentation)
Use `STORYBOARD.md` for a scene-by-scene production plan, including visuals, voiceover script, command captures, and a fast assembly workflow for YouTube upload.

Command sequence used in the storyboard:
```bash
boe run --local . --config '{
  "retry_threshold": 3,
  "overload_status_code": 429,
  "overload_body": "Focus Guard: retry overload detected.",
  "enable_tars": false
}'
curl -i -H "x-envoy-attempt-count: 1" http://localhost:10000/status/200
curl -i -H "x-envoy-attempt-count: 3" http://localhost:10000/status/200
cargo test --locked
cargo build --release --locked
```
## Validation coverage
> [!IMPORTANT]
> **Validation Checklist**
> - [x] Config parsing and defaults are tested
> - [x] Invalid/fallback config paths are tested
> - [x] Deterministic pass/throttle decisions are tested
> - [x] Response signaling headers are tested
Unit tests currently cover:
- config defaults and custom parsing
- invalid config fallback behavior
- per-route config parsing failure cases
- deterministic pass/throttle request-header behavior
- async TARS callout start and completion behavior
- TARS decision parsing and response-header signaling behavior
## Project status
The current scope provides deterministic safety by default and optional AI-assisted throttling through callback-safe asynchronous TARS callouts.
## License
Apache-2.0


## Solution
A Rust Envoy dynamic module that applies deterministic retry throttling and observable pass/throttle behavior.

## Architecture Diagram
```mermaid
flowchart LR
  Client --> Envoy["Envoy + Focus Guard"]
  Envoy --> Decision{"Retry threshold reached?"}
  Decision -- Yes --> Throttle["Local overload response"]
  Decision -- No --> Upstream["Forward request"]
  Envoy --> Metrics["Counters / headers / metadata"]
```

## Tech Stack
- Rust
- Envoy dynamic module
- Built On Envoy CLI
- Observability instrumentation

## Setup Instructions
```bash
cargo test --locked
cargo build --release --locked
boe run --local .
```

## Testing
- cargo test --locked
cargo build --release --locked
- curl request simulations with x-envoy-attempt-count header

## ANZSCO 261312 Competency Evidence
- Systems programming for reliability controls.
- Operational tooling with deterministic behavior under load.
- Testing and observability for incident response workflows.

## Commit Convention
Use Conventional Commits for presentation clarity:
- `feat(scope): add new user-facing capability`
- `fix(scope): resolve functional defect`
- `test(scope): add or improve automated tests`
- `docs(readme): improve project documentation`

## Evidence Map
- `src/`
- `STORYBOARD.md`
- `Cargo.toml`
- `docs/TECH_SPEC.md`

---

**Maintained by:** [Dark Heart Labs](https://darkheartlabs.technology)  
**Author:** Jennifer ([@jv-darkheartlabs](https://github.com/jv-darkheartlabs))  
**Site:** https://darkheartlabs.technology

## Reproducibility and runtime verification

CI runs the locked unit tests, builds the release shared library on Linux, and checks shell-script syntax. Unit tests use Envoy SDK mocks; they do not launch a real proxy or contact TARS.

The SDK is pinned to Envoy commit `f1dd21b16c244bda00edfb5ffce577e12d0d2ec2`. Dynamic-module ABI compatibility is strict: use a matching Envoy build rather than assuming the latest downloaded proxy is compatible. Record the `boe` and Envoy versions when reporting runtime results.

For an installed compatible runtime, run `./verify.sh`. It starts a local Python upstream and checks pass, threshold throttle, missing-header and invalid-header responses with TARS disabled. It requires Cargo, Clang/libclang, Python 3, curl, `boe`, and a compatible Envoy binary; set `ENVOY_PATH` explicitly to choose that binary. This runtime script is separate from CI and has not been revalidated during the current build review. Its startup timeout does not bound the initial `boe` build/download.

On macOS, full Xcode is not required for this Rust project, but Apple Command Line Tools are needed. The checked-in Cargo configuration permits unresolved Envoy host symbols in the dynamic library. A successful library build alone does not establish that a particular Envoy binary can load it.

The generated Dockerfile uses Rust 1.84 and is not exercised by CI. Do not treat the stable-toolchain CI result as validation of that container recipe. No hosted SaaS, live TARS integration, browser demo or production deployment is established by these checks.
