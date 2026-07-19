# Research: MVP scheduling performance optimization

## Decision: remove redundant refresh and broad revalidation from routine mutations

**Rationale**: Next.js documents that `router.refresh()` makes a new server request, refetches data, and rerenders Server Components. It also documents that calling `revalidatePath()` from a Server Function updates the affected current UI immediately and currently causes previously visited pages to refresh on later navigation. The current code already applies successful mutation results to local state, while all workspace pages are dynamically rendered. Repeating both mechanisms therefore recreates the full personalized read path without providing a freshness benefit for routine changes.

**Alternatives considered**:

- Keep `router.refresh()` and narrow only `revalidatePath()`: rejected because the explicit client refresh still refetches the current route.
- Add a client data-cache library: rejected because existing local state already represents the mutation results and the user excluded extra machinery.
- Cache authenticated routes: rejected because it creates personalized-cache risk and does not address duplicate work.

**Primary references**:

- [Next.js `useRouter` reference](https://nextjs.org/docs/app/api-reference/functions/use-router)
- [Next.js `revalidatePath` reference](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)

## Decision: use explicit page scopes while retaining the existing initial-data shape

**Rationale**: Separate scope inputs allow today, preliminary, mypage, and room detail to stop loading unrelated tables without requiring a new global state layer or a full UI rewrite. Returning the existing arrays keeps rendering and mutation behavior compatible. Explicit column lists reduce wire size and prevent future schema columns from silently expanding responses.

**Alternatives considered**:

- Keep one full loader and rely on the Korea region: rejected because request count and response size still grow with unrelated data.
- Create one loader per route with duplicated mapping: rejected because mapping and authorization behavior would drift.
- Return a different discriminated response type for every page immediately: deferred because it would force a broad client-component rewrite before measuring the high-value query reduction.

## Decision: keep dashboard schedules complete and scope the other routes first

**Rationale**: The current dashboard calendar navigates between weeks and months entirely in client state. Date-bounding its initial response without an on-demand range contract would silently hide schedules when the user navigates outside the loaded interval. Keeping dashboard behavior unchanged prevents a correctness regression while today, preliminary, mypage, room detail, and room list receive immediate scoped improvements.

**Alternatives considered**:

- Add calendar range fetching now: deferred because it adds API, loading, merge, deduplication, and error-recovery behavior beyond the MVP optimization.
- Apply an arbitrary rolling range: rejected because schedules outside that range would appear missing without explanation.

## Decision: use verified claims instead of repeated fresh Auth user-record lookups

**Rationale**: Supabase documents that `getClaims()` cryptographically verifies the JWT and, with asymmetric signing keys, usually uses WebCrypto plus a cached JWKS rather than calling the Auth user endpoint. It safely falls back to a server check when local verification is unavailable. The current resolved Supabase client is 2.110.0 and includes `getClaims()`. The profile and active-role records remain database-authorized, so a fresh Auth user record is unnecessary solely to obtain `sub` and `email` on every protected page.

**Alternatives considered**:

- Use `getSession()` identity directly: rejected because Supabase warns that cookie-backed session user data must not be trusted without claim or user verification.
- Remove middleware account-state lookup: rejected because it would change session-age and restricted-account enforcement across routes.
- Combine middleware and page profile reads through forwarded headers: rejected because it complicates the security boundary and makes request headers an identity transport.

**Primary references**:

- [Supabase `getClaims` reference](https://supabase.com/docs/reference/javascript/auth-getclaims)
- [Supabase server-side client guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&package-manager=npm&queryGroups=framework&queryGroups=package-manager)
- [Supabase advanced SSR Auth guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)

## Decision: do not add indexes or a bootstrap RPC in this feature

**Rationale**: The current schedule access path already has a composite `(room_id, start_at)` index, and no production query plan demonstrates an additional index requirement. A bootstrap RPC would require a migration and couple unrelated screens. Application-level round-trip and scope changes must be measured first.

**Alternatives considered**:

- Add indexes preemptively: rejected because unused indexes add write and maintenance cost.
- Aggregate all page data in one RPC: deferred until scoped requests remain a measured bottleneck.

**Primary reference**:

- [Supabase query optimization guide](https://supabase.com/docs/guides/database/query-optimization)

## Decision: measure with existing tools and fixed samples

**Rationale**: Browser network timing, response sizes, temporary request-count logging, and production build output are sufficient to compare the selected flows. Ten comparable samples and median values reduce single-run noise without adding analytics infrastructure.

**Alternatives considered**:

- Add a hosted observability product: rejected because it adds cost, data flow, and setup beyond the feature.
- Claim a percentage improvement from code inspection alone: rejected because deployment and test-data variance must be measured.
