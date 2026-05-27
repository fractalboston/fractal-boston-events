# Fix Command

This command runs the standard format-and-check loop to ensure code quality before finishing work. Run this as a final step after making changes.

## Workflow

This command automates the following loop:

1. Run `pnpm format` **(outside sandbox)**
2. Run `pnpm check` **(outside sandbox)**
3. Fix any lint errors or type issues. Ignore the url.parse() deprecation warning.
4. If any issues arose, go back to step 1 and restart this loop

## Step 1: Format Code

Format all code with Prettier:

```bash
pnpm format
```

**IMPORTANT: Run this outside the sandbox** if needed. This ensures all modified files are properly formatted.

## Step 2: Run Checks

Run all checks (types, format, lint, tests):

```bash
pnpm check
```

**IMPORTANT: Run this outside the sandbox** if needed. This will:
- Check TypeScript types
- Verify formatting
- Run ESLint
- Run tests

## Step 3: Fix Issues

IMPORTANT: Ignore the first url.parse() deprecation warning for the purposes of this step.

If `pnpm check` reports any errors:

1. **Type errors**: Fix TypeScript type issues
2. **Lint errors**: Fix ESLint violations
3. **Test failures**: Fix failing tests
4. **Format issues**: Re-run `pnpm format` (shouldn't happen if Step 1 completed)

## Step 4: Repeat if Needed

If any issues were found and fixed in Step 3, **restart from Step 1**:

1. Run `pnpm format` again
2. Run `pnpm check` again
3. Fix any remaining issues
4. Continue until `pnpm check` passes completely

## Completion

The loop is complete when:
- ✅ `pnpm format` runs successfully
- ✅ `pnpm check` passes with no errors
- ✅ All type checks pass
- ✅ All lint checks pass
- ✅ All tests pass

Only then should you consider the work complete and proceed to commit or create a PR.

## Important Notes

- **Always run outside sandbox** if the sandbox environment doesn't have access to `.env.local` or other required files
- **Never skip this step** - it's a mandatory part of the development workflow
- **Fix all issues** before proceeding - don't leave errors for later
- This command should be run **after every set of changes** before finishing work

## Troubleshooting

- **"pnpm: command not found"**: Make sure you're in the chatbot directory and pnpm is installed
- **Formatting issues persist**: Make sure you ran `pnpm format` outside the sandbox
- **Type errors**: Check that all imports are correct and types are properly defined
- **Lint errors**: Follow the project's ESLint rules (see `conventions.mdc`)
- **Test failures**: Fix the failing tests or update them if behavior changed intentionally
