/** Keep the category-page's existing legacy URL repairs separate from the main list. */
export function vendorCategoryHref(slug: string, category: string) {
  if (slug === "vendors-technology-and-electronics-computer-healthcare")
    return "/vendors/technology-and-electronics/computer-healthcare";
  let name = "";
  if (slug === "vendors-landscaping-tst vendor") name = "tst vendor";
  else if (slug === "vendors-landscaping-landscaping") name = "landscaping";
  else if (slug.includes(" ")) name = slug.substring(slug.indexOf(" ") + 1);
  else if (!category.includes("-")) name = slug.split("-").slice(2).join("-");
  else if (slug.startsWith(`vendors-${category}-`)) name = slug.substring(category.length + 9);
  else {
    const parts = slug.split("-");
    const categoryParts = category.split("-");
    let start = 1, matched = 0;
    for (let i = 1; i < parts.length && matched < categoryParts.length; i++) {
      if (parts[i] === categoryParts[matched]) { matched++; start = i + 1; }
      else if (matched > 0) {
        matched = 0;
        if (parts[i] === categoryParts[0]) { matched = 1; start = i + 1; }
      }
    }
    while (start < parts.length && categoryParts.includes(parts[start])) start++;
    if (parts[start] === "and") {
      start++;
      while (start < parts.length && categoryParts.includes(parts[start])) start++;
    }
    name = parts.slice(start).join("-");
  }
  if (name.startsWith("services-")) name = name.substring(9);
  if (category.includes("-") && name.startsWith(`${category}-`)) name = name.substring(category.length + 1);
  return `/vendors/${category}/${encodeURIComponent(name)}`;
}
