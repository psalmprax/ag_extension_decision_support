import type { Router } from 'express';

interface Layer {
    route?: { path: string | string[]; methods: Record<string, boolean> };
    name?: string;
    handle?: { stack?: Layer[] };
    regexp?: RegExp & { fast_slash?: boolean };
    keys?: Array<{ name: string }>;
}

/** The path a router was mounted at with router.use(path, sub), from Express 4's layer regexp. */
function mountPath(layer: Layer): string {
    if (!layer.regexp || layer.regexp.fast_slash) return '';
    let keyIndex = 0;
    return layer.regexp.source
        .replace(/^\^/, '')
        .replace(/\\\/\?\(\?=\\\/\|\$\)$/i, '')
        .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, () => `:${layer.keys?.[keyIndex++]?.name ?? 'param'}`)
        .replace(/\\\//g, '/');
}

/** "METHOD /path" for each method and path of one route layer. */
function routeLines(route: NonNullable<Layer['route']>, prefix: string): string[] {
    const paths = Array.isArray(route.path) ? route.path : [route.path];
    return paths.flatMap(path => Object.keys(route.methods)
        .map(method => `${method.toUpperCase()} ${prefix}${path === '/' && prefix ? '' : path}`));
}

/** Every route a router serves, as "METHOD /path", walking nested routers. */
export function listRoutes(router: Router, prefix = ''): string[] {
    const out: string[] = [];
    for (const layer of (router as unknown as { stack: Layer[] }).stack ?? []) {
        if (layer.route) out.push(...routeLines(layer.route, prefix));
        else if (layer.handle?.stack) out.push(...listRoutes(layer.handle as unknown as Router, prefix + mountPath(layer)));
    }
    return Array.from(new Set(out));
}
