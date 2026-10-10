"""Explore crash points in abstract receipt/job handoff designs.

This is a design model, not an application, broker, database, or load test.
Assumptions: database commits are atomic and durable; confirmed broker messages
are durable under the chosen broker configuration; restarts preserve durable
state. File retention, provider calls, and real delivery semantics are excluded.
"""

from dataclasses import dataclass, replace
import json


@dataclass(frozen=True)
class State:
    receipt: bool = False
    acknowledged: bool = False
    durable_intent: bool = False
    broker_message: bool = False
    result: bool = False


def acknowledged_work_has_durable_handoff(state):
    # Requirement: an acknowledged save retains both its receipt and a durable
    # processing intent/message, or a recorded result. This does not prove
    # consumers recover or eventually process that intent.
    return not state.acknowledged or (
        state.receipt
        and (state.durable_intent or state.broker_message or state.result)
    )


def explore(name, transitions):
    state = State()
    trace = []
    failures = []
    checked = 1
    for label, changes in transitions:
        state = replace(state, **changes)
        trace.append(label)
        # Crash immediately after every transition. All modeled state is durable
        # except client acknowledgement, which is historical evidence.
        checked += 1
        if not acknowledged_work_has_durable_handoff(state):
            failures.append({"crash_after": label, "trace": list(trace)})
    return {"design": name, "crash_points": checked, "violations": failures}


database_queue = [
    ("commit receipt and job in one transaction", {"receipt": True, "durable_intent": True}),
    ("acknowledge save", {"acknowledged": True}),
    ("commit result", {"result": True}),
    ("complete job", {"durable_intent": False}),
]

unsafe_broker = [
    ("commit receipt", {"receipt": True}),
    ("acknowledge save", {"acknowledged": True}),
    ("confirm broker publish", {"broker_message": True}),
    ("commit result", {"result": True}),
    ("acknowledge broker message", {"broker_message": False}),
]

broker_outbox = [
    ("commit receipt and outbox intent in one transaction", {"receipt": True, "durable_intent": True}),
    ("acknowledge save", {"acknowledged": True}),
    ("confirm broker publish", {"broker_message": True}),
    ("mark outbox delivered", {"durable_intent": False}),
    ("commit result", {"result": True}),
    ("acknowledge broker message", {"broker_message": False}),
]

reports = [
    explore("A: Next.js + pg-boss", database_queue),
    explore("B: NestJS + pg-boss", database_queue),
    explore("C: Effect + pg-boss", database_queue),
    explore("D: BullMQ + PostgreSQL outbox", broker_outbox),
    explore("E: RabbitMQ + PostgreSQL outbox", broker_outbox),
    explore("Counterexample: acknowledge before external broker publish", unsafe_broker),
]

assert all(not report["violations"] for report in reports[:5])
assert reports[5]["violations"][0]["crash_after"] == "acknowledge save"

# Independent failure trace: broker confirms delivery, dispatcher crashes before
# recording it, and a restart sends the same outbox entry again.
duplicate_trace = ["publish confirmed", "crash before marking delivered", "restart", "publish confirmed again"]

print(json.dumps({
    "kind": "abstract crash-prefix exploration; not measured runtime stress",
    "reports": reports,
    "illustrative_duplicate_delivery_trace_not_executed": duplicate_trace,
    "required_followup": "Idempotent consumers and guarded result publication remain necessary in every design.",
}, indent=2))
