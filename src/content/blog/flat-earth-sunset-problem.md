---
title: 'The Flat-Earth Sunset Problem'
slug: flat-earth-sunset-problem
publishDate: '2026-06-20'
description: "I tried to build a working flat-earth model. The sunset math broke it. Here's why."
categories: ['Science']
tags: ['flat earth', 'astronomy', 'geometry', 'math']
author: Andrew
comments_enabled: true
featured: false
image: '/assets/blog/flat-earth-sunset-problem.webp'
---

I like a good thought experiment. So I decided to try something: could I build a
working geometric model of a flat earth? Not because I believe the earth is
flat (I don't), but because the best way to understand why a model fails is to
build it and watch it break.

And break it did. Fast. The problem is sunsets.

## The Setup

Here's the idea. In a flat-earth model, the sun isn't 93 million miles away.
It's a local object, hovering above a flat plane, circling overhead. Different
flat-earth proponents propose different heights for the sun, but for this
exercise I picked a common one: **3,000 miles above the plane**.[^1]

The sun moves across the sky at roughly 15 degrees per hour (one full rotation
in 24 hours). That means it moves 1 degree every 4 minutes, or 0.25 degrees per
minute. So far, so good. This part actually works fine and matches what we
observe.

The question I wanted to answer was: _how far away does the sun have to be
before an observer on the ground can no longer see it?_ In other words, when
does "sunset" happen?

## The Geometry

If the sun is at height $h$ above the plane, and the observer sees it at an
angle $\theta$ above the horizon, then the horizontal distance from the
observer to the point directly under the sun is:

$$d = \frac{h}{\tan(\theta)}$$

This is just a right triangle. No trickery, no spherical geometry, no
assumptions about the earth's curvature. It's plane trigonometry on a flat
plane, which is exactly the setting the model assumes.

With $h = 3{,}000$ miles, the only free variable is $\theta$: the angle below
which the sun is no longer visible. That threshold, the cutoff angle, is
where things get interesting.

## The Problem

Here's the thing about $\tan(\theta)$: as $\theta$ approaches zero, it blows
up. The function is extremely sensitive near the horizon. Small disagreements
about the visibility threshold produce wildly different distances.

I computed the implied horizontal distance for a range of cutoff angles:

| Cutoff angle | Implied distance |
| ------------ | ---------------: |
| 15.0°        |     11,196 miles |
| 10.0°        |     17,014 miles |
| 5.0°         |     34,290 miles |
| 2.0°         |     85,909 miles |
| 1.0°         |    171,870 miles |
| 0.5°         |    343,766 miles |
| 0.25°        |    687,545 miles |
| 0.1°         |  1,718,872 miles |

Let that sink in. At a 15-degree cutoff, a reasonable angle where atmospheric
scattering and resolution limits would make the sun hard to see, the sun is
about 11,000 miles away. That's plausible-sounding if you're committed to the
model.

But cut the angle in half, and the distance roughly doubles. Cut it again, and
it doubles again. By the time you reach a 0.1-degree cutoff, which is well
within the resolution of the human eye and well within what you'd need for the
sun to actually disappear at sunset, the sun would need to be **1.7 million
miles away**.

On a flat plane with a 3,000-mile-high sun.

## Why This Breaks the Model

The core issue is that sunsets happen at the horizon. The sun doesn't fade out
at 15 degrees or 10 degrees. It drops to the horizon and then goes below it.
Anyone who has watched a sunset knows this. The sun is clearly visible well
below 5 degrees, and it remains visible until it's essentially at 0 degrees.

For the model to produce a sunset at a cutoff angle of, say, 0.25 degrees,
which is still conservative, the sun would need to be nearly **700,000 miles**
away. At 0.1 degrees, it's **1.7 million miles**.

To put that in perspective: the real sun is about 93 million miles away.[^2] The
flat-earth model, trying to keep the sun local at 3,000 miles high, ends up
requiring it to be 1-2% of the real distance, but still absurdly far for
something that's supposed to be a small local spotlight hovering over a flat
plane.

And here's the deeper problem: **the distance depends entirely on where you
set the cutoff**. There's no natural stopping point. The model has no mechanism
that says "the sun vanishes here." In reality, the earth's rotation carries the
sun below the horizon, a clean, physical cutoff. In the flat-earth model, the
sun just keeps getting farther away, and you have to pick an arbitrary angle
where you declare it invisible.

Different observers with different eyesight, different atmospheric conditions,
different resolutions would all see the sun disappear at different angles,
which means they'd all infer different distances. The model can't produce a
consistent sunset.

## The Code

For reference, here's the Python that generated the table:

```python
import math

h_miles = 3000
angles = [15, 10, 5, 2, 1, 0.5, 0.25, 0.1]

for a in angles:
    theta = math.radians(a)
    d = h_miles / math.tan(theta)
    print(f"{a:>6.2f}°  →  {d:>12,.0f} miles")
```

## What This Actually Shows

I didn't set out to debunk flat earth. I set out to build the model and see
where it worked and where it didn't. The angular speed part works fine: 15
degrees per hour is consistent with observation regardless of model. But the
sunset geometry is where the model falls apart.

On a globe, sunset is simple: the earth rotates, the horizon tilts up, and the
sun goes behind it. The geometry is clean, the cutoff is physical, and the
distances work out. On a flat plane, the sun never goes behind anything. It
just gets farther away. And because $\tan(\theta)$ is a brutal function near
zero, the distances it demands are absurd.

You can patch the model by adding "perspective," atmospheric extinction, or
some unknown refraction effect, but every patch has to fight the same math. The
sun is visible at very low angles, and the distance formula doesn't care about
your philosophy. It just gives you a number. And that number gets ugly fast.

That's the flat-earth sunset problem. The model can handle noon. It can handle
the sun's angular speed. It falls apart at the horizon, which is to say, it
falls apart at the exact moment it needs to explain something.

[^1]: The 3,000-mile sun height is a commonly cited figure in flat-earth communities, though there is no single agreed-upon value. Some proponents claim heights ranging from 3,000 to 4,000 miles. The exact value doesn't matter for this argument because the sensitivity problem scales linearly with $h$.
[^2]: The average Earth-Sun distance is approximately 1 AU, or 92,955,807 miles (149,597,870 km), as established by radar ranging and spacecraft telemetry. See: NASA, "Sun Fact Sheet," _Planetary Science_, NASA Space Science Data Coordinated Archive.
