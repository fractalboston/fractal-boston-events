---
alwaysApply: true
---

# Coding Conventions & Commands

## Essential Commands

- `yarn dev` - Start dev server (port 3002)
- `yarn build` - Build for production
- `yarn check` - Run types, format, lint, tests. **ALWAYS RUN OUTSIDE SANDBOX**
- `yarn check:types` - Run type checks only
- `yarn format` - Format code with Prettier (run after changes)
- `yarn test` - Run tests with Vitest
- `yarn lint` - Run ESLint

**Never use `npm` or `npx`. Always use `yarn`.**

**Do not run yarn commands in the sandbox** - they often fail due to missing .env.local access.

## Automatic Formatting

**CRITICAL: After making ANY file changes, you MUST run `yarn format` to format all modified files.**

This is a mandatory step that must happen after every response where files are edited. The workflow is:
1. Make code changes
2. **IMMEDIATELY run `yarn format`** to format the modified files
3. Only then consider the task complete

Do not skip this step. Formatting ensures code consistency and prevents lint errors.

## TypeScript Patterns

### Use `type` instead of `interface`

```typescript
// ✅ Good
type UserData = {
  id: number;
  name: string;
  email?: string;
};

// ❌ Bad
interface UserData {
  id: number;
  name: string;
}
```

### FORBIDDEN: Type Assertions

**NEVER use `as never`, `as any`, or `as unknown`!**

```typescript
// ❌ FORBIDDEN
const value = something as any;
const value = something as never;
const value = something as unknown;
```

Fix actual type mismatches by using proper generics, importing correct types, or adjusting function signatures.

### Validate External Data with Zod

Use Zod to parse and validate all external data (fetch() responses, request params, tool outputs).

```typescript
// ✅ Good - validates fetch response with Zod
const responseSchema = z.object({
  data: z.object({
    items: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

const response = await fetch(url);
const rawData = await response.json();
const parsed = responseSchema.safeParse(rawData);
if (!parsed.success) {
  throw new Error(`Response validation failed: ${parsed.error.message}`);
}
const data = parsed.data;

// ❌ Bad - no validation, unsafe access
const response = await fetch(url);
const data = await response.json();
return data.data?.items || [];
```

Always use `.safeParse()` for fetch responses to handle validation errors gracefully. Never access response data without validation.

### Avoid Unnecessary Re-exports

**Do not re-export functions or types from one file to another unless there's a clear architectural reason.**

Re-exports add indirection and make it harder to understand where code actually lives. Import directly from the source file instead.

```typescript
// ❌ Bad - unnecessary re-export
// src/app/actions.ts
export { generateIssueTitle } from "~/lib/feedback/generateIssueTitle";

// ✅ Good - import directly from source
import { generateIssueTitle } from "~/lib/feedback/generateIssueTitle";
```

**Valid reasons for re-exports:**
- Creating a public API surface (e.g., `index.ts` files that aggregate related exports)
- Barrel exports for convenience (e.g., `~/lib/utils` exporting multiple utility functions)
- Wrapping or extending functionality before re-exporting

## React Patterns

### Use Named Imports

```typescript
// ✅ Good
import { useEffect, useState, useCallback } from "react";

// ❌ Bad
import React from "react";
// then React.useState, React.useEffect...
```

### Use Function Declarations

```typescript
// ✅ Good
function SendEthButton() {
  return <div>...</div>;
}

// ❌ Bad
const SendEthButton = () => {
  return <div>...</div>;
};
```

**Exception:** Arrow functions are fine for callbacks and short inline utilities:

```typescript
users.map((user) => user.name);
onClick={(e) => handleClick(e)}
const isValid = (value: string) => value.length > 0;
```

## File Naming

- ✅ Always use **camelCase** filenames
- ❌ Never use snake_case


## Comments

Use comments very sparingly. Only add comments when they point out something not evident from the code.

**Avoid obvious comments:**
- ❌ Don't state what the code does: `// Filter out archived chats`, `// Archive Confirmation Modal`
- ✅ Explain why, not what: Complex business logic, non-obvious workarounds, or important gotchas

## Writing Scripts

When writing scripts in `~/scripts`, import normally. But if you get env var errors (from files using env-var package), use dynamic imports:

```typescript
// ❌ Env vars may not be set
import { getAgentByUuid } from "~/lib/agent";

// ✅ Dynamic import ensures env vars are loaded
const { getAgentByUuid } = await import("~/lib/agent");
```

## Creating Cursor Commands

When creating new cursor command files (`.md` files in `.cursor/commands/`), put them into the local chatbot `.cursor` dir and not the higher repo-wide .cursor dir.

## Environment Variables

**When adding a new environment variable to the codebase, you MUST also add it to `.env.example` with a placeholder value or comment explaining what it's for.**

This ensures that:
- Other developers know what environment variables are needed
- The project documentation stays up to date
- New team members can set up their local environment correctly

Example:
```bash
# .env.example
FEEDBACK_SLACK_WEBHOOK_URL=
```

### Using `.required()` for Required Environment Variables

Always use `.required()` in the `env.get()` chain for required environment variables instead of manual error throwing. This provides better error messages and follows the established pattern.

```typescript
// ✅ Good - uses .required()
const apiKey = env.get("LINEAR_API_KEY").required().asString();

// ❌ Bad - manual check
const apiKey = env.get("LINEAR_API_KEY").asString();
if (!apiKey) {
  throw new Error("LINEAR_API_KEY environment variable is not configured.");
}
```

The `.required()` method will automatically throw a descriptive error if the environment variable is missing, eliminating the need for manual null checks and error messages.

