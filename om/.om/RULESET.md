# Wake, release and directed coupling

## R-001 No tick without a token

Status: must-hold
Rule: A dispatched frame has a live wake token at dispatch.
Claims: no_tick_without_token

## R-002 Body rest releases the lease

Status: must-hold
Rule: The body lease is released at the configured consecutive rest count. Motion resets the count.
Claims: body_rest_releases

## R-003 Cancellation releases the gesture

Status: must-hold
Rule: DOM cancellation synchronously releases ownership of the gesture and its frame handle.
Claims: cancelled_gesture_releases

## R-004 Only the current epoch can dispatch

Status: must-hold
Rule: A callback from an earlier generation dispatches no frame.
Claims: stale_epoch_rejected

## R-005 Coupled neighbors terminate

Status: must-hold
Rule: Receiving a push leaves no downstream push to dispatch.
Claims: coupled_neighbors_terminate

## Scope and replay

The model represents one explicit, one body and one gesture lease. Their union determines whether the clock is running. A single `callbackFresh` bit covers equality to the current generation for a representative queued callback. The model explores every configured rest threshold from 1 through 8. Rest samples and push requests come from the environment. The model explores through the finite fixpoint.

`scripts/verify-om.sh` checks the project, requires exit 2 from each single-fault twin in `om/twins`, then reads the labeled counterexample steps into `tests/om-replay.ts`. Replay invokes the TypeScript clock, actual DOM controller with an injected frame host, and physics step. It checks the good implementation at the same action that falsified each twin.
