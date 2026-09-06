---
title: 'Immutable-friendly HTTP and safer middleware'
slug: 'arc-0-9-1-immutable-http'
publishDate: '2026-06-05'
description: "Request::withAttribute() and Response::with* make middleware safer and easier to reason about. Plus a note on PHP 8.5's clone-chain pitfall."
categories: ['Software Development']
tags: ['PHP', 'Arc', 'Frameworks', 'Middleware']
comments_enabled: true
author: 'tim'
featured: true
hidden: false
image: '/assets/blog/arc-0-9-1-immutable-http.webp'
github: 'https://github.com/andrewthecodertx/php-arcmvc/releases/tag/v0.9.1'
---

Arc 0.9.1 is a small but important release focused on safer HTTP primitives and middleware ergonomics.

What's new

- Request gains withAttribute(key, value), which returns a new instance with the attribute set. setAttribute() still exists and mutates in place; prefer withAttribute() in middleware pipelines.
- Response adds immutable variants alongside the existing mutators: withStatusCode(int), withHeader(name, value), withContent(string), withAddedCookie(Cookie).
- Response::redirect() reminder: external URLs are rejected by default to prevent open redirect attacks. Allow external targets only when you intend to (allowExternal: true).

Why this matters

- Middleware often passes the same Request/Response through multiple layers. Mutating in place can create spooky-action-at-a-distance. The with\* variants make behavior explicit and predictable.

PHP 8.5 clone-chain pitfall

- PHP 8.5 has a gotcha where return clone($this)->method() can mutate $this instead of the clone. Arc implements with* using a two-statement pattern to avoid this: $new = clone $this; /* modify $new \*/; return $new.
- If you add your own immutable helpers, avoid one-line clone chains on PHP 8.5.

Examples

Add security headers without mutating the original Response

```php
use Arc\Http\MiddlewareInterface;
use Arc\Http\Request;
use Arc\Http\Response;

final class SecurityHeadersMiddleware implements MiddlewareInterface
{
    public function handle(Request $request, callable $next): Response
    {
        $response = $next($request);

        return $response
            ->withHeader('X-Frame-Options', 'DENY')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Referrer-Policy', 'no-referrer')
            ->withHeader('Permissions-Policy', 'camera=(), microphone=()');
    }
}
```

Attach request-scoped data immutably

```php
final class AuthMiddleware implements MiddlewareInterface
{
    public function handle(Request $request, callable $next): Response
    {
        $userId = $this->authenticate($request); // returns null or an ID
        $requestWithUser = $request->withAttribute('user_id', $userId);
        return $next($requestWithUser);
    }

    private function authenticate(Request $request): ?int { /* ... */ }
}
```

Release notes and code

- Full changelog and tag: https://github.com/andrewthecodertx/php-arcmvc/releases/tag/v0.9.1
- README now includes an HTTP Request & Response section covering immutable usage.
