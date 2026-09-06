---
title: 'The Blog Publishing Pipeline'
slug: the-blog-publishing-pipeline
publishDate: '2026-05-22'
description: 'A look at how andrewthecoder.com goes from idea to live — Astro, GitHub Actions, PM2, and a little help from AI along the way.'
categories: ['Software Development']
tags: ['astro', 'ci-cd', 'deployment', 'automation']
author: Andrew
comments_enabled: true
featured: true
image: '/assets/blog/the-blog-publishing-pipeline.webp'
---

Every blog has a publishing pipeline, whether you think about it or not. For some
people, that pipeline is "write a thing, hit publish, hope it works." For me,
it got more interesting when I decided to build andrewthecoder.com on Astro with
server-side rendering, deploy through GitHub Actions, and bring an AI assistant
named Tim into the workflow.

This post walks through how a blog post actually goes from idea to live on my
site. It's simpler than you might think, but there are enough moving parts that
it's worth laying out the whole thing.

## The Stack

Here's what powers the site:

- **Astro 7** in SSR mode with the Node.js adapter — pages render on the server,
  not at build time
- **Svelte** for interactive components (the stuff that needs client-side
  JavaScript)
- **Tailwind CSS v4** for styling
- **MDX** for blog content, with remark-gfm, remark-math, and rehype-katex for
  extended markdown
- **PM2** as the production process manager, running the Node server on port
  4321
- **GitHub Actions** for CI/CD — push to `main` and everything deploys
  automatically

All the blog posts live in `src/data/blog-posts/*.md`, each with YAML
frontmatter that defines the title, slug, publish date, description, category,
tags, and image path. The content schema is validated with Zod in Astro's
content config, so a bad frontmatter field gets caught early.

## From Idea to Markdown

The process starts the same way most blog posts start: with an idea. But the
path from idea to published article has a couple of waypoints worth
highlighting.

I work with an AI assistant called Tim to draft and refine posts. Tim handles
the mechanical parts — checking frontmatter conventions, making sure the slug
matches the filename, writing SEO descriptions, validating the style guide
against the category's tone rules. The result is a markdown file that fits
right into the existing collection.

This isn't about having AI write the content. The ideas, the voice, the
technical substance — that's mine. What Tim provides is editorial consistency
and a faster path from rough draft to publication-ready file. Think of it as a
very opinionated linter that also knows your style guide.

## The Frontmatter Contract

Every blog post file has a frontmatter block like this:

```yaml
---
title: 'Post Title Here'
slug: post-title-here
publishDate: '2026-05-22'
description: 'A specific, compelling description for SEO and previews.'
image: '/assets/blog/post-title-here.webp'
categories: ['Software Development']
tags: ['tag-one', 'tag-two']
author: Andrew
comments_enabled: true
featured: true
---
```

A few conventions worth noting:

- The **slug** always matches the filename (without the `.md` extension). If the
  file is `my-post.md`, the slug is `my-post`. This keeps routing clean and
  predictable.
- The **image** path always follows the pattern
  `/assets/blog/{slug}.webp`. Every post gets an image — no placeholders, no
  missing social cards.
- **Categories** are one of five: Software Development, Artificial Intelligence,
  Science, Theology, or Poetry. The `featured` flag defaults to `true` for
  Software Development and AI posts, `false` for everything else.
- **Tags** use kebab-case: `ci-cd` not `CI/CD`, `open-addressing` not
  `Open Addressing`.

This consistency isn't just aesthetics. It means the build system can trust the
data, and any script that processes posts — whether it's generating images or
checking for broken links — can rely on a stable structure.

## Image Generation

Blog post images are generated programmatically using fal.ai's Flux model. The
generation script reads the post's frontmatter, constructs a prompt based on
the category and tags, and outputs a 2048×1024 WebP image to
`public/assets/blog/{slug}.webp`.

Each category has its own visual style:

- **Software Development** gets clean, technical, blueprint-inspired visuals
- **Artificial Intelligence** leans abstract and neural
- **Science** is analytical and data-driven
- **Theology** goes for classical, contemplative imagery
- **Poetry** is atmospheric and expressive

The system also picks up content hints from tags and keywords in the post body,
so a post about hash tables doesn't get the same generic tech illustration as
one about backtracking algorithms. The prompt is reviewed before generation to
make sure it actually matches the content.

## The Deployment Pipeline

This is where it all comes together. The deployment pipeline is a single GitHub
Actions workflow triggered by a push to the `main` branch. Here's what it does:

1. **Checkout** the code from the repository
2. **Set up SSH** using a private key stored in GitHub Secrets
3. **Rsync** the entire project to the production server
4. **SSH into the server** and run the deploy script:
   - Switch to Node 25 via NVM
   - Run `npm ci` to install dependencies
   - Run `npm run astro build` to build the production bundle
   - Restart (or start) the PM2 process from `ecosystem.config.cjs`
   - Save the PM2 process list so it survives reboots
5. **Clean up** the SSH key

The whole thing takes about a minute. If the PM2 process is already running, it
gets restarted with `--update-env`. If it's not (like after a server reboot), it
gets started fresh. Either way, the site comes back up on port 4321.

There's no staging environment, no canary deploys, no blue-green switching. For
a personal blog, that complexity isn't justified. The trade-off is simple: if
something breaks, I fix it on `main` and push again.

## Local Development

Before anything hits production, it runs locally. The dev server is just:

```bash
npx astro dev --port 4321
```

Astro's dev server gives hot module replacement, so changes show up immediately.
When I'm verifying a new post, I curl the blog route to make sure it renders:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/blog/the-blog-publishing-pipeline/
```

A `200` response means the post renders and the dynamic route found it. I also
check that the image serves correctly:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/assets/blog/the-blog-publishing-pipeline.webp
```

If both return `200`, the post is ready to go.

## The Full Workflow, Start to Finish

Here's the complete sequence from idea to live:

1. **Draft** the post in markdown with proper frontmatter
2. **Review and edit** for spelling, grammar, tone, and style guide compliance
3. **Generate** the post image via fal.ai, review the prompt first
4. **Verify locally** — spin up the dev server, check that the post and image
   both serve with HTTP 200
5. **Commit** with a message like `feat: add "The Blog Publishing Pipeline" blog post`
6. **Push to `main`** — GitHub Actions takes over from here
7. **Live** — the site rebuilds and restarts on the server automatically

Total hands-on time from finished draft to live post: roughly two to three
minutes, most of which is waiting for the CI pipeline to finish building.

## Why This Setup Works

There are a thousand ways to run a blog. This one works for me because it's
minimal but not fragile. The moving parts are:

- A static markdown file per post (no database to maintain)
- A single Git branch (`main`) with push-to-deploy
- A single GitHub Actions workflow (no complex matrix builds)
- A single PM2 process on a single server (no Kubernetes, no containers)

The Astro SSR setup means I get dynamic features (like a joke API endpoint)
without needing a separate backend service. Everything stays in one repo, one
deployment, one process.

Could it be more sophisticated? Absolutely. Would it be better for it? Probably
not for a site this size. The whole point of a pipeline is to remove friction
between writing and publishing. When the process is simple enough that you
don't have to think about it, you publish more. And that's the real goal.

## Conclusion

A good publishing pipeline is one you don't have to think about. Astro, GitHub
Actions, PM2, and a little AI-assisted consistency checking combine to make
publishing on andrewthecoder.com nearly frictionless. Write the post, push the
commit, and the site takes care of itself. That's the whole trick — not a
complex system, but a simple one that works reliably every time.
