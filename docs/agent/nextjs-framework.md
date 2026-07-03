# Next.js Framework Development Rules

This document defines the development rules that must be followed in this project to build robust, high-performance web applications with Next.js App Router and TypeScript.

## 1. Component Rendering Strategy

### Use Server Components by Default

- Use Server Components as the default choice when creating components.
- Server Components can safely fetch data on the server and reduce the client bundle size, improving initial loading performance.
- Do not add `"use client"` at the top of a file unless there is a clear need.

### Minimize Client Components

- Use Client Components only when React state hooks such as `useState`, `useEffect`, or `useReducer` are required.
- Use Client Components only when browser event listeners such as `onClick`, `onChange`, or `onSubmit` are required.
- Client Component files must declare the `"use client"` directive at the very top.
- Isolate only the interactive area as a Client Component.
- Place Client Components as close to the leaf nodes of the component tree as possible.

## 2. Readability and File Separation

### Single Responsibility

- Each component and function should have one clear responsibility.
- Use intuitive and descriptive variable, function, and component names.
- Write code that can be understood without relying on unnecessary comments.

### File Splitting Criteria

- Split a file by responsibility as soon as it becomes too large.
- If a component renders several distinct UI blocks, extract them into child components.
- When a component file starts to exceed roughly 200-300 lines, split internal logic into custom hooks or child UI components.
- Components used only by a specific page should be placed in that page folder's `_components` directory.

```txt
src/app/dashboard/
├── page.tsx
└── _components/
    ├── SalesSummaryCard.tsx
    └── RecentOrdersTable.tsx
```

## 3. Data Fetching and Optimization

### Parallel Data Fetching

- Avoid sequential execution when a page needs to fetch multiple independent pieces of business data.
- Do not create unnecessary waterfall delays.
- Run independent asynchronous work in parallel with `Promise.all` or `Promise.allSettled`.

```ts
const [salesSummary, recentOrders, lowStockProducts] = await Promise.all([
  getSalesSummary.execute(),
  getRecentOrders.execute(),
  getLowStockProducts.execute(),
]);
```

### Server Data Caching and Revalidation

- Use Next.js extended `fetch` options to configure caching according to the nature of the data.
- For dashboard data that does not change frequently, use the `revalidate` option to refresh cached data at an appropriate interval.
- For data that requires real-time accuracy, avoid caching or define a clear refresh strategy.

```ts
const response = await fetch('https://api.example.com/dashboard/summary', {
  next: { revalidate: 3600 },
});
```

## 4. Metadata and Search Optimization

### Page-Level Metadata

- Export a `metadata` object from each `page.tsx` or `layout.tsx` to keep browser tab titles consistent and support search optimization.
- Use `generateMetadata` for pages that need dynamic metadata.
- Use a title template in the root layout to avoid duplicated titles and descriptions.

```ts
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'A dashboard for monitoring store operations.',
};
```

```ts
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | Store Admin',
    default: 'Store Admin',
  },
  description: 'Store administration dashboard.',
};
```

## 5. Static Assets and Performance Optimization

### Image Optimization

- Use `next/image` instead of the native HTML `img` tag.
- Use `next/image` to reduce layout shift, optimize image size, and apply lazy loading.
- Specify predictable image dimensions with `width` and `height`, or use `fill` with a clearly sized parent container.

```tsx
import Image from 'next/image';

export function ProductThumbnail() {
  return (
    <Image
      src="/images/product-thumbnail.png"
      alt="Product thumbnail"
      width={120}
      height={120}
    />
  );
}
```

### Font Optimization

- Load external and local fonts with `next/font`.
- Use `next/font` to minimize layout shift during font loading.
- Configure project-wide fonts in the root layout.

```ts
import { Noto_Sans_KR } from 'next/font/google';

export const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  display: 'swap',
});
```

## 6. Implementation Checklist

- Is `"use client"` declared only in files that truly need it?
- Are components without browser events or React state kept as Server Components?
- Was the file split by responsibility when it began to exceed 200-300 lines?
- Are independent data requests run in parallel with `Promise.all` or `Promise.allSettled`?
- Is an appropriate caching and revalidation strategy applied to server data?
- Does each page or layout define metadata?
- Are images rendered with `next/image`?
- Are fonts loaded with `next/font`?
