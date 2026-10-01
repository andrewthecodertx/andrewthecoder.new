import { BaseController } from "./BaseController.js";

export class BlogController extends BaseController {
  constructor(ctx) {
    super(ctx);
  }

  index(req, res) {
    let posts = this.loadBlogPosts();

    let raw = posts.reduce((acc, post) => {
      const cats = post.meta.categories || ["Uncategorized"];
      cats.forEach((cat) => {
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(post);
      });
      return acc;
    }, {});

    // Stable category order: known categories first by rank, then alphabetical.
    let categoryOrder = {
      "Software Development": 1,
      Tutorials: 2,
      "Artificial Intelligence": 3,
      Science: 4,
      Theology: 5,
      Poetry: 6,
    };

    let postsByCategory = Object.fromEntries(
      Object.keys(raw)
        .sort((a, b) => {
          const ra = categoryOrder[a] ?? 999;
          const rb = categoryOrder[b] ?? 999;
          if (ra !== rb) return ra - rb;
          return a.localeCompare(b);
        })
        .map((cat) => [cat, raw[cat]]),
    );

    return res.render("blog/index", {
      pageTitle: "Blog",
      description: "Writing on code, philosophy, and tools.",
      active: "blog",
      postsByCategory,
    });
  }

  show(req, res) {
    let post = this.ctx.markdown.loadPost(req.params.slug);

    if (!post) {
      return res.status(404).render("errors/404", {
        pageTitle: "Post not found",
        active: "blog",
      });
    }

    let image = post.meta.image;

    return res.render("blog/show", {
      pageTitle: post.meta.title || req.params.slug,
      description: post.meta.description,
      active: "blog",
      post,
      pageImage: image,
      hasImage: this.assetExists(image),
    });
  }
}
