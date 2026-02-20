---
title: On Layering Intelligence
date: February 2026
---

<hr />

At first, I thought building a prediction model was the strategy.

Over time, it became clear that the model wasn’t the main thing. It was an
entry point. What it surfaced was a broader architectural question: where
should intelligence actually live inside an organization?

That shift has changed how I think about AI integration. It feels less
like adding models and more like layering intelligence on top of systems
that already exist.

It’s hard not to think about the same pattern in humans — layers of
cognition stacked on top of older systems.

At the base of that architecture is structured data — the operational
records that reflect what has actually happened. When we use that data to
generate predictions — cost ranges, timelines, anomaly detection — we’re
working from deterministic history. This layer doesn’t need semantic
interpretation. It needs clean schemas, well-defined logic, and
disciplined modeling. It produces something close to institutional truth.

But structured data alone isn’t enough.

There’s a difference between the system specification and the
institutional memory that surrounds it. The specification defines the
“what” and the “how” — schemas, APIs, business logic, guarantees. It
should be precise and deterministic.
That’s where truth is enforced.

The knowledge layer captures the “why” and the “when.” Design tradeoffs.
Failure modes. Situations where outputs shouldn’t be trusted blindly. This
layer is narrative and meaning-heavy. It’s where semantic search makes
sense. Separating the rules of the system from the history of its
implementation moves tribal knowledge into infrastructure.

Above those layers sits the orchestration layer — where LLMs and agents
live.

Here, in my view, the boundary matters.

LLMs can reason and translate. They can summarize metrics, interpret
natural language, draft explanations. But they don’t decide. Structured
systems decide. Humans remain accountable.

That hierarchy isn’t dramatic — it’s structural.

If that boundary erodes, the system becomes unstable. If it holds, LLMs
remain useful interfaces rather than quiet authorities.

The intelligence of the system shows up over time through feedback .
A prediction is made. An outcome is observed. When it’s wrong, we record
why. Structured feedback improves models. Textual feedback
updates context. Patterns that repeat eventually move from
narrative into code.

That loop — observation to explanation to structural update — is what
gradually turns a tool into a learning system.

I’m still thinking through this. But it feels less like “adding AI” and
more like deciding where intelligence belongs — and making sure the
boundaries are clear before the tools get more capable.
