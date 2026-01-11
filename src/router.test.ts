import { describe, it, expect, beforeEach } from "vitest";
import { Router, type Handler, type HandlerParams } from "./router";

describe("Router", () => {
	describe("basic routing", () => {
		let router: Router;

		beforeEach(() => {
			router = new Router();
		});

		it("should route GET requests to matching handler", async () => {
			const handler: Handler = () => new Response("Hello");
			router.add("GET", "/hello", handler);

			const request = new Request("http://localhost/hello", { method: "GET" });
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("Hello");
		});

		it("should route POST requests to matching handler", async () => {
			const handler: Handler = () => new Response("Created", { status: 201 });
			router.add("POST", "/items", handler);

			const request = new Request("http://localhost/items", { method: "POST" });
			const response = await router.match(request, {});

			expect(response.status).toBe(201);
			expect(await response.text()).toBe("Created");
		});

		it("should route DELETE requests to matching handler", async () => {
			const handler: Handler = () => new Response(null, { status: 204 });
			router.add("DELETE", "/items/:id", handler);

			const request = new Request("http://localhost/items/123", {
				method: "DELETE",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(204);
		});

		it("should route PATCH requests to matching handler", async () => {
			const handler: Handler = () => new Response("Updated");
			router.add("PATCH", "/items/:id", handler);

			const request = new Request("http://localhost/items/123", {
				method: "PATCH",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("Updated");
		});

		it("should return 404 for unmatched routes", async () => {
			const request = new Request("http://localhost/unknown", {
				method: "GET",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("Not Found");
		});

		it("should return 404 for unmatched HTTP methods", async () => {
			router.add("GET", "/hello", () => new Response("Hello"));

			const request = new Request("http://localhost/hello", { method: "POST" });
			const response = await router.match(request, {});

			expect(response.status).toBe(404);
		});
	});

	describe("URL patterns", () => {
		let router: Router;

		beforeEach(() => {
			router = new Router();
		});

		it("should extract URL parameters", async () => {
			let capturedParams: Record<string, string | undefined> = {};
			const handler: Handler = (params) => {
				capturedParams = params.urlParams;
				return new Response("OK");
			};
			router.add("GET", "/users/:id", handler);

			const request = new Request("http://localhost/users/42", {
				method: "GET",
			});
			await router.match(request, {});

			expect(capturedParams["id"]).toBe("42");
		});

		it("should extract multiple URL parameters", async () => {
			let capturedParams: Record<string, string | undefined> = {};
			const handler: Handler = (params) => {
				capturedParams = params.urlParams;
				return new Response("OK");
			};
			router.add("GET", "/posts/:postId/comments/:commentId", handler);

			const request = new Request("http://localhost/posts/123/comments/456", {
				method: "GET",
			});
			await router.match(request, {});

			expect(capturedParams["postId"]).toBe("123");
			expect(capturedParams["commentId"]).toBe("456");
		});

		it("should handle wildcard patterns", async () => {
			let capturedParams: Record<string, string | undefined> = {};
			const handler: Handler = (params) => {
				capturedParams = params.urlParams;
				return new Response("OK");
			};
			router.add("GET", "/files/*", handler);

			const request = new Request("http://localhost/files/anything.txt", {
				method: "GET",
			});
			await router.match(request, {});

			expect(capturedParams["0"]).toBe("anything.txt");
		});
	});

	describe("handler parameters", () => {
		let router: Router;

		beforeEach(() => {
			router = new Router();
		});

		it("should pass request body to handler", async () => {
			let capturedBody = "";
			const handler: Handler = (params) => {
				capturedBody = params.body;
				return new Response("OK");
			};
			router.add("POST", "/data", handler);

			const request = new Request("http://localhost/data", {
				method: "POST",
				body: "test body",
			});
			await router.match(request, {});

			expect(capturedBody).toBe("test body");
		});

		it("should pass search params to handler", async () => {
			let capturedSearchParams: URLSearchParams = new URLSearchParams();
			const handler: Handler = (params) => {
				capturedSearchParams = params.searchParams;
				return new Response("OK");
			};
			router.add("GET", "/search", handler);

			const request = new Request("http://localhost/search?q=test&page=2", {
				method: "GET",
			});
			await router.match(request, {});

			expect(capturedSearchParams.get("q")).toBe("test");
			expect(capturedSearchParams.get("page")).toBe("2");
		});

		it("should pass empty string for body when no body present", async () => {
			let capturedBody: string = "";
			const handler: Handler = (params) => {
				capturedBody = params.body;
				return new Response("OK");
			};
			router.add("GET", "/test", handler);

			const request = new Request("http://localhost/test", { method: "GET" });
			await router.match(request, {});

			expect(capturedBody).toBe("");
		});
	});

	describe("context passing", () => {
		it("should pass context object to handler", async () => {
			type MyContext = {
				userId: string;
				database: string;
			};

			let capturedContext: Partial<MyContext> = {};
			const router = new Router<MyContext>();
			const handler: Handler<MyContext> = (params) => {
				capturedContext = { userId: params.userId, database: params.database };
				return new Response("OK");
			};
			router.add("GET", "/test", handler);

			const request = new Request("http://localhost/test", { method: "GET" });
			await router.match(request, { userId: "user123", database: "mydb" });

			expect(capturedContext.userId).toBe("user123");
			expect(capturedContext.database).toBe("mydb");
		});

		it("should work with empty context", async () => {
			const router = new Router();
			const handler: Handler = (params) => {
				return new Response(JSON.stringify(params.urlParams));
			};
			router.add("GET", "/test", handler);

			const request = new Request("http://localhost/test", { method: "GET" });
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
		});

		it("should spread all context properties into handler params", async () => {
			type CustomContext = {
				user: { id: string; name: string };
				config: { debug: boolean };
				apiKey: string;
			};

			let capturedParams: Partial<HandlerParams<CustomContext>> = {};
			const router = new Router<CustomContext>();
			const handler: Handler<CustomContext> = (params) => {
				capturedParams = params;
				return new Response("OK");
			};
			router.add("GET", "/test", handler);

			const context: CustomContext = {
				user: { id: "123", name: "Test" },
				config: { debug: true },
				apiKey: "secret",
			};

			const request = new Request("http://localhost/test", { method: "GET" });
			await router.match(request, context);

			expect(capturedParams.user?.id).toBe("123");
			expect(capturedParams.user?.name).toBe("Test");
			expect(capturedParams.config?.debug).toBe(true);
			expect(capturedParams.apiKey).toBe("secret");
		});
	});

	describe("route chaining", () => {
		it("should allow method chaining with add", async () => {
			const router = new Router();
			const handler: Handler = () => new Response("OK");

			const result = router
				.add("GET", "/one", handler)
				.add("POST", "/two", handler)
				.add("DELETE", "/three", handler);

			expect(result).toBe(router);

			// Verify routes were actually added by testing they work
			const getRequest = new Request("http://localhost/one", { method: "GET" });
			const getResponse = await router.match(getRequest, {});
			expect(getResponse.status).toBe(200);

			const postRequest = new Request("http://localhost/two", {
				method: "POST",
			});
			const postResponse = await router.match(postRequest, {});
			expect(postResponse.status).toBe(200);

			const deleteRequest = new Request("http://localhost/three", {
				method: "DELETE",
			});
			const deleteResponse = await router.match(deleteRequest, {});
			expect(deleteResponse.status).toBe(200);
		});
	});

	describe("route priority", () => {
		let router: Router;

		beforeEach(() => {
			router = new Router();
		});

		it("should match routes in order they were added", async () => {
			let matchedRoute = "";

			router.add("GET", "/test/*", () => {
				matchedRoute = "first";
				return new Response("First");
			});

			router.add("GET", "/test/:id", () => {
				matchedRoute = "second";
				return new Response("Second");
			});

			const request = new Request("http://localhost/test/123", {
				method: "GET",
			});
			await router.match(request, {});

			expect(matchedRoute).toBe("first");
		});
	});

	describe("async handlers", () => {
		it("should handle async handler functions", async () => {
			const router = new Router();
			const handler: Handler = async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return new Response("Async response");
			};
			router.add("GET", "/async", handler);

			const request = new Request("http://localhost/async", { method: "GET" });
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("Async response");
		});
	});

	describe("multiple routes", () => {
		let router: Router;

		beforeEach(() => {
			router = new Router();
		});

		it("should handle multiple routes for same method", async () => {
			router.add("GET", "/users", () => new Response("Users list"));
			router.add("GET", "/posts", () => new Response("Posts list"));
			router.add("GET", "/comments", () => new Response("Comments list"));

			const request1 = new Request("http://localhost/users", { method: "GET" });
			const response1 = await router.match(request1, {});
			expect(await response1.text()).toBe("Users list");

			const request2 = new Request("http://localhost/posts", { method: "GET" });
			const response2 = await router.match(request2, {});
			expect(await response2.text()).toBe("Posts list");

			const request3 = new Request("http://localhost/comments", {
				method: "GET",
			});
			const response3 = await router.match(request3, {});
			expect(await response3.text()).toBe("Comments list");
		});

		it("should handle same path with different methods", async () => {
			router.add("GET", "/resource", () => new Response("GET"));
			router.add("POST", "/resource", () => new Response("POST"));
			router.add("DELETE", "/resource", () => new Response("DELETE"));
			router.add("PATCH", "/resource", () => new Response("PATCH"));

			const getRequest = new Request("http://localhost/resource", {
				method: "GET",
			});
			const getResponse = await router.match(getRequest, {});
			expect(await getResponse.text()).toBe("GET");

			const postRequest = new Request("http://localhost/resource", {
				method: "POST",
			});
			const postResponse = await router.match(postRequest, {});
			expect(await postResponse.text()).toBe("POST");

			const deleteRequest = new Request("http://localhost/resource", {
				method: "DELETE",
			});
			const deleteResponse = await router.match(deleteRequest, {});
			expect(await deleteResponse.text()).toBe("DELETE");

			const patchRequest = new Request("http://localhost/resource", {
				method: "PATCH",
			});
			const patchResponse = await router.match(patchRequest, {});
			expect(await patchResponse.text()).toBe("PATCH");
		});
	});

	describe("edge cases", () => {
		let router: Router;

		beforeEach(() => {
			router = new Router();
		});

		it("should handle routes with query parameters", async () => {
			const handler: Handler = (params) => {
				const q = params.searchParams.get("q");
				return new Response(`Search: ${q}`);
			};
			router.add("GET", "/search", handler);

			const request = new Request(
				"http://localhost/search?q=hello+world&filter=new",
				{
					method: "GET",
				},
			);
			const response = await router.match(request, {});

			expect(await response.text()).toBe("Search: hello world");
		});

		it("should handle routes with hash fragments", async () => {
			const handler: Handler = () => new Response("OK");
			router.add("GET", "/page", handler);

			const request = new Request("http://localhost/page#section", {
				method: "GET",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
		});

		it("should handle empty path", async () => {
			const handler: Handler = () => new Response("Home");
			router.add("GET", "/", handler);

			const request = new Request("http://localhost/", { method: "GET" });
			const response = await router.match(request, {});

			expect(await response.text()).toBe("Home");
		});

		it("should handle JSON body", async () => {
			let capturedBody = "";
			const handler: Handler = (params) => {
				capturedBody = params.body;
				const data = JSON.parse(params.body);
				return new Response(JSON.stringify({ received: data }));
			};
			router.add("POST", "/api/data", handler);

			const payload = { name: "test", value: 123 };
			const request = new Request("http://localhost/api/data", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			await router.match(request, {});

			expect(JSON.parse(capturedBody)).toEqual(payload);
		});
	});

	describe("HTTP helper methods", () => {
		let router: Router;

		beforeEach(() => {
			router = new Router();
		});

		it("should register GET route using get() helper", async () => {
			const handler: Handler = () => new Response("GET response");
			router.get("/test", handler);

			const request = new Request("http://localhost/test", { method: "GET" });
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("GET response");
		});

		it("should register POST route using post() helper", async () => {
			const handler: Handler = () => new Response("POST response");
			router.post("/test", handler);

			const request = new Request("http://localhost/test", { method: "POST" });
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("POST response");
		});

		it("should register PUT route using put() helper", async () => {
			const handler: Handler = () => new Response("PUT response");
			router.put("/test", handler);

			const request = new Request("http://localhost/test", { method: "PUT" });
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("PUT response");
		});

		it("should register PATCH route using patch() helper", async () => {
			const handler: Handler = () => new Response("PATCH response");
			router.patch("/test", handler);

			const request = new Request("http://localhost/test", { method: "PATCH" });
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("PATCH response");
		});

		it("should register DELETE route using delete() helper", async () => {
			const handler: Handler = () => new Response("DELETE response");
			router.delete("/test", handler);

			const request = new Request("http://localhost/test", {
				method: "DELETE",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("DELETE response");
		});

		it("should support method chaining with helper methods", async () => {
			const handler: Handler = (params) => new Response(params.urlParams.id);

			const result = router
				.get("/users/:id", handler)
				.post("/users", handler)
				.put("/users/:id", handler)
				.patch("/users/:id", handler)
				.delete("/users/:id", handler);

			expect(result).toBe(router);

			// Verify all routes work
			const getRequest = new Request("http://localhost/users/1", {
				method: "GET",
			});
			const getResponse = await router.match(getRequest, {});
			expect(await getResponse.text()).toBe("1");

			const postRequest = new Request("http://localhost/users", {
				method: "POST",
			});
			const postResponse = await router.match(postRequest, {});
			expect(postResponse.status).toBe(200);

			const putRequest = new Request("http://localhost/users/2", {
				method: "PUT",
			});
			const putResponse = await router.match(putRequest, {});
			expect(await putResponse.text()).toBe("2");

			const patchRequest = new Request("http://localhost/users/3", {
				method: "PATCH",
			});
			const patchResponse = await router.match(patchRequest, {});
			expect(await patchResponse.text()).toBe("3");

			const deleteRequest = new Request("http://localhost/users/4", {
				method: "DELETE",
			});
			const deleteResponse = await router.match(deleteRequest, {});
			expect(await deleteResponse.text()).toBe("4");
		});

		it("should work with URL parameters in helper methods", async () => {
			let capturedParams: Record<string, string | undefined> = {};
			const handler: Handler = (params) => {
				capturedParams = params.urlParams;
				return new Response("OK");
			};

			router.get("/posts/:postId", handler);

			const request = new Request("http://localhost/posts/123", {
				method: "GET",
			});
			await router.match(request, {});

			expect(capturedParams["postId"]).toBe("123");
		});

		it("should work with context in helper methods", async () => {
			type MyContext = { userId: string };
			const contextRouter = new Router<MyContext>();

			let capturedUserId = "";
			const handler: Handler<MyContext> = (params) => {
				capturedUserId = params.userId;
				return new Response("OK");
			};

			contextRouter.post("/items", handler);

			const request = new Request("http://localhost/items", { method: "POST" });
			await contextRouter.match(request, { userId: "user123" });

			expect(capturedUserId).toBe("user123");
		});

		it("should work with async handlers in helper methods", async () => {
			const handler: Handler = async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return new Response("Async GET");
			};

			router.get("/async", handler);

			const request = new Request("http://localhost/async", { method: "GET" });
			const response = await router.match(request, {});

			expect(await response.text()).toBe("Async GET");
		});

		it("should mix helper methods with add() method", async () => {
			router.get("/route1", () => new Response("GET"));
			router.add("POST", "/route2", () => new Response("POST"));
			router.put("/route3", () => new Response("PUT"));
			router.add("PATCH", "/route4", () => new Response("PATCH"));
			router.delete("/route5", () => new Response("DELETE"));

			const request1 = new Request("http://localhost/route1", {
				method: "GET",
			});
			const response1 = await router.match(request1, {});
			expect(await response1.text()).toBe("GET");

			const request2 = new Request("http://localhost/route2", {
				method: "POST",
			});
			const response2 = await router.match(request2, {});
			expect(await response2.text()).toBe("POST");

			const request3 = new Request("http://localhost/route3", {
				method: "PUT",
			});
			const response3 = await router.match(request3, {});
			expect(await response3.text()).toBe("PUT");

			const request4 = new Request("http://localhost/route4", {
				method: "PATCH",
			});
			const response4 = await router.match(request4, {});
			expect(await response4.text()).toBe("PATCH");

			const request5 = new Request("http://localhost/route5", {
				method: "DELETE",
			});
			const response5 = await router.match(request5, {});
			expect(await response5.text()).toBe("DELETE");
		});
	});

	describe("setNotFoundHandler", () => {
		let router: Router;

		beforeEach(() => {
			router = new Router();
		});

		it("should use custom not found handler for unmatched routes", async () => {
			const notFoundHandler: Handler = () =>
				new Response("Custom Not Found", { status: 404 });
			router.setNotFoundHandler(notFoundHandler);

			const request = new Request("http://localhost/unknown", {
				method: "GET",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("Custom Not Found");
		});

		it("should use custom not found handler for unmatched HTTP methods", async () => {
			const notFoundHandler: Handler = () =>
				new Response("Method Not Allowed", { status: 405 });
			router.setNotFoundHandler(notFoundHandler);
			router.get("/resource", () => new Response("OK"));

			const request = new Request("http://localhost/resource", {
				method: "POST",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(405);
			expect(await response.text()).toBe("Method Not Allowed");
		});

		it("should use default not found handler when not overridden", async () => {
			const request = new Request("http://localhost/unknown", {
				method: "GET",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("Not Found");
		});

		it("should support method chaining with setNotFoundHandler", async () => {
			const notFoundHandler: Handler = () =>
				new Response("Not Found", { status: 404 });
			const result = router.setNotFoundHandler(notFoundHandler);

			expect(result).toBe(router);
		});

		it("should allow chaining setNotFoundHandler with other methods", async () => {
			router
				.setNotFoundHandler(() => new Response("Custom 404", { status: 404 }))
				.get("/test", () => new Response("OK"))
				.post("/items", () => new Response("Created", { status: 201 }));

			const matchRequest = new Request("http://localhost/test", {
				method: "GET",
			});
			const matchResponse = await router.match(matchRequest, {});
			expect(await matchResponse.text()).toBe("OK");

			const notFoundRequest = new Request("http://localhost/unknown", {
				method: "GET",
			});
			const notFoundResponse = await router.match(notFoundRequest, {});
			expect(await notFoundResponse.text()).toBe("Custom 404");
		});

		it("should pass request data to custom not found handler", async () => {
			let capturedBody = "";
			let capturedSearchParams: URLSearchParams = new URLSearchParams();

			const notFoundHandler: Handler = (params) => {
				capturedBody = params.body;
				capturedSearchParams = params.searchParams;
				return new Response("Not Found", { status: 404 });
			};
			router.setNotFoundHandler(notFoundHandler);

			const request = new Request("http://localhost/unknown?key=value", {
				method: "POST",
				body: "test data",
			});
			await router.match(request, {});

			expect(capturedBody).toBe("test data");
			expect(capturedSearchParams.get("key")).toBe("value");
		});

		it("should pass context to custom not found handler", async () => {
			type MyContext = { userId: string; role: string };
			const contextRouter = new Router<MyContext>();

			let capturedUserId = "";
			let capturedRole = "";

			const notFoundHandler: Handler<MyContext> = (params) => {
				capturedUserId = params.userId;
				capturedRole = params.role;
				return new Response("Not Found", { status: 404 });
			};
			contextRouter.setNotFoundHandler(notFoundHandler);

			const request = new Request("http://localhost/unknown", {
				method: "GET",
			});
			await contextRouter.match(request, { userId: "user123", role: "admin" });

			expect(capturedUserId).toBe("user123");
			expect(capturedRole).toBe("admin");
		});

		it("should support async custom not found handler", async () => {
			const notFoundHandler: Handler = async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return new Response("Async Not Found", { status: 404 });
			};
			router.setNotFoundHandler(notFoundHandler);

			const request = new Request("http://localhost/unknown", {
				method: "GET",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("Async Not Found");
		});

		it("should allow overriding not found handler multiple times", async () => {
			router.setNotFoundHandler(
				() => new Response("First Handler", { status: 404 }),
			);

			let request = new Request("http://localhost/unknown", {
				method: "GET",
			});
			let response = await router.match(request, {});
			expect(await response.text()).toBe("First Handler");

			router.setNotFoundHandler(
				() => new Response("Second Handler", { status: 404 }),
			);

			request = new Request("http://localhost/unknown", {
				method: "GET",
			});
			response = await router.match(request, {});
			expect(await response.text()).toBe("Second Handler");
		});

		it("should use custom not found handler with different status codes", async () => {
			router.setNotFoundHandler(
				() => new Response("Not Found", { status: 404 }),
			);

			const request = new Request("http://localhost/unknown", {
				method: "GET",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(404);
		});

		it("should use custom not found handler with JSON response", async () => {
			const notFoundHandler: Handler = () =>
				new Response(
					JSON.stringify({ error: "Resource not found", code: "NOT_FOUND" }),
					{ status: 404, headers: { "Content-Type": "application/json" } },
				);
			router.setNotFoundHandler(notFoundHandler);

			const request = new Request("http://localhost/unknown", {
				method: "GET",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(404);
			expect(response.headers.get("Content-Type")).toBe("application/json");
			const body = JSON.parse(await response.text());
			expect(body.error).toBe("Resource not found");
			expect(body.code).toBe("NOT_FOUND");
		});

		it("should use custom not found handler when route path matches but method does not", async () => {
			const notFoundHandler: Handler = () =>
				new Response("Resource exists but method not allowed", { status: 405 });
			router.setNotFoundHandler(notFoundHandler);
			router.get("/resource", () => new Response("GET response"));

			const request = new Request("http://localhost/resource", {
				method: "DELETE",
			});
			const response = await router.match(request, {});

			expect(response.status).toBe(405);
			expect(await response.text()).toBe(
				"Resource exists but method not allowed",
			);
		});

		it("should work with URL parameters in not found handler", async () => {
			let capturedUrlParams: Record<string, string | undefined> = {};

			const notFoundHandler: Handler = (params) => {
				capturedUrlParams = params.urlParams;
				return new Response("Not Found", { status: 404 });
			};
			router.setNotFoundHandler(notFoundHandler);

			const request = new Request("http://localhost/api/v1/resource", {
				method: "GET",
			});
			await router.match(request, {});

			expect(capturedUrlParams).toEqual({});
		});
	});
});
