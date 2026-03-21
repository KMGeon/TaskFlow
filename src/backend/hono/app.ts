import { Hono } from 'hono';
import { errorBoundary } from '@/backend/middleware/error';
import { withAppContext } from '@/backend/middleware/context';
import { withSupabase } from '@/backend/middleware/supabase';
import { registerExampleRoutes } from '@/features/example/backend/route';
import { registerTaskRoutes } from '@/features/kanban/backend/route';
import { registerSseRoute } from '@/features/kanban/backend/sse-route';
import type { AppEnv } from '@/backend/hono/context';

let singletonApp: Hono<AppEnv> | null = null;

export const createHonoApp = () => {
  if (singletonApp) {
    return singletonApp;
  }

  const app = new Hono<AppEnv>();

  // Task routes: file-based, no Supabase required
  registerTaskRoutes(app);
  registerSseRoute(app);

  // Supabase-dependent routes (scoped middleware)
  app.use('/example/*', errorBoundary());
  app.use('/example/*', withAppContext());
  app.use('/example/*', withSupabase());
  registerExampleRoutes(app);

  singletonApp = app;

  return app;
};
