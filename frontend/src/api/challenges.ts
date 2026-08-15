import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Challenge,
  ChallengeSummary,
  CreateChallengeInput,
  UpdateChallengeInput,
} from "@bookcsi/shared";
import { apiFetch } from "../lib/api";

export const CHALLENGES_KEY = ["challenges"] as const;

function invalidateChallenges(queryClient: {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => unknown;
}): void {
  void queryClient.invalidateQueries({ queryKey: CHALLENGES_KEY });
}

export function useChallenges() {
  return useQuery({
    queryKey: [...CHALLENGES_KEY, "list"] as const,
    queryFn: () => apiFetch<ChallengeSummary[]>("/challenges"),
  });
}

export function useChallenge(id: string | undefined) {
  return useQuery({
    queryKey: [...CHALLENGES_KEY, "detail", id] as const,
    queryFn: () => apiFetch<Challenge>(`/challenges/${id}`),
    enabled: id !== undefined,
  });
}

export function useCreateChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateChallengeInput) =>
      apiFetch<Challenge>("/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateChallenges(queryClient),
  });
}

export function useUpdateChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChallengeInput }) =>
      apiFetch<Challenge>(`/challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateChallenges(queryClient),
  });
}

export function useDeleteChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/challenges/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateChallenges(queryClient),
  });
}

export function useAddChallengeBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ challengeId, bookId }: { challengeId: string; bookId: string }) =>
      apiFetch<Challenge>(`/challenges/${challengeId}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      }),
    onSuccess: () => invalidateChallenges(queryClient),
  });
}

export function useRemoveChallengeBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ challengeId, bookId }: { challengeId: string; bookId: string }) =>
      apiFetch<Challenge>(`/challenges/${challengeId}/books/${bookId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateChallenges(queryClient),
  });
}
