import { Link } from "wouter";

export function Footer() {
  const currentYear = new Date().getFullYear();

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
            <Link href="/terms">
              <span className="hover:text-gray-600 transition-colors cursor-pointer">
                Terms and Agreements
              </span>
            </Link>
            <Link href="/privacy">
              <span className="hover:text-gray-600 transition-colors cursor-pointer">
                Privacy Policy
              </span>
            </Link>
            <Link href="/dmca">
              <span className="hover:text-gray-600 transition-colors cursor-pointer">
                Copyright / DMCA
              </span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}