export class HomeController {
  constructor(ctx) {
    this.ctx = ctx; // { view, markdown }
  }

  index(req, res) {
    return res.render("home/index", {
      description: "Software developer with 25+ years building things.",
      active: "home",
    });
  }

  about(req, res) {
    return res.render("home/about", {
      pageTitle: "About",
      description: "About Andrew Erwin.",
      active: "about",
    });
  }

  challenges(req, res) {
    return res.render("home/challenges", {
      pageTitle: "Challenges",
      description: "Coding challenges and solutions.",
      active: "challenges",
    });
  }
}
