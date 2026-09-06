---
title: 'Beyond Transformers'
slug: beyond-transformers
publishDate: '2026-08-14'
description: 'Transformers are not the end of the story. Here is what a post-attention architecture might actually look like.'
categories: ['Artificial Intelligence']
tags: ['llms', 'mamba', 'titans', 'architecture']
author: Andrew
comments_enabled: true
featured: true
image: '/assets/blog/beyond-transformers.webp'
---

For 15 years, the dominant pattern in language models has been attention.

It was a radical departure when the Transformer replaced RNNs and LSTMs in 2017. The insight was elegant: instead of processing tokens sequentially and carrying a hidden state through time, every token attends directly to every other token. This made training massively parallelizable and eliminated the vanishing gradient problem that plagued recurrent architectures.

But attention has a cost. It scales quadratically with sequence length. A model processing 4,000 tokens needs 16 million attention weight computations. At 32,000 tokens, that jumps to over a billion. This is why your 8-billion-parameter model still struggles with a 100-page document.[^6]

The deeper issue is that attention is a lookup mechanism, not a memory system. Every time you feed a prompt into a Transformer, it wakes up with no memory of our conversation. It treats the context window as an expensive working-memory scratchpad, not a durable, structured memory. This is why the most advanced models today still forget what you told them three screens ago.

## What comes next

The next major architecture is unlikely to be one clean successor to the Transformer. More likely, it will be a composite, stateful, adaptive system: attention for precise local lookup, recurrent machinery for cheap streaming context, learned long-term memory, sparse expert routing, and loops that spend extra computation only when a problem demands it.

Each major architectural step in machine learning history has fixed a bottleneck in the previous one. The pattern is clear:

| Era                | Core idea                                            | Main limitation                               |
| ------------------ | ---------------------------------------------------- | --------------------------------------------- |
| Perceptrons / MLPs | Fixed feed-forward mapping                           | No native sequence or memory                  |
| RNNs / LSTMs       | Carry a hidden state through time                    | Hard to train; fixed-size memory bottleneck   |
| Transformers       | Direct token-to-token access via attention           | Quadratic cost; mostly stateless between runs |
| Likely next phase  | Persistent memory + dynamic computation + modularity | Still an open research problem                |

So what might this next phase actually look like?

## 1. Attention becomes a cache, not the whole computer

Attention is good at exact, content-addressed retrieval: matching a variable declaration to its use, a question to a paragraph, or a visual feature to another image region. But applying global attention across every token is wasteful.

Instead, a model might use:

- **Local/windowed attention** for the immediate working set
- **Sparse global attention** for selected important locations
- A **recurrent or state-space pathway** for the rest of a long stream
- **External retrieval** for facts, documents, codebases, and prior episodes

Mamba is an important signal here. It uses selective state-space models to process sequences in linear time, without conventional attention or MLP blocks in its basic design. Its original results reported efficient long-context handling and stronger throughput than comparable Transformers.[^1]

This does not establish Mamba as a universal replacement. Research comparing state-space models and Transformers found important cases where Transformers retain an advantage — particularly on copying-style tasks that benefit from direct attention pathways.[^5] But it does establish that alternatives to full attention are viable at scale.

## 2. Long-term memory becomes trainable at inference time

Today's models have two kinds of knowledge: **weights**, learned during training and slow-changing, and **context**, a temporary token buffer supplied at inference. The next generation may gain a third thing: a **persistent, writable learned memory** that accumulates an internal abstraction of events, preferences, task state, and environment dynamics while the model operates.

Titans is a clear prototype of this direction. It treats attention as accurate short-term memory and adds a neural long-term memory module that learns which historical information to memorize and retrieve at test time. Its variants combine the memory with attention as context, a gate, or a layer.[^2]

For an agent, this might mean:

- Remembering the architecture of a repository after reading it once
- Learning how a particular user deploys services without retraining
- Retaining the state of a multi-day investigation
- Compressing thousands of tool results into a learned task representation rather than repeatedly stuffing summaries into the context window

This is closer to a process with continuity than today's mostly stateless prompt-response system.

## 3. Reasoning happens in latent loops

Most current "thinking" models scale effort by emitting more visible or hidden tokens. A more architecture-level alternative is **recurrent depth**: repeatedly apply a reasoning block internally until it reaches a satisfactory state.

Rather than:

```text
question → 2,000 tokens of chain-of-thought → answer
```

the model could do:

```text
question → latent state → loop / refine / verify → answer
```

Research on recurrent-depth language models shows a model can iterate a recurrent block for arbitrary depth at inference time, scaling test-time compute through latent-space reasoning rather than only generating longer textual reasoning traces.[^3]

This resembles an emulator's execution loop more than a static compiler pass: preserve state, execute another cycle, inspect the result, and halt when an internal controller decides it has converged.

## 4. Computation is conditional and modular

Dense Transformers activate nearly all of a layer's parameters for each token. The next architecture will likely be far more **conditional**:

- A router classifies the token, task, or state
- It activates a few specialized expert modules
- A controller chooses whether to retrieve, simulate, call a tool, write memory, or think longer
- Easy inputs take a short route; difficult ones use more steps and specialists

Mixture-of-Experts already demonstrates the key mechanism: a routing function directs inputs to selected subnetworks, allowing larger total parameter capacity without using every parameter on every token.[^4]

But a mature version would route by more than token semantics. It might route by operation: theorem proving, code execution planning, visual geometry, search, user-memory update, or environment simulation.

## 5. A learned world model sits behind language

For agents and robotics, text prediction is not sufficient. The model needs an internal representation that predicts consequences:

$$z_{t+1} = f(z_t, a_t)$$

where $z_t$ is a compact latent state of the world and $a_t$ is an action. Planning then means searching or simulating sequences of $a_t$ in this latent model before acting.

This adds capabilities that pure next-token prediction only approximates:

- **Causal prediction:** "If I change this, what breaks?"
- **Counterfactuals:** "What if the deployment fails halfway through?"
- **Multi-step planning** with costs and constraints
- **Verification** against predicted outcomes

This is particularly relevant to software agents. A good internal "world" would model a codebase, test results, the production environment, and side effects of commands.

## My best bet

If I had to name the emerging pattern, I'd call it a **memory-augmented recurrent mixture-of-experts world model**.

Its basic operating cycle would be:

1. Ingest new data through a streaming recurrent / state-space path
2. Use local or sparse attention to inspect the immediate working set precisely
3. Retrieve durable learned memory and external factual memory only when relevant
4. Route parts of the task to specialized modules
5. Run latent reasoning or simulation loops until a learned halting policy stops
6. Perform an action or produce an answer
7. Decide what was surprising or valuable enough to store for later

## Why this is not settled

Transformers are not about to disappear. They have huge ecosystem advantages: training infrastructure, hardware kernels, known scaling behavior, and excellent quality. Even research comparing state-space models and Transformers found that Transformers retain critical advantages on certain tasks.[^5]

So the near-term "next architecture" will probably look less like _Transformer replaced by X_ and more like:

> Transformer components embedded within a larger architecture that has memory, recurrence, routing, tools, and adaptive test-time computation.

This is analogous to how modern CPUs did not replace caches, registers, pipelines, branch predictors, and execution units with a single new primitive. They became increasingly heterogeneous because different workloads require different mechanisms.

The real question is not whether some new architecture will displace the Transformer. It is how quickly the field moves from treating the Transformer as the entire computer to treating it as a component inside a larger one.

[^1]: Albert Gu and Tri Dao, _Mamba: Linear-Time Sequence Modeling with Selective State Spaces_ (2023).
[^2]: Ali Behrouz, Peilin Zhong, and Vahab Mirrokni, _Titans: Learning to Memorize at Test Time_ (2025).
[^3]: Jonas Geiping et al., _Scaling up Test-Time Compute with Latent Reasoning: A Recurrent Depth Approach_ (2025).
[^4]: NVIDIA Technical Blog, "Applying Mixture of Experts in LLM Architectures."
[^5]: Samy Jelassi, David Brandfonbrener, Sham Kakade, and Eran Malach, "Repeat After Me: Transformers are Better than State Space Models at Copying" (Kempner Institute, 2024).
[^6]: Michael Brenndoerfer, _Language AI Handbook_, "Quadratic Attention Bottleneck" (Part XVII: Efficient Attention).
