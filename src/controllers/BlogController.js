export class BlogController {
  rt;
  constructor(ctx) {
    this.ctx = ctx; // { view, markdown }
    this.posts = ctx.markdown.loadAllPosts();
  }

  index(req, res) {
    return res.render("blog/index", {
      pageTitle: "Blog",
      description: "Writing on code, philosophy, and tools.",
      active: "blog",
      posts: this.posts,
    });
  }

  show(req, res) {
    const post = this.ctx.markdown.loadPost(req.params.slug);
    if (!post) {
      return res.status(404).render("blog/not-found", {
        pageTitle: "Post not found",
        active: "blog",
      });
    }

    return res.render("blog/show", {
      pageTitle: post.meta.title || req.params.slug,
      description: post.meta.description,
      active: "blog",
      post,
    });
  }
}
