export class SoftwareController {
  constructor(ctx) {
    this.ctx = ctx; // { view, markdown }
  }

  demos(req, res) {
    return res.render("software/demos", {
      pageTitle: "Demos",
      description: "Interactive demos and experiments.",
      active: "demos",
      demos: this.demoList(),
    });
  }

  projects(req, res) {
    return res.render("software/projects", {
      pageTitle: "Projects",
      description: "Side projects.",
      active: "projects",
      projects: this.projectList(),
    });
  }

  // Static for now; will read from a data file later.
  demoList() {
    return ["conway", "mandelbrot", "wordle", "sudoku", "enigma"];
  }

  projectList() {
    return ["arc", "enchanter", "erwinmvc", "imsai"];
  }
}
