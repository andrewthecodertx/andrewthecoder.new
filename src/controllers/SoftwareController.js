import { BaseController } from "./BaseController.js";

export class SoftwareController extends BaseController {
  constructor(ctx) {
    super(ctx);
  }

  demos(req, res) {
    return res.render("software/demos", {
      pageTitle: "Demos",
      description: "Interactive demos and experiments.",
      active: "demos",
      demos: this.loadDemos(),
    });
  }

  projects(req, res) {
    return res.render("software/projects", {
      pageTitle: "Projects",
      description: "Side projects.",
      active: "projects",
      projects: this.loadProjects(),
    });
  }

  demoShow(req, res) {
    const slug = req.params.slug;
    const demo = this.loadDemos().find((d) => slugFromUrl(d.url) === slug);

    if (!demo) {
      return res.status(404).render("software/not-found", {
        pageTitle: "Demo not found",
        active: "demos",
        kind: "demo",
      });
    }

    return res.render("software/show", {
      pageTitle: demo.name,
      description: `${demo.name} — ${demo.language} demo.`,
      active: "demos",
      item: { ...demo, slug },
    });
  }

  projectShow(req, res) {
    const slug = req.params.slug;
    const project = this.loadProjects().find(
      (p) => slugFromUrl(p.url) === slug,
    );

    if (!project) {
      return res.status(404).render("software/not-found", {
        pageTitle: "Project not found",
        active: "projects",
        kind: "project",
      });
    }

    return res.render("software/show", {
      pageTitle: project.name,
      description:
        project.description ||
        `${project.name} — ${project.language} project.`,
      active: "projects",
      item: { ...project, slug },
    });
  }
}

function slugFromUrl(url) {
  if (!url) return "";
  const parts = url.split("/");

  return parts[parts.length - 1];
}