interface VendorCategoryBadgeProps {
  count: number;
}

export function VendorCategoryBadge({ count }: VendorCategoryBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ml-auto">
      {count > 99 ? '99+' : count}
    </span>
  );
}
