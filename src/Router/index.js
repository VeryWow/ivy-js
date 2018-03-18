let HttpHash = require('http-hash'),
    ControllerDispatcher = require('./ControllerDispatcher');

const defaultMethods = [
    'GET',
    'POST',
    'PUT',
    'DELETE'
]

class Router {

    /**
     * Creates an instance of Router.
     * @param {string[]} [methods=[]] 
     * @memberof Router
     */
    constructor(methods = []) {
        this.methods = defaultMethods.concat(methods.filter(el => !~defaultMethods.indexOf(el)));

        this.methods.forEach(method => this._addMethod.call(this, method))
        this.routesList = [];
    }

    /**
     * Creates a method description and a handler
     * 
     * @param {string} method 
     * @memberof Router
     */
    _addMethod(method) {
        const METHOD = method.toUpperCase();
        method = method.toLowerCase();
        
        this[METHOD + 'Routes'] = HttpHash();
        this[method.toLowerCase()] = (routeUrl, binding, options) => {
            return this._registerRoute(METHOD, routeUrl, binding, options);
        }
    }

    /**
     * Creates a binding for a new route.
     *
     * @param method
     * @param routeUrl
     * @param binding
     * @param options
     */
    _registerRoute(method, routeUrl, binding, options) {
        this[method + 'Routes'].set(routeUrl, { closure: binding, options });
        this.routesList.push({
            method,
            options,
            path: routeUrl,
            closure: typeof binding === 'function' ? 'Function' : binding
        });
    }

    /**
     * Adds new method to the instance
     * 
     * @param {string} method 
     * @memberof Router
     */
    addMethod(method) {
        if (!~this.methods.indexOf(method.toUpperCase())) {
            this.methods.push(method.toUpperCase())
            this._addMethod(method)
        }
    }

    /**
     * Registers a bunch of routes
     * 
     * @param {{method: string, routeUrl: string, binding, options}} routes
     * @memberof Router
     */
    registerRoutes(routes) {
        Array.isArray(routes) && routes.forEach(route =>
            this._registerRoute(route.method, route.routeUrl, route.binding, route.options)
        );
    }

    /**
     * Resolve a given route.
     *
     * @param request
     * @param response
     */
    resolveRoute(request, response) {
        let route = this.findMatchingRoute(request.method, request.url);

        if (route.handler)
            return Router.goThroughMiddleware(route, request, response);

        response.writeHead(404);
        return response.end('Route not found');
    }

    /**
     * Find the matching route.
     *
     * @param method
     * @param route
     */
    findMatchingRoute(method, route) {
        return this[method + 'Routes'].get(route);
    }

    /**
     * Pipe data through the middlewares.
     *
     * @param route
     * @param request
     * @param response
     * @return {*}
     */
    static goThroughMiddleware(route, request, response) {
        if (!Router.hasMiddlewareOption(route))
            return Router.dispatchRoute(route, response);

        let middlewareContainer = use('Ivy/MiddlewareContainer'),
            Pipe = use('Ivy/Pipe');

        let middlewaresList = middlewareContainer.parse(route.handler.options.middleware);

        return Pipe.data({route: route, request: request, response: response})
            .through(middlewaresList)
            .catch((err) => {
                console.error(err);
                response.writeHead(500);
                return response.end('Error piping through middleware. ' + err);
            }).then((data) => {
                return Router.dispatchRoute(data.route, data.response);
            });

    }

    /**
     * Check if route has middleware to go through.
     *
     * @param route
     * @return {string|string}
     */
    static hasMiddlewareOption(route) {
        return route.handler.options && route.handler.options.middleware;
    }

    /**
     * Dispatch a request to the handler.
     *
     * @param route
     * @param response
     * @return {*}
     */
    static dispatchRoute(route, response) {
        let handler = route.handler.closure;
        let handlerResponse = typeof handler === 'string' ? ControllerDispatcher.dispatchRoute(handler, route.params) : handler(route.params);
        return Router.respondToRoute(handlerResponse, response);
    }

    /**
     * Make a response to the request.
     *
     * @param handlerAnswer
     * @param response
     * @return {*}
     */
    static respondToRoute(handlerAnswer, response) {
        if (typeof handlerAnswer === "string")
            return response.end(handlerAnswer);

        if (handlerAnswer['toString'] && typeof handlerAnswer !== 'object')
            return response.end(handlerAnswer.toString());

        try {
            response.setHeader('content-type', 'application/json');
            return response.end(JSON.stringify(handlerAnswer, null, 4));
        } catch (e) {
            console.error('Error while trying to stringify JSON object. ' + e);
            response.writeHead(500);
            return response.end('Server error.');
        }

    }
}

module.exports = Router;