/**
 * controllers/index.js — controller registry.
 *
 * Owns the controller inventory so server.js (bootstrap) doesn't hardcode it.
 * Routes.json names controllers by string; this map resolves those names to
 * instances. Adding a controller = add its class here, then add routes.
 */
import { HomeController } from "./HomeController.js";
import { BlogController } from "./BlogController.js";
import { SoftwareController } from "./SoftwareController.js";

export function loadControllers(ctx) {
  const controllers = {};
  for (const [name, Ctor] of Object.entries({
    home: HomeController,
    blog: BlogController,
    software: SoftwareController,
  })) {
    controllers[name] = new Ctor(ctx);
  }

  return controllers;
}