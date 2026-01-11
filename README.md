# context-router

A dependency-free HTTP router with URL pattern matching and context support for Node.js/TypeScript.

## Why Use context-router?

This library is useful when you need a lightweight, type-safe HTTP router that can pass request-scoped data (like authenticated user information, database connections, or configuration) to all your route handlers without relying on globals or middleware chains. It combines URL pattern matching with automatic context injection.

## Example: Passing a User Object

Here's a practical example that passes an authenticated user to each handler:

```typescript
import { Router, Handler, HandlerParams } from "./router";

// Define your user type
type User = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
};

// Define your context type (contains the authenticated user)
type AppContext = {
  user: User;
};

// Create a router with the context type
const router = new Router<AppContext>();

// Define handlers that receive the user from context
const getUserHandler: Handler<AppContext> = (params) => {
  const { user } = params;
  return new Response(
    JSON.stringify({ message: `Hello, ${user.name}!`, userId: user.id }),
    { headers: { "Content-Type": "application/json" } }
  );
};

const updateProfileHandler: Handler<AppContext> = (params) => {
  const { user, body } = params;
  const data = JSON.parse(body);
  
  if (!user.isAdmin && user.id !== data.userId) {
    return new Response("Forbidden", { status: 403 });
  }
  
  return new Response(
    JSON.stringify({ message: "Profile updated", user: { ...user, ...data } }),
    { headers: { "Content-Type": "application/json" } }
  );
};

const deleteUserHandler: Handler<AppContext> = (params) => {
  const { user, urlParams } = params;
  
  if (!user.isAdmin) {
    return new Response("Only admins can delete users", { status: 403 });
  }
  
  const userIdToDelete = urlParams.id;
  return new Response(
    JSON.stringify({ message: `User ${userIdToDelete} deleted` }),
    { headers: { "Content-Type": "application/json" } }
  );
};

// Register routes
router
  .get("/profile", getUserHandler)
  .post("/profile", updateProfileHandler)
  .delete("/users/:id", deleteUserHandler);

// Usage: when handling an HTTP request, pass the authenticated user as context
const authenticatedUser: User = {
  id: "user123",
  name: "Alice",
  email: "alice@example.com",
  isAdmin: true,
};

const request = new Request("http://localhost/profile", { method: "GET" });
const response = await router.match(request, { user: authenticatedUser });
```

In this example, every route handler automatically receives the `user` object through the `params` parameter, allowing you to access user information without global state or middleware.

## License

ISC