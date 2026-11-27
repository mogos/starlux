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

## R-006 Empty glass in flight

Status: must-hold
Rule: The traveling window clears content by progress 0.48 while its glass remains opaque through 0.84.
Claims: r29_empty_glass

## R-007 Neighbor settle is monotone

Status: must-hold
Rule: An interrupted neighbor reflow approaches the new target without overshoot.
Claims: neighbor_monotone

## R-008 Magnetic clock requires a lease

Status: must-hold
Rule: The magnetic compositor dispatches a frame only while it owns a wake lease.
Claims: magnetic_idle_clock

## R-009 Dock arrival transfers momentum

Status: must-hold
Rule: An upward 0.88 progress crossing transfers momentum to the dock exactly at the crossing.
Claims: dock_absorbs_crossing

## R-010 Settled open panes are opaque

Status: must-hold
Rule: A settled open pane is opaque and accessible.
Claims: open_is_opaque

## R-011 Settled docked panes are hidden

Status: must-hold
Rule: A settled minimized pane is invisible and inert.
Claims: minimized_is_hidden

## R-012 Magnetic rest releases the lease

Status: must-hold
Rule: After flight and neighbor motion settle, the compositor releases its wake lease.
Claims: magnetic_rest_releases

## Magnetic model scope

The magnetic model abstracts progress into open, content fading, empty glass,
dock arrival, and hidden. It explores reversals at phase boundaries and one
representative neighbor reflow sharing the lease. The runtime replay samples
real analytic motion at those boundaries, exercises DOM visibility and the
injected frame source, and checks that the resulting actions conform to the
model. Each single-fault twin produces a counterexample that is also replayed
against the implementation. Numerical trajectory and reduced-motion tests
cover the continuous pose outside the model's finite abstraction.
