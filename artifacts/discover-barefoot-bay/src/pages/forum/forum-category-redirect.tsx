import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ForumLoading } from "@/components/ui/forum-loading";

// Legacy route: /forum/category/:categoryId used to render a list-style page.
// Redirect to the Extra! Extra! feed with the category filter pre-selected so
// old links and bookmarks land on the new layout.
export default function ForumCategoryRedirect() {
  const params = useParams<{ categoryId: string }>();
  const [, navigate] = useLocation();

  useEffect(() => {
    const categoryId = parseInt(params.categoryId, 10);
    navigate(
      Number.isInteger(categoryId) && categoryId > 0
        ? `/forum?categoryId=${categoryId}`
        : "/forum",
      { replace: true },
    );
  }, [params.categoryId, navigate]);

  return <ForumLoading type="forums" className="min-h-[50vh]" />;
}
