let HttpHash = require('http-hash'),
    ControllerDispatcher = require('./ControllerDispatcher');
    urlParser = require('url');

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
     * (PRIVATE INTERNAL) Creates a method description and a handler
     * 
     * @param {string} method 
     * @memberof Router
     */
    _addMethod(method) {
        const METHOD = method.toUpperCase();
        method = method.toLowerCase();
        
        this[METHOD + 'Routes'] = HttpHash();
        this[method.toLowerCase()] = (routeUrl, binding, options) => {
            this._registerRoute(METHOD, routeUrl, binding, options);
        }
    }

    /**
     * (PRIVATE INTERNAL) Creates a binding for a new route.
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
        if (Array.isArray(routes)) {
            routes.forEach(route =>
                this._registerRoute(route.method, route.routeUrl, route.binding, route.options)
            );
        }
        else if (typeof routes === 'function') {
            const defineHandler = (route, url) => {
                const method = route[0];
                const binding = route[1];
                const options = route.length > 2 ? route[2] : undefined;
                this._registerRoute(method, url, binding, options);
            }

            const defineHandlers = (_routes, path = '') => {
                for (let _url in _routes) {
                    const route = _routes[_url];
                    let url = (_url[0] !== '/') ? ('/' + _url) : _url;

                    if (typeof route === 'function') {
                        const params = url.match(/\:\w+/gm).map(el => el.replace(/\:/, ''));
                        const result = route.apply(void 0, params);
                        defineRoute(result, path + url)
                    } else {
                        defineRoute(route, path + url);
                    }
                }
            }
            
            function defineRoute(route, url) {
                if (Array.isArray(route)) {
                    if (route.length === 0)
                        throw new Error(`No handlers provided for '${url}'!`);

                    if (Array.isArray(route[0]) && route[0].length > 1) {
                        route.forEach(handler => defineHandler(handler, url));
                    } else if (route[0].length <= 1) {
                        throw new Error(`Route handler of '${url}' is not defined!`);
                    } else {
                        defineHandler(route, url);
                    }
                } else {
                    defineHandlers(route, url);
                }
            }

            defineHandlers(routes((method, binding, options) => [method, binding, options]));
        }
    }

    /**
     * Resolve a given route.
     *
     * @param request
     * @param response
     */
    async resolveRoute(request, response) {
        let route = this.findMatchingRoute(request.method, request.url);

        if (route.handler) {
            try {
                if (request.method === 'GET') {
                    route.query = urlParser.parse(request.url, true).query || {}
                }
                return await Router.goThroughMiddleware(route, request, response);
            } catch (e) {
                throw new Error(e);
                console.error('Error while trying to resolve route. ' + e);
                response.writeHead(500);
                return response.end('Server error.');
            }
        }

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
        route = route.split('?')[0]
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
    static async goThroughMiddleware(route, request, response) {
        if (!Router.hasMiddlewareOption(route)) {
            try {
                return await Router.dispatchRoute(route, response);
            } catch (e) {
                throw new Error(e);
            }
        }

        let middlewareContainer = use('Ivy/MiddlewareContainer'),
            Pipe = use('Ivy/Pipe');

        let middlewaresList = middlewareContainer.parse(route.handler.options.middleware);

        return Pipe.data({route: route, request: request, response: response})
            .through(middlewaresList)
            .catch((err) => {
                console.error(err);
                response.writeHead(500);
                return response.end('Error piping through middleware. ' + err);
            }).then(async (data) => {
                try {
                    return await Router.dispatchRoute(data.route, data.response);
                } catch (e) {
                    throw new Error(e);
                }
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
    static async dispatchRoute(route, response) {
        let handler = route.handler.closure;
        try {
            let handlerResponse = typeof handler === 'string'
                ? await ControllerDispatcher.dispatchRoute(handler, [route.params, route.query])
                : await handler(route.params, route.query);
            return Router.respondToRoute(handlerResponse, response);
        } catch (e) {
            throw new Error(e);
        }
    }

    /**
     * Make a response to the request.
     *
     * @param handlerAnswer
     * @param response
     * @return {*}
     */
    static respondToRoute(handlerAnswer, response) {
        if (!handlerAnswer)
            return response.end();

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

    /**
     * Creates a new resource.
     *
     * @param resourceName
     * @param controllerHandler
     * @param options
     */
    resource(resourceName, controllerHandler, options = {}) {
        this.get(resourceName, `${controllerHandler}@index`, options);
        this.get(`${resourceName}/:id`, `${controllerHandler}@show`, options);
        this.post(`${resourceName}`, `${controllerHandler}@create`, options);
        this.put(`${resourceName}/:id`, `${controllerHandler}@update`, options);
        this.delete(`${resourceName}/:id`, `${controllerHandler}@remove`, options);
     }
}

module.exports = Router;