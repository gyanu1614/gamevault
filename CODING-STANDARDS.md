# GameVault Coding Standards & Best Practices

## File Size Rules

### CRITICAL: Maximum Line Count
- **Maximum file size**: 500-600 lines
- **Ideal file size**: 200-400 lines
- **Action required**: Any file exceeding 600 lines MUST be refactored immediately

### When to Split Files

**Indicators that a file needs splitting**:
- File exceeds 500 lines
- Multiple distinct responsibilities in one file
- Difficult to find specific functionality
- Too many imports at the top
- Scrolling required to understand the file

## Component Organization

### Directory Structure (Industry Standard)

```
/src/app/[feature]/
├── page.tsx                    # Route entry point (~100-200 lines)
├── components/
│   ├── Feature1.tsx           # Main components (~300-500 lines)
│   ├── Feature2.tsx
│   └── shared/                # Reusable components
│       ├── Button.tsx         (~50-150 lines)
│       └── Card.tsx
├── schemas/
│   └── validation.ts          # Zod schemas
├── constants/
│   └── index.ts               # Constants and config
├── types/
│   └── index.ts               # TypeScript types
├── hooks/
│   └── useFeature.ts          # Custom hooks
└── utils/
    └── helpers.ts             # Utility functions
```

### Grouping Strategy

**DO**: Group related functionality together
- Steps 1-2 together (related forms)
- Steps 3-4 together (related processes)
- Steps 5-6 together (final steps)

**DON'T**: Create files that are too granular
- Avoid 20-line components in separate files
- Avoid over-engineering simple features
- Avoid too many nested directories

## File Naming Conventions

### Component Files
- Use PascalCase: `SellerRegistration.tsx`, `UserProfile.tsx`
- Be descriptive: `SellerRegistrationSteps12.tsx` (NOT `page.tsx`, `component.tsx`)
- Group indication: `Steps12.tsx`, `Steps34.tsx`

### Utility Files
- Use camelCase: `formatters.ts`, `validators.ts`
- Be specific: `dateHelpers.ts` (NOT `utils.ts`, `helpers.ts`)

### Schema Files
- Use descriptive names: `sellerRegistration.schema.ts`
- Group related: `userSchemas.ts`, `productSchemas.ts`

## Component Design Patterns

### Separation of Concerns

**Bad Example** (Everything in one file):
```tsx
// page.tsx - 2400 lines ❌
export default function Page() {
  // All schemas, constants, components, logic
}
```

**Good Example** (Separated):
```tsx
// page.tsx - 150 lines ✓
import { Steps12 } from './components/Steps12'
import { Steps34 } from './components/Steps34'
import { schemas } from './schemas'

export default function SellerRegistration() {
  // Only orchestration logic
}
```

### Component Size Guidelines

| Component Type | Ideal Size | Max Size | Action if Exceeded |
|---------------|------------|----------|-------------------|
| Page component | 100-200 | 300 | Extract sections |
| Feature component | 200-400 | 600 | Split into sub-components |
| Shared component | 50-150 | 200 | Simplify or split |
| Utility file | 100-300 | 400 | Split by domain |
| Schema file | 100-200 | 300 | Split by feature |

## Code Quality Standards

### Validation
- Always use Zod for form validation
- Define schemas in separate files
- Use TypeScript type inference: `type FormData = z.infer<typeof schema>`

### State Management
- Use React Hook Form for forms
- Keep state close to where it's used
- Lift state only when necessary

### Styling
- Use Tailwind CSS utility classes
- Keep responsive breakpoints consistent: sm:, md:, lg:
- Use design tokens for colors, spacing, etc.

### Performance
- Lazy load heavy components
- Use React.memo() for expensive renders
- Optimize images (next/image)
- Code split large features

## Import Organization

### Order of Imports
```tsx
// 1. React and Next.js
import { useState } from 'react'
import Image from 'next/image'

// 2. External libraries
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

// 3. Internal components
import { Button } from '@/components/ui/button'

// 4. Local components
import { Steps12 } from './components/Steps12'

// 5. Types and schemas
import { schemas } from './schemas'
import type { FormData } from './types'

// 6. Constants and utilities
import { GAMES, LANGUAGES } from './constants'
import { formatDate } from './utils'
```

## Documentation Standards

### Component Documentation
```tsx
/**
 * SellerRegistrationSteps12
 *
 * Handles Step 1 (Eligibility) and Step 2 (Business Information)
 * of the seller registration process.
 *
 * @param currentStep - Current step number (1 or 2)
 * @param onStepComplete - Callback when step is completed
 * @param formData - Existing form data (for editing)
 */
```

### File Headers
```tsx
/**
 * Seller Registration - Steps 1 & 2
 *
 * Step 1: Eligibility & Intent
 * - Age verification
 * - Seller type selection
 * - Game selection
 *
 * Step 2: Business Information
 * - Personal/Business details
 * - Contact information
 */
```

## TypeScript Standards

### Type Definitions
- Define types in separate `types/` directory
- Use interfaces for object shapes
- Use types for unions and intersections
- Export all public types

### Type Safety
- Avoid `any` type (use `unknown` if needed)
- Enable strict mode in tsconfig.json
- Use proper typing for props and state

## Testing Standards

### File Organization
```
/src/app/seller/register/
├── components/
│   ├── Steps12.tsx
│   └── __tests__/
│       └── Steps12.test.tsx
```

### What to Test
- User interactions (form submission, clicks)
- Validation logic
- Conditional rendering
- Error states
- Edge cases

## Git Commit Standards

### Commit Message Format
```
type(scope): short description

Longer description if needed

- Additional context
- Breaking changes
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `style`: Formatting changes
- `docs`: Documentation
- `test`: Adding tests
- `chore`: Maintenance

### Examples
```
feat(seller): add steps 5-6 to registration
refactor(seller): split page.tsx into grouped components
fix(upload): resolve file size validation issue
```

## Performance Checklist

- [ ] Files under 600 lines
- [ ] Components properly memoized
- [ ] Images optimized
- [ ] Lazy loading implemented
- [ ] No unnecessary re-renders
- [ ] Proper code splitting
- [ ] Bundle size monitored

## Accessibility Checklist

- [ ] Semantic HTML used
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Focus management proper
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader tested

## Security Checklist

- [ ] Input validation (client + server)
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] File upload validation
- [ ] Rate limiting
- [ ] Environment variables for secrets
- [ ] No sensitive data in client code

## Common Mistakes to Avoid

### 1. Monolithic Files
❌ **Don't**: Put everything in one 2000+ line file
✓ **Do**: Split into logical 300-500 line components

### 2. Generic Naming
❌ **Don't**: `page.tsx`, `component.tsx`, `utils.ts`
✓ **Do**: `SellerRegistration.tsx`, `UserProfile.tsx`, `dateHelpers.ts`

### 3. Props Drilling
❌ **Don't**: Pass props through 5+ levels
✓ **Do**: Use context or state management

### 4. Mixed Responsibilities
❌ **Don't**: UI logic + business logic + data fetching in one component
✓ **Do**: Separate concerns into different files/hooks

### 5. No Validation
❌ **Don't**: Accept any user input without validation
✓ **Do**: Validate with Zod schemas

## Key Takeaways

1. **500-600 line maximum** - Non-negotiable
2. **Descriptive naming** - Files should explain their purpose
3. **Group related features** - But don't over-engineer
4. **Separate concerns** - UI, logic, schemas, constants
5. **Industry standards** - Follow React/Next.js best practices
6. **Code quality over speed** - Take time to structure properly
7. **Documentation matters** - Future you (and teammates) will thank you

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Best Practices](https://react.dev/learn)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zod Validation](https://zod.dev/)
- [React Hook Form](https://react-hook-form.com/)

---

**Remember**: Good code is not about being clever, it's about being clear, maintainable, and following standards.

**Last Updated**: 2026-01-24
