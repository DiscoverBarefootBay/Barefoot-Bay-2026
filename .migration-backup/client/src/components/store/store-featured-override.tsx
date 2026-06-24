/**
 * Simple component that passes through children
 * We'll handle the featured products hiding directly in the store-page.tsx
 */
export function StorePageOverride({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}