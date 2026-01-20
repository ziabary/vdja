const express = require("express");

const asyncWrapper = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const isExpressRouter = (obj) => {
  return typeof obj === "function" && Array.isArray(obj.stack);
};

const wrapRouter = (router) => {
  router.stack.forEach((layer) => {
    // Routes like router.get/post
    if (layer.route) {
      layer.route.stack.forEach((routeLayer) => {
        routeLayer.handle = asyncWrapper(routeLayer.handle);
      });
    }

    // Nested routers
    if (layer.name === "router" && layer.handle?.stack) {
      wrapRouter(layer.handle);
    }
  });
};

async function mountRoutes(routes) {
  const router = express.Router();

  for (const route of routes) {
    const routeModule = await route();

    if (isExpressRouter(routeModule)) {
      wrapRouter(routeModule); // 🔥 THIS IS THE FIX
      router.use(routeModule);
      continue;
    }

    if (Array.isArray(routeModule)) {
      routeModule.forEach((r) => {
        router[r.method](r.path, asyncWrapper(r.handler));
      });
      continue;
    }

    throw new Error(
      `Invalid route module return type: ${typeof routeModule}`
    );
  }

  return router;
}

module.exports = mountRoutes;