// Superfície pública de @recomenda/config.
//
// INVARIANTE: `env.server` NUNCA entra aqui. Quem precisa de `API_INTERNAL_URL`
// ou `JWT_SECRET` importa `@recomenda/config/server`, que é server-only.

export { publicEnv } from "./env.public";

export { routes, withQuery, type RouteContext } from "./routes";
