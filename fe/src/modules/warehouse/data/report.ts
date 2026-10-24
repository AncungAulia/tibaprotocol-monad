export const ISSUE_LABELS: Record<string, string> = {
  damaged: "Damaged",
  missing_items: "Missing items",
  wrong_goods: "Wrong goods",
  other: "Other",
}

/** Plain label for a reported problem, whether it is stored as "missing_items" or "Missing items". */
export function issueLabel(issue: string) {
  const key = issue.trim().toLowerCase().replaceAll(" ", "_")
  if (ISSUE_LABELS[key]) return ISSUE_LABELS[key]
  const text = issue.replaceAll("_", " ").trim()
  return text ? text[0].toUpperCase() + text.slice(1) : "Other"
}

export function issueLabels(issues: string[]) {
  return issues.map(issueLabel).join(", ")
}
