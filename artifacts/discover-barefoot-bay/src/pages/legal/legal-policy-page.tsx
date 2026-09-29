import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLegalPolicies } from "@/hooks/use-legal";
import { PolicyDocument, PolicySkeleton } from "@/components/legal/policy-document";
import type { LegalPolicyKey } from "@/lib/legal";

export default function LegalPolicyPage({ policyKey }: { policyKey: LegalPolicyKey }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useLegalPolicies();
  const policy = data?.find((p) => p.key === policyKey);

  return (
    <div className="max-w-4xl mx-auto bg-white/95 rounded-xl shadow-sm px-5 py-8 sm:px-10 sm:py-10">
      {isLoading ? (
        <PolicySkeleton />
      ) : isError || !policy ? (
        <div className="text-center py-10" role="alert">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h1 className="text-2xl mb-2">This policy could not be loaded</h1>
          <p className="text-gray-600 mb-6">{(error as Error)?.message || "The current published version is unavailable."}</p>
          <Button onClick={() => refetch()} disabled={isFetching} data-testid="button-retry-policy">
            {isFetching ? "Retrying..." : "Try again"}
          </Button>
        </div>
      ) : (
        <PolicyDocument policy={policy} />
      )}
    </div>
  );
}
