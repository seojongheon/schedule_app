# Tech Stack Development Rules

This document defines the development rules that must be followed in this project, which uses Next.js App Router and Supabase as its core technology stack. The goal is to consistently ensure security, type safety, layer separation, and performance optimization.

## 1. Supabase Client Creation and Environment Isolation

### Separate Server and Browser Clients

- Strictly separate Supabase clients for browser and server environments according to the Next.js rendering environment.
- Use `createBrowserClient` in the browser environment.
- Manage the browser client as a singleton so it can be reused in Client Components.
- Use `createServerClient` in the server environment.
- In Server Components, Server Actions, and Route Handlers, create a new Supabase server client instance for each request.
- Configure the server client so authentication sessions are synchronized correctly through cookies.

### Environment Variables and Security

- Manage `NEXT_PUBLIC_SUPABASE_URL` as a public environment variable that may be exposed to the browser.
- Manage `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a public environment variable that may be exposed to the browser.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser because it is a powerful key that can bypass database security restrictions.
- Never add the `NEXT_PUBLIC_` prefix to `SUPABASE_SERVICE_ROLE_KEY`.
- Use `SUPABASE_SERVICE_ROLE_KEY` only in server environments such as Server Actions and Route Handlers, and only when strictly necessary.
- Do not reference the service role key in Client Components, browser bundles, or public configuration files.

## 2. Database Security and Row-Level Security

### Enable Row-Level Security

- Enable Row-Level Security for every Supabase database table immediately after the table is created.
- Do not use tables with Row-Level Security disabled in production code.
- Do not allow public access to table data without an appropriate security policy.

### Authentication-Based Data Access

- Restrict user-specific reads, creates, updates, and deletes based on the Supabase Auth session.
- Write security policies based on `auth.uid()` so users can access only the data they are allowed to access.
- Perform admin-only operations or service-role-key operations only in the server environment.
- Do not accept an arbitrary user ID from the client and use it to access data without authorization checks.

## 3. Type Safety

### Automatically Generate Schema Types

- Whenever the database table structure changes, generate TypeScript types with the Supabase CLI.
- Place generated schema type files somewhere they can be imported by the project type system.
- After migrations, regenerate types so the database schema and TypeScript types stay in sync.

### DTO Type Mapping

- When defining API response types and database query result types in the data layer, use Supabase-generated database types as the source for DTOs.
- Do not expose database row types directly to the presentation layer.
- Convert query results through mappers before returning domain entities.

```ts
import { Database } from '@/src/data/database.types';

export type ProductRow = Database['public']['Tables']['products']['Row'];
export type ProductInsert = Database['public']['Tables']['products']['Insert'];
export type ProductUpdate = Database['public']['Tables']['products']['Update'];
```

## 4. Supabase Isolation Within Clean Architecture Layers

### Restrict Supabase SDK Usage

- Use the Supabase SDK, Supabase client instances, and database query chaining only inside the data layer.
- Run Supabase queries only inside repository implementations under `src/data/repositories`.
- Do not import the Supabase SDK from `src/domain`.
- Do not reference Supabase clients directly from `src/presentation` components or hooks.
- Do not run Supabase queries directly from use cases.

### Required Domain Entity Conversion

- Do not return Supabase query results directly to outer layers.
- Always pass query results through mappers and convert them into pure domain entities.
- Domain entities must not depend directly on Supabase table structures or row types.
- The presentation layer should use domain entities or screen-specific view models only.

```ts
// Recommended flow
// Supabase row -> DTO -> mapper -> domain entity -> use case -> presentation
```

## 5. Migration Rules

### Migration Location

- Place Supabase migration files in the `supabase/migrations` folder.
- Manage database structure changes through migration files.

### User Approval Required

- Always get user approval before creating a new migration file.
- Always get user approval before modifying an existing migration file.
- Always get user approval before deleting an existing migration file.
- Do not make migration changes on your own because they can directly affect database state.

## 6. Implementation Checklist

- Are browser and server Supabase clients separated?
- Does the server environment create a new Supabase server client for each request?
- Is `SUPABASE_SERVICE_ROLE_KEY` kept out of the browser?
- Is Row-Level Security enabled on every table?
- Is user-specific data access restricted through policies based on `auth.uid()`?
- Were Supabase types regenerated after database changes?
- Are Supabase SDK calls restricted to `src/data/repositories`?
- Are Supabase query results converted through mappers into domain entities?
- Was user approval obtained before creating, modifying, or deleting migrations?
