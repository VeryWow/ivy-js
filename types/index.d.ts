type method = 'GET' | 'POST' | 'DELETE' | 'PUT';
type binding = ((...args) => any) | string
type options = any

type RouteStructure = [method, binding, options] | [method, binding];
type RouteStructures = RouteStructure | RouteStructure[];

type RouteMethod = (...args) => RouteStructures | Routes;
type RouteMethods = RouteMethod | RouteMethod[];

type RouteLeaf = RouteStructures | RouteMethods;

interface Routes {
	[url: string]: RouteLeaf | Routes
}

type RouteMap = (route: (method, binding, options?) => RouteStructure) => Routes;