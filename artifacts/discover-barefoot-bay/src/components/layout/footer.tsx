import { Link } from "wouter";
import { useLegalPolicies } from "@/hooks/use-legal";
import { LEGAL_POLICY_KEYS, LEGAL_POLICY_LABELS, LEGAL_POLICY_PATHS } from "@/lib/legal";

export function Footer() {
  const { data: policies } = useLegalPolicies();

  return (
    <footer className="bg-transparent text-black py-6 mt-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center">
          <div className="mb-4">
            <p className="text-center">
              Copyright © 2022-2026 Tattler Media - All Rights Reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {LEGAL_POLICY_KEYS.map((key) => {
              const policy = policies?.find((p) => p.key === key);
              return (
                <Link key={key} href={LEGAL_POLICY_PATHS[key]} data-testid={`link-footer-${key}`}>
                  <span className="hover:text-gray-600 transition-colors cursor-pointer">
                    {policy?.title || LEGAL_POLICY_LABELS[key]}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}