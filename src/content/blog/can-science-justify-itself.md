---
title: 'Can Science Justify Itself?'
slug: can-science-justify-itself
publishDate: '2026-01-17'
description: 'Exploring the problem of induction and the limits of science.'
categories: ['Science']
tags: ['philosophy of science', 'science', 'induction']
author: Andrew
comments_enabled: true
featured: false
image: '/assets/blog/science.webp'
---

On the surface, the answer seems obvious: science works. Airplanes fly,
antibiotics cure infections, and large language models autocomplete our
thoughts. But under the hood there is a deep and unresolved problem: the very
pattern of reasoning that makes science possible - _induction_ - does not
appear to have a non-circular justification.[^1]

This post sketches the problem, connects it to observation and cognition, and
surveys a few prominent responses.

### What Is Induction, Exactly?

Induction is the move from observed cases to unobserved ones:

- The sun has risen every day in recorded history, so it will rise tomorrow.
- Every sampled piece of copper conducts electricity, so all copper conducts.
- Repeated trials show a drug helps patients, so it will probably help the
  next one.

Inductive reasoning underlies almost every empirical inference in science:
generalizing from experiments, extrapolating trends, and treating unobserved
cases as similar to observed ones.

[David Hume](https://en.wikipedia.org/wiki/David_Hume) gave the classic
formulation of the problem in the 18th century.[^2]
He argued that such inferences seem to assume a _Principle of the Uniformity of
Nature_ (PUN): roughly, that the future will resemble the past or that similar
causes will have similar effects. But that principle is neither:

- **Deductively** provable: its denial is not a logical contradiction.
- **Inductively** provable: any attempt to support it by past regularities
  would already _presuppose_ that such regularities are evidence about the
  future, which is exactly what is at issue.

So if scientific reasoning is essentially inductive, there appears to be no
way to show that it is _rational_ without using the very pattern of reasoning
being questioned.

### Observation Is Not Neutral Either

Induction is not the only fragile piece. Even "raw data" is not as raw as it
looks.

Philosophers of science like [Norwood Russell
Hanson](https://en.wikipedia.org/wiki/Norwood_Russell_Hanson), [Thomas
Kuhn](https://en.wikipedia.org/wiki/Thomas_Kuhn), and [Paul
Feyerabend](https://en.wikipedia.org/wiki/Paul_Feyerabend) argued that
observation is **theory-laden**.[^3] Rough idea:

- What scientists _see_ (in the sense of "see that this is a track of an
  electron", or "see this as a galaxy rotation curve") is shaped by their
  existing concepts, models, and expectations.
- There is no completely neutral, theory-free observational language that all
  parties can use to adjudicate between competing theories.

Contemporary work in cognitive psychology largely supports a moderate version
of this: top-down expectations can influence perception and interpretation,
especially when sensory input is weak or ambiguous.[^4] This reinforces a
second limit:

> Science tests hypotheses "against observation," but observation itself is
> filtered through fallible, theory-infused human cognition.

So we get a double bind: the _inference_ from data is inductive and apparently
unjustified, and the _data_ are not clean, objective givens either.

### Hume's Challenge in a Nutshell

Hume's argument can be distilled into a few key moves:

1. There are (roughly) two kinds of arguments:
   - **Demonstrative** (deductive): if the premises are true, the conclusion
     must be true.
   - **Probable** (inductive): the premises make the conclusion more likely,
     but do not guarantee it.

2. The claim "the future will resemble the past" (the Uniformity Principle) is
   not demonstratively certain; its negation is not a contradiction.

3. Any attempt to justify inductive inferences using experience (for example,
   "induction has worked well in the past") already presupposes that past
   success is a good guide to future success, which is _itself_ an inductive
   assumption.

So either:

- Induction has no rational justification, or
- Its justification is circular or question-begging.

This is the **problem of induction**: not that induction fails in practice,
but that its use appears to outrun what can be justified by strict logic or
non-circular argument.

### Popper, Falsification, and Why That Isn't a Free Pass

[Karl Popper](https://en.wikipedia.org/wiki/Karl_Popper) famously tried to
sidestep induction by recasting science as a purely **deductive**
enterprise.[^5] On his view:

- Science does not _confirm_ theories; it only _refutes_ them.
- We propose bold conjectures and use observation to try to falsify them.
- When a theory survives attempted falsification, it is "corroborated" but
  never justified in the inductive sense.

This picture has a certain elegance: it avoids saying that accumulating
confirmations make a theory more probably true, and so appears to dodge Hume's
challenge. But there are well-known problems:

- Scientists do treat surviving prediction tests as some evidence _for_ a
  theory; this looks like inductive support, even if one avoids the word
  "justification."
- Falsification itself depends on auxiliary assumptions (about instruments,
  background theories, ceteris paribus clauses); deciding when a theory is
  really refuted often involves inductive judgment about which assumptions to
  retain or abandon.[^6]

Popper's legacy is still huge - especially the focus on risky predictions and
refutation - but most philosophers think his view does not fully dissolve the
problem of induction, it just rephrases it.

### Reliabilism and Pragmatism: "Works" as Justification?

More recent approaches attack the problem by changing _what "justified" means_.

**Reliabilism.** Reliabilist epistemology says, roughly: a belief is justified
if it is produced by a **reliable** process, i.e., one that tends to generate
a high ratio of true to false beliefs.[^7]

[Frank Ramsey](<https://en.wikipedia.org/wiki/Frank_Ramsey_(mathematician)>) is
often cited as an early reliabilist: he suggested that reasonable beliefs are
those arising from truth-conducive "mental habits," evaluated pragmatically by
how well they guide successful action.[^8] [Alvin
Goldman](https://en.wikipedia.org/wiki/Alvin_Goldman) and others later
formalized this into process reliabilism, where:

- What matters is not an internal proof that a method is trustworthy, but the
  _actual performance_ of that method in the world.
- Inductive practices (statistical inference, controlled experiment, etc.) can
  be epistemically good simply because, in our world, they reliably track
  regularities.

This does not give a Hume-style non-circular proof from the armchair; it
instead says that **objective reliability is enough** for justification, even
if agents cannot demonstrate it without circularity.

**Pragmatic justification.** A related move is explicitly **pragmatic**:

- If any method will let us predict, control, and navigate our environment, it
  looks a lot like induction and modern scientific method.
- Alternatives (pure guesswork, arbitrary rules, radical skepticism) perform
  dramatically worse by our own standards of success.

On this view, even if we cannot _prove_ that inductive rules will continue to
work, it is rational - given our aims of survival, prediction, and
explanation - to adopt them rather than stand still. The justification is not
"these rules mirror the necessary structure of reality," but "given what we
care about, and what we have seen, using them is our best option."[^9]

You can think of this as elevating "works well in practice" from a weak
heuristic to a central normative criterion.

### Theory-Ladenness and Cognitive Limits

The worries about induction connect naturally with worries about **cognitive
bias** and **theory-ladenness** of observation.

- Cognitive science documents systematic biases: confirmation bias,
  availability heuristics, motivated reasoning, and more, all of which can
  distort scientific judgment.
- Theory-ladenness suggests that what counts as an "observation" is partly
  determined by prior theoretical commitments and conceptual schemes.

These issues amplify Hume's challenge:

> Even if induction had a clean logical status, the _inputs_ to inductive
> inference - our observations and data sets - are filtered through noisy
> perceptual systems, social structures, and background theories.

Contemporary responses emphasize **methodological safeguards** -
randomization, blinding, preregistration, replication, triangulation across
methods - to reduce the impact of individual cognitive limitations. But those
safeguards themselves are justified inductively: we use them because they have
historically reduced error rates.

### Can Science Justify Itself?

So where does this leave the practicing scientist - or the engineer who wants
to be honest about foundations?

A few live options:

1. **Skeptical honesty.** Accept Hume's point: there is no non-circular
   justification of induction in the strong, foundationalist sense. Still use
   science as a highly successful - perhaps indispensable - practice, while
   dropping the demand for ultimate rational guarantees.

2. **Reliabilist/pragmatist stance.** Redefine justification in terms of
   reliability and practical success. Inductive methods and the scientific
   toolkit are justified because, in this world, they are the most reliable
   routes we have to true, actionable beliefs.

3. **Foundational re-engineering.** Explore alternative frameworks
   (Bayesianism, objective chance theories, modal accounts of laws) that aim
   to embed induction inside a richer picture of laws, probability, and
   rational belief. These often promise more structure but rarely escape Hume
   entirely; they typically end up showing that _if_ the world has certain
   probabilistic or modal features, then certain inductive rules are
   optimal.[^10]

4. **Bedrock move.** Treat some inductive practices as part of the
   non-negotiable "hinges" of rationality: rules that are not justified by
   further argument but instead define what counts as reasoning at all. On
   this view, the problem of induction is a symptom of asking for a
   justification that, in principle, cannot be given.

None of these options restore the comforting picture of science as a fully
self-justifying, certainty-producing machine. What they do instead is help
locate scientific reasoning in a more modest, but arguably clearer, space:

- It is powerful, corrigible, and deeply entangled with our cognitive
  architecture.
- It lacks an ultimate, non-circular foundation.
- Yet it remains the best tool available for getting a grip on a world that
  has so far behaved in strikingly regular ways.

That tension - the spectacular success of science sitting atop an unresolved
foundational problem - is exactly what makes the problem of induction worth
returning to.

[^1]: For an accessible introduction, see the Stanford Encyclopedia of Philosophy entry on The Problem of Induction.
[^2]: David Hume, _An Enquiry Concerning Human Understanding_ (1748), Sections IV-V. Hume's argument remains the canonical statement of the problem.
[^3]: Norwood Russell Hanson, _Patterns of Discovery_ (1958); Thomas Kuhn, _The Structure of Scientific Revolutions_ (1962); Paul Feyerabend, _Against Method_ (1975).
[^4]: For a review of top-down effects on perception, see Firestone and Scholl, "Cognition does not affect perception: Evaluating the evidence for 'top-down' effects," _Behavioral and Brain Sciences_ (2016). The debate continues, but moderate versions of theory-ladenness are widely accepted.
[^5]: Karl Popper, _The Logic of Scientific Discovery_ (1934/1959). Popper argued that science proceeds by conjecture and refutation, not by inductive confirmation.
[^6]: See the Duhem-Quine thesis: Pierre Duhem, _The Aim and Structure of Physical Theory_ (1906); W.V.O. Quine, "Two Dogmas of Empiricism," _The Philosophical Review_ (1951).
[^7]: Alvin Goldman, "What Is Justified Belief?" in _Justification and Knowledge_ (1979). Goldman's process reliabilism holds that a belief is justified if produced by a reliable cognitive process.
[^8]: Frank Ramsey, "Truth and Probability" (1926), in _The Foundations of Mathematics and Other Logical Essays_ (1931). Ramsey anticipated many themes in pragmatist and reliabilist epistemology.
[^9]: Hans Reichenbach, _Experience and Prediction_ (1938), offers a classic pragmatic vindication of induction: if any method works, induction will.
[^10]: For Bayesian approaches, see Richard Jeffrey, _The Logic of Decision_ (1965); for objective chance, David Lewis, "A Subjectivist's Guide to Objective Chance" (1980).
