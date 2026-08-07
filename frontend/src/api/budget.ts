import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BudgetByMonth,
  BudgetSummary,
  Settings,
  UpdateSettingsInput,
} from "@bookcsi/shared";
import { apiFetch } from "../lib/api";

export const BUDGET_KEY = ["budget"] as const;
export const SETTINGS_KEY = ["settings"] as const;

/** S6.1 and S6.3 — one request, so the two halves cannot name different months. */
export function useBudgetSummary() {
  return useQuery({
    queryKey: [...BUDGET_KEY, "summary"] as const,
    queryFn: () => apiFetch<BudgetSummary>("/budget/summary"),
  });
}

/** S6.2 — the bars, already dense and oldest-first from the API. */
export function useBudgetByMonth() {
  return useQuery({
    queryKey: [...BUDGET_KEY, "by-month"] as const,
    queryFn: () => apiFetch<BudgetByMonth>("/budget/by-month"),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiFetch<Settings>("/settings"),
  });
}

/**
 * Saving a budget invalidates the budget as well as the settings: the figure
 * the user just typed is one of the inputs to `remaining`, and a summary left
 * in the cache would go on subtracting from the old limit.
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSettingsInput) =>
      apiFetch<Settings>("/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: (settings) => {
      queryClient.setQueryData(SETTINGS_KEY, settings);
      void queryClient.invalidateQueries({ queryKey: BUDGET_KEY });
    },
  });
}
