type HttpMethod = "GET" | "POST" | "DELETE" | "PATCH" | "PUT";

// Request handler parameters: request data and context
export type HandlerParams<Context extends Record<string, any> = {}> = {
	body: string;
	urlParams: Record<string, string | undefined>;
	searchParams: URLSearchParams;
} & Context;

// Route handler: accepts request data and context, returns sync or async response
export type Handler<Context extends Record<string, any> = {}> = (
	params: HandlerParams<Context>,
) => Response | Promise<Response>;

// HTTP router with URLPattern-based matching and context injection
export class Router<Context extends Record<string, any> = {}> {
	private routes: Record<
		HttpMethod,
		{ pattern: URLPattern; handler: Handler<Context> }[]
	> = {
		GET: [],
		POST: [],
		DELETE: [],
		PATCH: [],
		PUT: [],
	};

	private notFoundHandler: Handler<Context> = (
		_params: HandlerParams<Context>,
	) => new Response("Not Found", { status: 404 });

	// Override the not found handler
	setNotFoundHandler = (handler: Handler<Context>) => {
		this.notFoundHandler = handler;
		return this;
	};

	// Register route: creates URLPattern, stores handler, enables chaining
	add = (
		method: HttpMethod,
		pathname: string,
		handler: Handler<Context>,
	): Router<Context> => {
		this.routes[method].push({
			pattern: new URLPattern({ pathname }),
			handler,
		});
		return this;
	};

	// Match request: iterate routes by method, invoke first match
	match = async (request: Request, context: Context): Promise<Response> => {
		const method = request.method.toUpperCase() as HttpMethod;
		const possibleRoutes = this.routes[method] || [];
		const body = await request.text();
		const { searchParams, pathname } = new URL(request.url);

		for (const route of possibleRoutes) {
			const result = route.pattern.exec({ pathname });
			if (result !== null) {
				return route.handler({
					body,
					urlParams: result.pathname.groups,
					searchParams,
					...context,
				});
			}
		}

		return this.notFoundHandler({
			body,
			urlParams: {},
			searchParams,
			...context,
		});
	};

	// Helper method for GET requests
	get = (pathname: string, handler: Handler<Context>): Router<Context> => {
		return this.add("GET", pathname, handler);
	};

	// Helper method for POST requests
	post = (pathname: string, handler: Handler<Context>): Router<Context> => {
		return this.add("POST", pathname, handler);
	};

	// Helper method for PUT requests
	put = (pathname: string, handler: Handler<Context>): Router<Context> => {
		return this.add("PUT", pathname, handler);
	};

	// Helper method for PATCH requests
	patch = (pathname: string, handler: Handler<Context>): Router<Context> => {
		return this.add("PATCH", pathname, handler);
	};

	// Helper method for DELETE requests
	delete = (pathname: string, handler: Handler<Context>): Router<Context> => {
		return this.add("DELETE", pathname, handler);
	};
}
