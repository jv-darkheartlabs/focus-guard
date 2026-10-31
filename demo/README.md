# Focus Guard browser simulator

Static educational illustration of the Rust module's deterministic TARS-disabled path. No Envoy process, network requests, backend, authentication, storage or real traffic. Passes use a fictional upstream status 200; throttles use the native default 429.

Run `node --test demo/model.test.cjs` from the repository root. Serve `demo/` with a local HTTP server and open its URL. `model.js` exports the same pure functions to Node and the browser.

The simulator evaluates one independently supplied attempt-count header per action, not a cumulative rate limit. Threshold range 1–10 is a demo constraint. Native configuration accepts a u32 threshold clamped to at least one. History keeps 20 rows while session counters remain cumulative; history snapshots retain the threshold used at evaluation time. Reset clears the session and restores threshold3/header1.

Validation covers numeric parsing and fallback, inclusive thresholds, history/counters, snapshots and repeated first-attempt behavior. JavaScript uses textContent for user-controlled values. No third-party scripts or remote assets are loaded.
