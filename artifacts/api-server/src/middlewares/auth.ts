import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { db, membershipsTable } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      clerkUserId?: string;
      salonId?: string;
      salonRole?: string;
    }
  }
}

export const requireAuthenticatedUser: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  req.clerkUserId = userId;
  next();
};

export const requireSalonMembership: RequestHandler = async (
  req,
  res,
  next,
): Promise<void> => {
  if (!req.clerkUserId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [membership] = await db
    .select({
      salonId: membershipsTable.salonId,
      role: membershipsTable.role,
    })
    .from(membershipsTable)
    .where(eq(membershipsTable.clerkUserId, req.clerkUserId))
    .limit(1);

  if (!membership) {
    res.status(404).json({ error: "Salon onboarding is required" });
    return;
  }

  req.salonId = membership.salonId;
  req.salonRole = membership.role;
  next();
};

export function requireSalonRoles(...roles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.salonRole || !roles.includes(req.salonRole)) {
      res.status(403).json({ error: "Insufficient salon permissions" });
      return;
    }
    next();
  };
}

export async function findSalonMembership(clerkUserId: string) {
  const [membership] = await db
    .select({
      salonId: membershipsTable.salonId,
      role: membershipsTable.role,
    })
    .from(membershipsTable)
    .where(and(eq(membershipsTable.clerkUserId, clerkUserId)))
    .limit(1);
  return membership;
}
