import express from "express"
import type {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
  Layer,
  RouteLayer
} from "express";
import logger from "./logger";

/** Wrap async handlers so errors go to next() */
const asyncWrapper = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/** Rough check for Express Router internals */
const isExpressRouter = (obj: unknown): obj is Router => 
  typeof obj === "function" && Array.isArray((obj as Router).stack)

/** Recursively wrap all handlers inside a router */
const wrapRouter = (router: Router): void => {
  router.stack.forEach((layer: Layer) => {
    // Routes like router.get/post
    if (layer.route) {
      layer.route.stack.forEach((routeLayer: RouteLayer) => {
        routeLayer.handle = asyncWrapper(routeLayer.handle);
      });
    }

    // Nested routers
    if (layer.name === "router" && layer.handle?.stack) {
      wrapRouter(layer.handle);
    }

    logger.deepDebug(layer.route.path)
  });
};

/** Shape for array-based routes */
type RouteDef = {
  method: keyof Router;
  path: string;
  handler: RequestHandler;
};

/** Each route loader returns either a Router or RouteDef[] */
type RouteModule =
  | Router
  | RouteDef[];

type RouteLoader = () => Promise<RouteModule>;

export default async function mountRoutes(
  routes: RouteLoader[]
): Promise<Router> {
  const router = express.Router();

  for (const route of routes) {
    const routeModule = await route();

    if (isExpressRouter(routeModule)) {
      wrapRouter(routeModule);
      router.use(routeModule);
      continue;
    }

    if (Array.isArray(routeModule)) {
      routeModule.forEach((r) => {
        router[r.method](r.path, asyncWrapper(r.handler));
      });
      continue;
    }

    throw new Error(`Invalid route module return type: ${typeof routeModule}`);
  }

  return router;
}
