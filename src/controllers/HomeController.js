import { BaseController } from "./BaseController.js";

export class HomeController extends BaseController {
  constructor(ctx) {
    super(ctx);
  }

  index(req, res) {
    const recentposts = this.loadBlogPosts(4, true);
    const projects = this.loadProjects();
    const demos = this.loadDemos(4);

    return res.render("home/index", {
      description: "Software developer with 25+ years building things.",
      active: "home",
      recentposts: recentposts,
      projects: projects,
      demos: demos,
    });
  }

  challenges(req, res) {
    return res.render("home/challenges", {
      pageTitle: "Challenges",
      description: "Coding challenges and solutions.",
      active: "challenges",
    });
  }

  playground(req, res) {
    return res.render("home/playground", {
      pageTitle: "Playground",
      description: "Scratchpad for new ideas.",
      active: "playground",
    });
  }
}
