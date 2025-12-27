import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  console.error('[TRACE] requireUser middleware start');
  const { ctx, next } = opts;

  console.error('[TRACE] requireUser - ctx.user exists:', !!ctx.user);
  if (!ctx.user) {
    console.error('[TRACE] requireUser - ERROR: ctx.user is null/undefined');
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  console.error('[TRACE] requireUser - calling next()');
  try {
    const result = await next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
    console.error('[TRACE] requireUser - next() completed successfully');
    return result;
  } catch (err) {
    console.error('[TRACE] requireUser - ERROR in next():', err);
    console.error('[TRACE] requireUser - error type:', err instanceof Error ? err.constructor.name : typeof err);
    console.error('[TRACE] requireUser - error message:', err instanceof Error ? err.message : String(err));
    console.error('[TRACE] requireUser - error stack:', err instanceof Error ? err.stack : 'No stack trace');
    throw err;
  }
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
