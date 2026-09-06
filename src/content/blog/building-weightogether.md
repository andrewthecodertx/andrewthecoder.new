---
title: 'Building WeighTogether Without Heavy Frameworks'
slug: building-weightogether
publishDate: '2026-01-01'
description: 'A technical deep dive into WeighTogether, a full-stack weight loss tracking application built with TypeScript, Express, and Prisma—intentionally avoiding heavy frameworks.'
categories: ['Software Development']
tags: ['typescript', 'express', 'prisma', 'postgresql', 'web development']
author: Andrew
comments_enabled: true
featured: true
github: 'https://github.com/erwininteractive/weightloss.watch'
demo: 'https://weightogether.com'
image: '/assets/blog/weightogether.webp'
---

WeighTogether is a full-stack weight loss tracking application with social
features. What makes it interesting from a technical perspective isn't what it
uses—it's what it doesn't. The entire application is built without Next.js,
Nuxt, Rails, or any other heavy framework. Instead, it relies on fundamentals:
TypeScript, Express.js, PostgreSQL, and a careful layering of concerns.

This post explores the technologies and design decisions that went into
building WeighTogether.

## The Stack

The technology choices prioritize simplicity and control:

| Layer         | Technology      | Purpose                     |
| ------------- | --------------- | --------------------------- |
| Runtime       | Node.js 20      | JavaScript execution        |
| Language      | TypeScript 5.3  | Type safety                 |
| Framework     | Express.js 4.18 | Minimal HTTP handling       |
| Database      | PostgreSQL 16   | Primary data store          |
| ORM           | Prisma 7        | Type-safe database access   |
| Real-time     | Socket.io 4.8   | Messaging and notifications |
| Templates     | EJS             | Server-side rendering       |
| Styling       | Tailwind CSS 4  | Utility-first CSS           |
| Interactivity | Alpine.js       | Lightweight reactivity      |

## Architecture: Layered Without a Framework

The application follows a classic MVC pattern with a service layer:

```
Request → Logger → LoadUser → Auth → Controller → Service → Prisma → Response
```

The directory structure reflects this separation:

```
src/
├── config/        # Environment and auth configuration
├── controllers/   # Request handlers
├── middleware/    # Auth, logging, file upload
├── routes/        # Route definitions
├── services/      # Business logic
├── types/         # TypeScript definitions
├── views/         # EJS templates
│   └── partials/  # Reusable components
└── server.ts      # Entry point
```

Each layer has a single responsibility. Controllers handle HTTP concerns and
validation. Services contain business logic. Prisma handles database access.
This isn't revolutionary—it's just good architecture, implemented without
framework magic obscuring the flow.

## Static Methods Over Instances

Controllers and services use static methods rather than class instances:

```typescript
// src/controllers/WeightController.ts

class WeightController {
  static entryValidation = [
    body('weight').notEmpty().isFloat({ min: 0.1, max: 1000 }),
    body('recordedAt').notEmpty().isISO8601(),
  ];

  static async index(req: AuthenticatedRequest, res: Response) {
    const entries = await WeightService.getEntriesForUser(req.user.id);
    res.render('weight/index', { entries });
  }

  static async logSubmit(req: AuthenticatedRequest, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('weight/log', { errors: errors.array() });
    }

    await WeightService.createEntry(req.user.id, req.body);
    res.redirect('/progress?success=Weight+logged');
  }
}
```

Services follow the same pattern:

```typescript
// src/services/AuthService.ts

class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, authConfig.bcrypt.saltRounds);
  }

  static async verifyPassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateTokenPair(payload: JwtPayload): TokenPair {
    const accessToken = jwt.sign(payload, authConfig.jwt.accessTokenSecret, {
      expiresIn: '15m',
    });
    const refreshToken = jwt.sign(payload, authConfig.jwt.refreshTokenSecret, {
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }
}
```

This approach eliminates instantiation overhead and makes the code easier to
test. There's no hidden state—each method is a pure function of its inputs.

## Dual Authentication Strategy

The application serves both a web interface and an API, each with different
authentication needs.

**API routes** use JWT Bearer tokens:

```typescript
// src/middleware/auth.ts

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token required' });
  }

  const token = authHeader.split(' ')[1];
  req.user = AuthService.verifyAccessToken(token);
  next();
};
```

**Web routes** use HTTP-only cookies with automatic token refresh:

```typescript
// src/middleware/webAuth.ts

export const webAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const accessToken = req.cookies.accessToken;
  if (accessToken) {
    try {
      req.user = AuthService.verifyAccessToken(accessToken);
      return next();
    } catch {
      // Token expired, try refresh
    }
  }

  const refreshToken = req.cookies[authConfig.cookie.refreshTokenName];
  if (!refreshToken) {
    return res.redirect('/login');
  }

  // Refresh both tokens
  const tokens = await AuthService.refreshTokens(refreshToken);
  res.cookie('accessToken', tokens.accessToken, {
    httpOnly: true,
    maxAge: 900000,
  });
  res.cookie(
    authConfig.cookie.refreshTokenName,
    tokens.refreshToken,
    cookieOptions
  );

  req.user = AuthService.verifyAccessToken(tokens.accessToken);
  next();
};
```

The web middleware silently refreshes expired access tokens using the refresh
token stored in an HTTP-only cookie. Users stay logged in without noticing the
token rotation happening behind the scenes.

## Prisma 7 with the Driver Adapter

WeighTogether uses Prisma 7's new driver adapter pattern:

```typescript
// src/services/database.ts

```javascript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma;
```
```
```
```

The schema uses UUIDs for primary keys and includes careful indexing:

```prisma
model WeightEntry {
    id                  String           @id @default(uuid())
    userId              String
    user                User             @relation(fields: [userId], references: [id])

    weight              Float
    bodyFatPercentage   Float?
    muscleMass          Float?
    notes               String?
    recordedAt          DateTime         @default(now())
    visibility          EntryVisibility  @default(PRIVATE)

    photos              ProgressPhoto[]

    @@index([userId, recordedAt(sort: Desc)])
}
```

The composite index on `[userId, recordedAt]` optimizes the most common query
pattern: fetching a user's entries in reverse chronological order.

## Server-Rendered with Progressive Enhancement

The frontend uses EJS templates with Alpine.js for interactivity. The master
layout is remarkably concise:

```html
<!-- src/views/layout.ejs -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <%- include('partials/_head') %>
  </head>
  <body class="min-h-screen bg-gray-100">
    <%- include('partials/_nav') %>
    <div class="max-w-6xl mx-auto px-4 py-6"><%- body %></div>
    <%- include('partials/_toast') %> <%- include('partials/_scripts') %>
  </body>
</html>
```

Alpine.js handles client-side interactions without the overhead of a full SPA
framework:

```html
<!-- Dropdown menu -->
<div class="relative" x-data="{ open: false }">
  <button @click="open = !open" @click.away="open = false">
    <img src="/avatars/user.jpg" class="w-8 h-8 rounded-full" />
  </button>
  <div
    x-show="open"
    x-transition
    class="absolute right-0 mt-2 w-48 bg-white shadow-lg"
  >
    <a href="/profile">Profile</a>
    <a href="/settings">Settings</a>
    <form action="/logout" method="POST">
      <button type="submit">Logout</button>
    </form>
  </div>
</div>
```

A global toast system uses Alpine's store feature:

```javascript
Alpine.store('toasts', {
  items: [],
  add(message, type = 'info') {
    const id = Date.now();
    this.items.push({ id, message, type });
    setTimeout(() => this.remove(id), 5000);
  },
  remove(id) {
    this.items = this.items.filter((t) => t.id !== id);
  },
});

window.toast = {
  success: (msg) => Alpine.store('toasts').add(msg, 'success'),
  error: (msg) => Alpine.store('toasts').add(msg, 'error'),
};
```

## Real-Time Messaging with Socket.io

Socket.io powers the messaging system and live notifications:

```javascript
// Client-side
const socket = io({
  auth: { userId: currentUserId },
  reconnectionAttempts: 3,
});

socket.on('newMessage', (data) => {
  if (!window.location.pathname.startsWith('/messages')) {
    toast.info(`${data.senderName}: ${data.content}`);
  }
  window.dispatchEvent(new CustomEvent('wlt:newMessage', { detail: data }));
});
```

The server authenticates socket connections using the same JWT infrastructure
as the REST API, ensuring consistent security across both communication
channels.

## Achievement System

An achievement system rewards users for milestones and consistency:

```typescript
// src/services/AchievementService.ts

class AchievementService {
  static async checkWeightAchievements(userId: string): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];
    const entries = await prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { recordedAt: 'asc' },
    });

    // First Weigh-In
    if (entries.length === 1) {
      const achievement = await this.award(userId, 'first-weigh-in');
      if (achievement) unlocked.push(achievement);
    }

    // Weight loss milestones
    const startWeight = entries[0].weight;
    const currentWeight = entries[entries.length - 1].weight;
    const lost = startWeight - currentWeight;

    for (const milestone of [5, 10, 25, 50, 100]) {
      if (lost >= milestone) {
        const achievement = await this.award(userId, `lost-${milestone}-lbs`);
        if (achievement) unlocked.push(achievement);
      }
    }

    return unlocked;
  }
}
```

Hidden achievements add an element of discovery:

```typescript
static async checkHiddenAchievements(userId: string, weight: number, recordedAt: Date) {
    const hour = recordedAt.getHours();

    // Night Owl - logged between midnight and 4 AM
    if (hour >= 0 && hour < 4) {
        await this.award(userId, 'night-owl');
    }

    // Precision Master - weight is a whole number
    if (weight % 1 === 0) {
        await this.award(userId, 'precision-master');
    }
}
```

## Testing Strategy

Jest handles both unit and integration tests. Test factories create
authenticated users with valid tokens:

```typescript
// tests/helpers/factories.ts

export async function createAuthenticatedUser(overrides = {}) {
  const passwordHash = await AuthService.hashPassword('password123');
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      username: `user${Date.now()}`,
      passwordHash,
      emailVerified: true,
      ...overrides,
    },
  });

  const payload = await AuthService.buildJwtPayload(user.id);
  const tokens = AuthService.generateTokenPair(payload);

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { user, tokens };
}
```

Integration tests run against a real PostgreSQL instance:

```typescript
describe('POST /api/auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    await createAuthenticatedUser({ email: 'test@example.com' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.tokens.accessToken).toBeDefined();
  });
});
```

## Why No Framework?

The decision to avoid heavy frameworks was deliberate. Frameworks like Next.js
or Rails are excellent tools, but they come with tradeoffs:

- **Opacity**: Framework magic obscures the request lifecycle
- **Coupling**: Your code becomes entangled with framework conventions
- **Churn**: Framework updates can require significant rewrites
- **Overhead**: Features you don't need still affect bundle size and complexity

WeighTogether's approach trades convenience for clarity. Every line of code is
intentional and understandable. The request flow is explicit. Dependencies are
minimal and stable.

This doesn't mean frameworks are bad—they're often the right choice. But for a
project where I wanted complete control and a deep understanding of every
component, building from fundamentals made sense.

## Conclusion

WeighTogether demonstrates that modern, feature-rich web applications don't
require heavy frameworks. Express.js, Prisma, and PostgreSQL provide a solid
foundation. EJS and Alpine.js deliver a responsive interface without SPA
complexity. Socket.io enables real-time features.

The key is thoughtful architecture: clear separation of concerns, consistent
patterns, and explicit data flow. These principles work regardless of the tools
you choose.

The full source code is available on GitHub if you'd like to explore the
implementation in detail.
