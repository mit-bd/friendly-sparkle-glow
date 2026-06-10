/**
 * React Router compatibility layer.
 *
 * This module re-implements the small subset of the TanStack Router API that
 * the app uses, backed by `react-router-dom`. It lets the existing route files
 * and components keep their original call shapes (`<Link to params>`,
 * `navigate({ to, params, search })`, `Route.useParams()`, `Route.useSearch()`,
 * etc.) while the app runs as a standard client-side SPA.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Link as RRLink,
  NavLink as RRNavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate as useRRNavigate,
  useParams as useRRParams,
  useSearchParams,
  type LinkProps as RRLinkProps,
} from "react-router-dom";

export { Outlet, Navigate };

/* ------------------------------------------------------------------ */
/* Path building                                                       */
/* ------------------------------------------------------------------ */

type ParamMap = Record<string, string | number | undefined | null>;
type SearchInput = Record<string, unknown> | undefined | null;

function applyParams(to: string, params?: ParamMap): string {
  let path = to;
  if (params) {
    for (const key of Object.keys(params)) {
      const value = params[key];
      if (value == null) continue;
      // TanStack uses `$id` segments; React Router uses `:id`. Support both.
      path = path
        .replace(`$${key}`, encodeURIComponent(String(value)))
        .replace(`:${key}`, encodeURIComponent(String(value)));
    }
  }
  return path;
}

function applySearch(path: string, search?: SearchInput): string {
  if (!search || typeof search !== "object") return path;
  const sp = new URLSearchParams();
  for (const key of Object.keys(search)) {
    const value = (search as Record<string, unknown>)[key];
    if (value == null || value === "") continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

export function buildHref(
  to: string,
  params?: ParamMap,
  search?: SearchInput,
): string {
  return applySearch(applyParams(to, params), search);
}

/* ------------------------------------------------------------------ */
/* Link                                                                */
/* ------------------------------------------------------------------ */

type LinkExtraProps = {
  to: string;
  params?: ParamMap;
  search?: SearchInput;
  activeProps?: { className?: string };
  inactiveProps?: { className?: string };
  activeOptions?: { exact?: boolean };
  // TanStack-only props we silently ignore in the SPA build.
  preload?: unknown;
  resetScroll?: unknown;
  from?: unknown;
};

export type LinkProps = Omit<RRLinkProps, "to"> & LinkExtraProps;

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    to,
    params,
    search,
    activeProps,
    inactiveProps,
    activeOptions,
    preload: _preload,
    resetScroll: _resetScroll,
    from: _from,
    className,
    ...rest
  },
  ref,
) {
  const href = buildHref(to, params, search);

  if (activeProps || inactiveProps) {
    return (
      <RRNavLink
        ref={ref}
        to={href}
        end={activeOptions?.exact}
        className={({ isActive }) =>
          [
            typeof className === "string" ? className : "",
            isActive ? activeProps?.className ?? "" : inactiveProps?.className ?? "",
          ]
            .filter(Boolean)
            .join(" ")
        }
        {...rest}
      />
    );
  }

  return <RRLink ref={ref} to={href} className={className as string} {...rest} />;
});

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

type NavigateArg =
  | string
  | {
      to: string;
      params?: ParamMap;
      search?: SearchInput | ((prev: Record<string, unknown>) => Record<string, unknown>);
      replace?: boolean;
    };

export function useNavigate() {
  const navigate = useRRNavigate();
  const [searchParams] = useSearchParams();
  return useCallback(
    (arg: NavigateArg) => {
      if (typeof arg === "string") {
        navigate(arg);
        return;
      }
      let search = arg.search;
      if (typeof search === "function") {
        const prev: Record<string, unknown> = {};
        searchParams.forEach((v, k) => {
          prev[k] = v;
        });
        search = search(prev);
      }
      const href = buildHref(arg.to, arg.params, search as SearchInput);
      navigate(href, { replace: arg.replace });
    },
    [navigate, searchParams],
  );
}

/* ------------------------------------------------------------------ */
/* Params / search                                                     */
/* ------------------------------------------------------------------ */

export function useParams(_opts?: {
  strict?: boolean;
  from?: string;
}): Record<string, string> {
  return useRRParams() as Record<string, string>;
}

function readSearchObject(searchParams: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

/* ------------------------------------------------------------------ */
/* Router + router state                                               */
/* ------------------------------------------------------------------ */

export function useRouter() {
  const navigate = useNavigate();
  return {
    navigate,
    // No loader graph in the SPA; data-refresh is handled by component-level
    // reloads, so invalidate is a safe no-op.
    invalidate: () => {},
    preloadRoute: () => {},
  };
}

export function useRouterState<T = { location: { pathname: string; search: string } }>(opts?: {
  select?: (state: { location: { pathname: string; search: string } }) => T;
}): T {
  const location = useLocation();
  const state = {
    location: { pathname: location.pathname, search: location.search },
  };
  return (opts?.select ? opts.select(state) : state) as T;
}

/* ------------------------------------------------------------------ */
/* redirect / notFound (kept for API parity)                          */
/* ------------------------------------------------------------------ */

export function redirect(opts: { to: string; replace?: boolean }): never {
  // In the SPA, navigation guards are handled at render time via <Navigate>.
  // This exists only so any stray `redirect(...)` call type-checks.
  throw new Error(`redirect to ${opts.to}`);
}

export function notFound(): never {
  throw new Error("notFound");
}

/* ------------------------------------------------------------------ */
/* head() handling                                                     */
/* ------------------------------------------------------------------ */

type MetaEntry = {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
};

type HeadResult = { meta?: MetaEntry[] };

function applyHead(head?: () => HeadResult) {
  if (!head) return;
  const result = head();
  const meta = result?.meta ?? [];
  for (const entry of meta) {
    if (entry.title) {
      document.title = entry.title;
      continue;
    }
    if (!entry.content) continue;
    const selector = entry.name
      ? `meta[name="${entry.name}"]`
      : entry.property
        ? `meta[property="${entry.property}"]`
        : null;
    if (!selector) continue;
    let tag = document.head.querySelector<HTMLMetaElement>(selector);
    if (!tag) {
      tag = document.createElement("meta");
      if (entry.name) tag.setAttribute("name", entry.name);
      if (entry.property) tag.setAttribute("property", entry.property);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", entry.content);
  }
}

function useHead(head?: () => HeadResult) {
  useEffect(() => {
    applyHead(head);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ------------------------------------------------------------------ */
/* createFileRoute / createRootRoute shims                            */
/* ------------------------------------------------------------------ */

interface RouteConfig {
  component?: ComponentType;
  head?: () => HeadResult;
  validateSearch?: (search: Record<string, unknown>) => unknown;
  // Anything else (loader, beforeLoad, ssr, notFoundComponent, ...) is ignored.
  [key: string]: unknown;
}

export interface RouteObject {
  options: RouteConfig;
  Component: ComponentType;
  useParams: <T = Record<string, string>>() => T;
  useSearch: <T = Record<string, unknown>>() => T;
  useNavigate: typeof useNavigate;
  useRouteContext: () => Record<string, unknown>;
  fullPath: string;
}

function makeRoute(path: string, config: RouteConfig): RouteObject {
  const Inner = config.component;

  function Component() {
    useHead(config.head);
    return Inner ? <Inner /> : <Outlet />;
  }

  const useSearch = <T,>(): T => {
    const [searchParams] = useSearchParams();
    const raw = readSearchObject(searchParams);
    return (config.validateSearch ? config.validateSearch(raw) : raw) as T;
  };

  return {
    options: config,
    Component,
    useParams: <T,>() => useRRParams() as T,
    useSearch,
    useNavigate,
    useRouteContext: () => ({}),
    fullPath: path,
  };
}

export function createFileRoute(path: string) {
  return (config: RouteConfig): RouteObject => makeRoute(path, config);
}

export function createRootRoute(config: RouteConfig): RouteObject {
  return makeRoute("/", config);
}

export function createRootRouteWithContext<_C>() {
  return (config: RouteConfig): RouteObject => makeRoute("/", config);
}

/* Re-export a couple of misc symbols used in passing. */
export function HeadContent(): ReactNode {
  return null;
}
export function Scripts(): ReactNode {
  return null;
}