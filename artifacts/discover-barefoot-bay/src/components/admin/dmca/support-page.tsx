import { ReactNode } from "react";
import { AlertTriangle, Loader2, ShieldX } from "lucide-react";
import AdminLayout from "@/components/layouts/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DmcaPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <AdminLayout>
      <main className="container mx-auto space-y-6 py-8">
        <header><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-muted-foreground">{description}</p></header>
        {children}
      </main>
    </AdminLayout>
  );
}

export function DmcaAccessDenied() {
  return (
    <AdminLayout><div className="container mx-auto py-12"><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldX className="h-5 w-5 text-destructive" />Access denied</CardTitle></CardHeader><CardContent data-testid="status-access-denied">You do not have the required DMCA permission for this page.</CardContent></Card></div></AdminLayout>
  );
}

export function DmcaLoading() {
  return <div className="flex items-center gap-2 py-10 text-muted-foreground" data-testid="status-loading"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>;
}

export function DmcaError({ error }: { error: unknown }) {
  return <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive" data-testid="status-error"><AlertTriangle className="h-4 w-4" />{error instanceof Error ? error.message : "Request failed"}</div>;
}