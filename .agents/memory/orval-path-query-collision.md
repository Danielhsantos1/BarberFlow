---
name: Orval path-and-query parameter collision
description: Workaround for duplicate generated parameter symbols in this workspace's Orval setup.
---

When a GET operation combines path parameters with query parameters, Orval can emit conflicting generated `*Params` symbols in the Zod and TypeScript outputs. Moving filter inputs into a referenced POST body avoids the collision when POST is semantically appropriate.

**Why:** The collision prevented codegen's required library typecheck from completing; changing the contract shape resolved it without editing generated output.

**How to apply:** If generated `*Params` exports collide, inspect whether that operation combines path and query parameters. Prefer a referenced request-body schema for a search/check operation when the HTTP semantics allow it, then rerun codegen.
