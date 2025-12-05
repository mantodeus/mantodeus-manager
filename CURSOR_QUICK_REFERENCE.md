# Cursor AI Quick Reference - Backend Development

## 🚀 Quick Commands

```bash
# Start dev server (auto-reloads on changes)
npm run dev

# Type check
npm run check

# Run tests
npm test

# Format code
npm run format

# Database migration
npm run db:push
```

## 📁 Key File Locations

| What | Where |
|------|-------|
| Main tRPC Router | `server/routers.ts` |
| Database Queries | `server/db.ts` |
| Database Schema | `drizzle/schema.ts` |
| tRPC Setup | `server/_core/trpc.ts` |
| Auth Context | `server/_core/context.ts` |
| Geocoding | `server/_core/geocoding.ts` |
| Storage (S3) | `server/storage.ts` |
| Image Processing | `server/_core/imagePipeline.ts` |

## 🔧 Common Code Snippets

### Create a New tRPC Endpoint

```typescript
// In server/routers.ts or server/*Router.ts
import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const myRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createMyEntity({
        ...input,
        createdBy: ctx.user.id,
      });
      return { success: true, id: result[0].insertId };
    }),
});
```

### Add Database Query Function

```typescript
// In server/db.ts
import { eq } from "drizzle-orm";
import { myTable, type InsertMyEntity } from "../drizzle/schema";

export async function createMyEntity(data: InsertMyEntity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(myTable).values(data);
}

export async function getMyEntityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select()
    .from(myTable)
    .where(eq(myTable.id, id))
    .limit(1);
  return result[0];
}
```

### Add Database Table

```typescript
// In drizzle/schema.ts
import { int, varchar, text, timestamp, mysqlTable, index } from "drizzle-orm/mysql-core";
import { users } from "./schema"; // Import users for FK reference

export const myTable = mysqlTable("my_table", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("my_table_createdBy_idx").on(table.createdBy),
]);

export type MyEntity = typeof myTable.$inferSelect;
export type InsertMyEntity = typeof myTable.$inferInsert;
```

### Geocoding Integration

```typescript
import { geocodeAddress } from "./_core/geocoding";

// In create/update mutation
let latitude: string | undefined;
let longitude: string | undefined;
if (input.address) {
  const geocodeResult = await geocodeAddress(input.address);
  if (geocodeResult) {
    latitude = geocodeResult.latitude;
    longitude = geocodeResult.longitude;
  }
}

// Use in DB call
await db.createMyEntity({
  ...input,
  latitude,
  longitude,
});
```

### File Upload (Images)

```typescript
import { processAndUploadImageVariants } from "./_core/imagePipeline";
import { shouldProcessImage } from "./_core/imageProcessing";

// In upload mutation
if (!shouldProcessImage(mimeType, filename)) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Only images supported",
  });
}

const buffer = Buffer.from(base64Data, "base64");
const metadata = await processAndUploadImageVariants(buffer, { projectId });

await db.createImage({
  fileKey: metadata.variants.full.key,
  url: metadata.variants.full.url,
  filename,
  mimeType: metadata.mimeType,
  fileSize: metadata.variants.full.size,
  imageMetadata: metadata,
  uploadedBy: ctx.user.id,
});
```

### File Upload (Other Files)

```typescript
import { generateFileKey, createPresignedUploadUrl } from "./storage";

// Get presigned URL for direct upload
const fileKey = generateFileKey("prefix", ctx.user.id, filename);
const { uploadUrl, publicUrl } = await createPresignedUploadUrl(fileKey, mimeType);

// Client uploads directly, then calls confirmUpload mutation
```

### Error Handling

```typescript
import { TRPCError } from "@trpc/server";

// Not found
if (!entity) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Entity not found",
  });
}

// Validation error
if (!isValid) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Invalid input: reason",
  });
}

// Unauthorized (usually handled by protectedProcedure)
throw new TRPCError({
  code: "UNAUTHORIZED",
  message: "Not authenticated",
});
```

## 🎯 Type Patterns

### Drizzle Types
```typescript
// From schema
import { myTable } from "../drizzle/schema";
type MyEntity = typeof myTable.$inferSelect;      // Read type
type InsertMyEntity = typeof myTable.$inferInsert; // Insert type
```

### Zod Schemas
```typescript
import { z } from "zod";

// Common patterns
const idSchema = z.object({ id: z.number() });
const nameSchema = z.string().min(1);
const optionalString = z.string().optional();
const dateSchema = z.date();
const enumSchema = z.enum(["value1", "value2"]);
```

## 🔐 Authentication Patterns

```typescript
// Access current user
const userId = ctx.user.id;
const userRole = ctx.user.role; // "user" | "admin"

// Check ownership
if (entity.createdBy !== ctx.user.id && ctx.user.role !== "admin") {
  throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
}
```

## 📊 Database Query Patterns

```typescript
import { eq, and, desc, sql } from "drizzle-orm";

// Select one
const result = await db.select()
  .from(table)
  .where(eq(table.id, id))
  .limit(1);
return result[0];

// Select many with filters
const results = await db.select()
  .from(table)
  .where(and(
    eq(table.createdBy, userId),
    eq(table.status, "active")
  ))
  .orderBy(desc(table.createdAt));

// Insert
const result = await db.insert(table).values(data);
const insertId = result[0].insertId;

// Update
await db.update(table)
  .set({ name: "New Name" })
  .where(eq(table.id, id));

// Delete
await db.delete(table).where(eq(table.id, id));
```

## 🎨 Naming Conventions

- **Tables**: Plural, snake_case (`users`, `project_jobs`)
- **Types**: Singular, PascalCase (`User`, `ProjectJob`)
- **Functions**: camelCase (`createUser`, `getUserById`)
- **Files**: camelCase for utilities, PascalCase for components
- **Constants**: UPPER_SNAKE_CASE (`COOKIE_NAME`, `DATABASE_URL`)

## 🐛 Debugging Checklist

1. ✅ Check env vars in `server/_core/env.ts`
2. ✅ Verify database connection: `await getDb()`
3. ✅ Check user auth: `ctx.user` in protectedProcedure
4. ✅ Validate input: Zod schema errors
5. ✅ Check S3 credentials and bucket permissions
6. ✅ Verify foreign key relationships exist
7. ✅ Check database indexes for performance

## 📝 Common Mistakes to Avoid

1. ❌ Don't use `any` types - use proper Drizzle types
2. ❌ Don't forget to add `.notNull()` for required fields
3. ❌ Don't skip input validation with Zod
4. ❌ Don't forget to check ownership before updates/deletes
5. ❌ Don't hardcode user IDs - use `ctx.user.id`
6. ❌ Don't forget indexes for frequently queried fields
7. ❌ Don't catch errors unnecessarily - let them bubble up

## 🔄 Migration Workflow

```bash
# 1. Edit schema.ts
# 2. Generate migration
npm run db:push

# 3. Review generated SQL in drizzle/migrations/
# 4. Test locally
npm run dev

# 5. Deploy migration to production
```

## 💡 Pro Tips

1. **Use TypeScript strict mode** - catches errors early
2. **Leverage Drizzle type inference** - less manual typing
3. **Use Zod for runtime validation** - type-safe inputs
4. **Follow existing patterns** - consistency is key
5. **Add indexes early** - better performance
6. **Test with real data** - catch edge cases
7. **Use descriptive error messages** - easier debugging
