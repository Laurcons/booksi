import { useQuery } from "@tanstack/react-query";
import type { StatsByMonth, StatsOverview } from "@bookcsi/shared";
import { apiFetch } from "../lib/api";

export const STATS_KEY = ["stats"] as const;

/**
 * S7.1 and the reading figures on the S8.1 dashboard — one hook, because it is
 * one endpoint, and it is one endpoint on purpose.
 *
 * Two screens show "cărți citite" and they must agree. Deriving the number
 * client-side from the downloaded library would have worked on the day it was
 * written and drifted the first time a rule moved, which is exactly what §D10
 * was decided to prevent. The library is not even fetched here: the four
 * figures are all this needs, and computing them from `/books` would download
 * a thousand rows to count them.
 */
export function useStatsOverview() {
  return useQuery({
    queryKey: [...STATS_KEY, "overview"] as const,
    queryFn: () => apiFetch<StatsOverview>("/stats/overview"),
  });
}

/** S7.2 — the bars, already dense and oldest-first from the API. */
export function useStatsByMonth() {
  return useQuery({
    queryKey: [...STATS_KEY, "by-month"] as const,
    queryFn: () => apiFetch<StatsByMonth>("/stats/by-month"),
  });
}
