import { useEffect } from "react";
import { useLocation } from "wouter";
import { installInternalNavigation } from "../lib/internal-navigation";

/**
 * Install allowlisted same-origin anchor interception inside a Wouter Router.
 *
 * Pass the Router's `base` value when the app is deployed below a URL prefix;
 * the hook strips that prefix before forwarding the location to Wouter.
 */
export function useInternalNavigation(basePath = "/"): void {
  const [, navigate] = useLocation();

  useEffect(
    () => installInternalNavigation(document, (to) => navigate(to), basePath),
    [navigate, basePath],
  );
}