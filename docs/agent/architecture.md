# Clean Architecture Rules for the Store Dashboard Project

This document defines the clean architecture rules that must be followed in the store dashboard project built with Next.js App Router and TypeScript. The core goal is to separate business logic from Next.js, React, external APIs, databases, and UI libraries so the code remains maintainable, testable, and extensible.

## 1. Core Design Principles

### Dependency Rule

- Dependencies must always point inward toward the `domain` layer.
- Outer layers may depend on inner layers, but inner layers must never depend on outer layers.
- `src/domain` must contain only pure TypeScript code.
- `src/domain` must not import React, Next.js, Axios, fetch wrappers, UI libraries, or state management libraries.
- External data access must be abstracted through repository interfaces in the domain layer.

## 2. Directory Structure

Organize the main project code under `src` by architectural layer.

```txt
src/
├── domain/               # Domain layer: core business logic
│   ├── entities/         # Core data models
│   ├── use-cases/        # Business scenario implementations
│   └── repositories/     # Data access interfaces
│
├── data/                 # Data layer: external data access and infrastructure
│   ├── api/              # API clients, fetch wrappers, Axios instances
│   ├── dto/              # API request and response data structures
│   ├── mappers/          # DTO and Entity converters
│   └── repositories/     # Implementations of domain repository interfaces
│
├── presentation/         # Presentation layer: UI and client state management
│   ├── components/       # Shared React UI components
│   ├── hooks/            # UI state, events, and use-case bridge hooks
│   └── stores/           # Global state management
│
└── app/                  # Next.js App Router entry points
    ├── layout.tsx
    ├── page.tsx
    └── dashboard/
        └── page.tsx      # Composes presentation components into a page
```

## 3. Layer Responsibilities

### Domain Layer

The domain layer is the innermost layer and contains the essential business rules. It must not be affected by changes in frameworks, databases, HTTP communication, or UI.

- `entities`: Represent business concepts such as `Product`, `Order`, and `SalesSummary`.
- `use-cases`: Implement a single business flow, such as `GetDashboardSummary` or `CreateProduct`.
- `repositories`: Define only the interfaces for data input and output methods that the data layer must implement.
- Use cases must not call databases or APIs directly. They depend on repository interfaces instead.

### Data Layer

The data layer handles data sources such as network communication, local storage, and external APIs.

- `dto`: Declare backend API request and response shapes exactly as they are received or sent.
- `mappers`: Convert DTOs into domain entities, or convert entities into request DTOs.
- `repositories`: Implement repository interfaces declared in the domain layer.
- If the backend response shape changes, update only the mapper and data layer so the domain and presentation layers remain protected.

### Presentation Layer

The presentation layer handles the screens and client-side state that users interact with.

- `components`: Reusable UI components built with React and CSS or Tailwind CSS.
- `hooks`: Encapsulate complex UI state, event handling, and use-case invocation flows.
- `stores`: Manage client-side global state when needed.
- The presentation layer may call domain use cases, but domain rules must not be scattered throughout UI code.

### App Router Layer

The `app` directory is the entry point for routing and rendering.

- Pages compose the required repository implementations and use cases.
- Server Components may instantiate repository implementations and inject them into use cases.
- When client-side interaction is required, wrap use-case calls through presentation hooks.

## 4. Example: Weekly Sales Statistics

### Domain Entity

```ts
// src/domain/entities/SalesSummary.ts
export interface SalesSummary {
  totalSales: number;
  salesCount: number;
  formattedTotalSales: string;
}
```

### Domain Repository Interface

```ts
// src/domain/repositories/DashboardRepository.ts
import { SalesSummary } from '@/src/domain/entities/SalesSummary';

export interface DashboardRepository {
  getWeeklySales(): Promise<SalesSummary>;
}
```

### Domain Use Case

```ts
// src/domain/use-cases/GetWeeklySales.ts
import { SalesSummary } from '@/src/domain/entities/SalesSummary';
import { DashboardRepository } from '@/src/domain/repositories/DashboardRepository';

export class GetWeeklySales {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async execute(): Promise<SalesSummary> {
    return this.dashboardRepository.getWeeklySales();
  }
}
```

### Data DTO

```ts
// src/data/dto/DashboardResponseDto.ts
export interface DashboardResponseDto {
  weekly_total_amount: number;
  transaction_count: number;
}
```

### Data Mapper

```ts
// src/data/mappers/DashboardMapper.ts
import { DashboardResponseDto } from '@/src/data/dto/DashboardResponseDto';
import { SalesSummary } from '@/src/domain/entities/SalesSummary';

export class DashboardMapper {
  static toEntity(dto: DashboardResponseDto): SalesSummary {
    return {
      totalSales: dto.weekly_total_amount,
      salesCount: dto.transaction_count,
      formattedTotalSales: `${dto.weekly_total_amount.toLocaleString()} KRW`,
    };
  }
}
```

### Data Repository Implementation

```ts
// src/data/repositories/DashboardRepositoryImpl.ts
import { DashboardResponseDto } from '@/src/data/dto/DashboardResponseDto';
import { DashboardMapper } from '@/src/data/mappers/DashboardMapper';
import { SalesSummary } from '@/src/domain/entities/SalesSummary';
import { DashboardRepository } from '@/src/domain/repositories/DashboardRepository';

export class DashboardRepositoryImpl implements DashboardRepository {
  async getWeeklySales(): Promise<SalesSummary> {
    const response = await fetch('https://api.example.com/dashboard/weekly', {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard data.');
    }

    const data: DashboardResponseDto = await response.json();
    return DashboardMapper.toEntity(data);
  }
}
```

### Server Component Usage Example

```tsx
// src/app/dashboard/page.tsx
import { DashboardRepositoryImpl } from '@/src/data/repositories/DashboardRepositoryImpl';
import { GetWeeklySales } from '@/src/domain/use-cases/GetWeeklySales';

export default async function DashboardPage() {
  const dashboardRepository = new DashboardRepositoryImpl();
  const getWeeklySales = new GetWeeklySales(dashboardRepository);
  const salesSummary = await getWeeklySales.execute();

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>
      <div className="rounded bg-white p-4 shadow">
        <p className="text-gray-500">Weekly Sales Total</p>
        <p className="text-3xl font-semibold">{salesSummary.formattedTotalSales}</p>
        <p className="text-sm text-gray-400">Total transactions: {salesSummary.salesCount}</p>
      </div>
    </div>
  );
}
```

### Client Hook Usage Example

```ts
// src/presentation/hooks/useWeeklySales.ts
import { useEffect, useState } from 'react';
import { DashboardRepositoryImpl } from '@/src/data/repositories/DashboardRepositoryImpl';
import { SalesSummary } from '@/src/domain/entities/SalesSummary';
import { GetWeeklySales } from '@/src/domain/use-cases/GetWeeklySales';

export function useWeeklySales() {
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const repository = new DashboardRepositoryImpl();
        const useCase = new GetWeeklySales(repository);
        const result = await useCase.execute();
        setSales(result);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  return { sales, loading };
}
```

## 5. Import Rules

- Prefer the `@/` alias configured in `tsconfig.json`.
- Avoid deeply nested relative imports.

```ts
// Recommended
import { SalesSummary } from '@/src/domain/entities/SalesSummary';

// Avoid
import { SalesSummary } from '../../../../domain/entities/SalesSummary';
```

## 6. Implementation Checklist

- Does the domain layer avoid importing React, Next.js, HTTP clients, and state management libraries?
- Do use cases avoid calling APIs or databases directly?
- Do data-layer repository implementations implement domain repository interfaces?
- Are DTO-to-entity conversions centralized in mappers?
- Are business rules kept out of pages and components?
- Do import paths use the `@/` alias?
