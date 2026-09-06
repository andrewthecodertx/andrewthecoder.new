---
title: 'Building Enchanter'
slug: building-enchanter
publishDate: '2026-05-23'
description: "How a Rust AI agent came together, what we borrowed, what we didn't, and the moment the agent started helping build itself."
categories: ['Software Development']
tags: ['rust', 'ai-agents', 'mcp', 'open-source']
author: Andrew
comments_enabled: true
featured: true
github: 'https://github.com/andrewthecodertx/enchanter'
image: '/assets/blog/building-enchanter.webp'
---

I've been building a thing called Enchanter. It's a focused AI agent harness: a single
Rust binary that reads your SOUL, loads your memory, finds your skills, talks to your
model. Nothing more.

The project started with a simple question: what if I stripped an AI agent down to the
essentials and built it in Rust? No Electron, no Node runtime, no Docker container. Just a
binary that runs, talks to any OpenAI-compatible provider, and gets out of your way.

What emerged is a system that owes debts to several existing agents, diverges from them
in deliberate ways, and, somewhere along the way, crossed a line where the agent
running inside it started helping write the code for the thing itself.

## What We Borrowed

Enchanter didn't come from nowhere. The AI agent space already has several mature
projects, and I paid attention to what they got right.

**From Hermes Agent:** the data model. Enchanter uses the same `~/.enchanter/` directory
structure, the same `§`-delimited memory format, and the same SKILL.md format (from
agentskills.io). This wasn't laziness, it was intentional. If you're already running
Hermes, you can point Enchanter at the same data directory and it just works. The memory
format, the skills index, the SOUL.md persona file: these are good ideas that are worth
keeping, not reinventing.

**From Claude Code and OpenCode:** the tool-as-first-class-citizen model. These agents
proved that an LLM with well-defined tools is dramatically more useful than one that just
chats. Enchanter's dispatch loop (call the model, check for tool_calls, execute, push
results, repeat) follows the same pattern. It works. No reason to be clever about it.

**From the MCP specification:** the extension mechanism. Model Context Protocol is
becoming the standard way for agents to discover and use external tools. Enchanter
implements an MCP client that speaks JSON-RPC over stdio. You declare servers in
config.yaml, Enchanter spawns them at startup, discovers their tools, and routes calls
with a `server_name:tool_name` namespace. If an MCP server crashes, the agent warns and
continues. That resilience pattern came directly from watching other agents die
when a single tool server had a bad day.

## Where We Went Our Own Way

The borrowed ideas are the floor. The interesting decisions are the ones where Enchanter
deliberately diverges.

**Seven built-in tools, not a plugin ecosystem.** Enchanter ships with seven Rust
functions baked into the binary: `exec_command`, `read_file`, `write_file`,
`edit_file`, `search_files`, `list_directory`, and `memory`. These always work, no
configuration needed, no server to start. MCP is the extension mechanism for everything
else. This is the opposite of the "everything is a plugin" approach. The built-ins cover
the 90% case for a coding agent. You need image generation or web search? Wire up an
MCP server. But the core tools never fail to load because they're not plugins, they're
compiled in.

**`edit_file` instead of `write_file` for code.** This one surprised me. Most agents
treat file editing as "overwrite the whole thing." That's fine for short files, but for
a 500-line Rust module, it's terrifying. Enchanter's `edit_file` tool does targeted
find-and-replace with a uniqueness check: if the old string appears more than once, it
refuses and tells the model to be more specific. There's also a `replace_all` flag for
intentional bulk changes. This one decision makes the agent dramatically safer when
editing code. The model can't accidentally nuke a file because it hallucinated a
slightly wrong version.

**Memory as cap-and-summarize, not search.** Some agents treat memory as a vector
database: embed every entry, search by relevance at prompt time. That's powerful but
complex. Enchanter takes the simpler path: load the most recent N entries into the
prompt (configurable, default 50). When entries exceed a threshold (default 40), the
oldest entries get summarized into a SUMMARY.md that persists alongside the full
entries. You get the recency of recent memory plus the context of older decisions,
without the overhead of an embedding system.

**Edition 2024.** This one raised eyebrows. Rust's 2024 edition requires Rust 1.85+ and
changes some fundamental syntax (like `let` chains instead of nested `if` blocks). It
was a deliberate choice. The project is new, there's no legacy code to worry about, and
the edition 2024 idioms are genuinely cleaner. If you're starting a Rust project in 2026
and not using the latest edition, you're carrying debt on day one.

**Stdout flush.** This sounds trivial, but it was a real bug: `print!()` in Rust
doesn't flush stdout. Tokens were arriving from the streaming API and getting buffered
until the response completed, which meant the user saw nothing until the model finished
talking. One `std::io::stdout().flush().ok()` after each token render fixed it. Small
thing, big UX impact.

## The Turning Point

Here's where it gets weird.

The first few sessions with Enchanter were me telling Tim (that's the agent persona
running inside it) what to do, and Tim doing it. "Add a tools module." "Fix the clippy
warning." "Replace this deprecated dependency." Normal developer-assistant workflow.

Then we implemented the tool system, the dispatch loop where the model can call
functions and get results back. And something shifted.

I asked Tim to add `search_files` and `edit_file` as built-in tools. Tim wrote the
implementations, including the uniqueness safety check on `edit_file`. I hadn't
specified that. Tim pushed back: "if the old string appears more than once, it should
refuse and tell you to be more specific." That was Tim being a constructive adversary,
the SOUL.md persona spec I'd written, now running inside Enchanter itself, surfacing a
risk I hadn't thought about.

Then Tim found the `[DONE]` bug in the streaming SSE parser. The `break` statement only
exited the inner newline-parsing loop, not the outer chunk-reading loop. After `[DONE]`,
subsequent chunks kept getting processed silently. Tim identified it, wrote the fix
with a `done` flag, and explained why it mattered. I reviewed it, tested it, shipped it.

Then Tim replaced the brittle `::name::arguments` string encoding in the tool call
accumulator with a proper `ToolCallAccum` struct. The old code joined tool call deltas
with `::` as a delimiter, a format that would break the moment a function name or
argument string contained `::`. Tim caught this without being asked and proposed the
struct-based approach unprompted.

At that point, the loop closed. Tim, running inside Enchanter, was using Enchanter's
own `edit_file` tool to edit Enchanter's source code. The agent was fixing the agent.
Not in some grand self-modifying way, just in the practical, incremental way that
actual software development works. Find a problem, write a fix, test it, commit it.

That's the moment that matters. Not some sci-fi threshold of artificial consciousness.
Just the point where your tool is good enough to help improve itself.

## What's There Now

The current state of Enchanter after this work:

- 7 built-in tools (always available, no config)
- MCP client for extension (stdio, JSON-RPC 2.0)
- Streaming responses with proper SSE parsing
- Memory with cap-and-summarize persistence
- Skills discovery and injection into system prompt
- SOUL.md persona (Tim v2, if you're curious)
- REPL commands: `/model` to switch mid-session, `/retry` to re-send, `/undo` to
  drop the last exchange, `/tools` to see everything available
- 32 tests, zero clippy warnings, clean release builds

It's a single Rust binary. `make install` puts it in `~/.local/bin`. You point it at
Ollama, OpenAI, OpenRouter, or any OpenAI-compatible provider and start talking.

## What It Isn't

Enchanter is not a framework. It's not a platform. It doesn't have a plugin
marketplace, a web dashboard, or a Docker image. It's a harness, the minimal
structure around an LLM that makes it useful as a persistent, tooled agent.

If you want something with more infrastructure, there are excellent options. Claude
Code, OpenCode, Hermes: these are mature systems with rich ecosystems. Enchanter sits
in a different spot, small, fast, opinionated, and extensible through MCP when you need
more.

## Why Rust

A word on the language choice, since people always ask.

Rust gives Enchanter three things that matter: a single static binary with no runtime
dependencies, memory safety without garbage collection pauses, and a type system
expressive enough that the tool dispatch and MCP client practically wrote themselves.
The `match` on tool names, the `Result` propagation, the typed message model: Rust's
type system catches entire categories of bugs at compile time that would be runtime
errors in a dynamically-typed language.

The compile times aren't great. That's the trade-off. But for a tool you build once
and run thousands of times, the equation works.

## Where It Goes Next

The MCP integration is the growth path. Right now Enchanter connects to MCP servers at
startup and routes tool calls at runtime. The next step is making that loop tighter:
faster discovery, better error reporting, maybe HTTP/SSE transport for remote servers.

But the core idea doesn't change: a single binary, any provider, zero surprises.
Enchanter reads your SOUL, loads your memory, finds your skills, talks to your model.

If that sounds like your kind of tool, the source is on GitHub.
