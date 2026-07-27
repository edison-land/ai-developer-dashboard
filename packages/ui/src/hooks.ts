import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Stage } from "@ai-dashboard/core";
import { api } from "./api";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: api.projects, staleTime: 60_000 });
}

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: api.health, staleTime: 30_000 });
}

export function useRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.refresh,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

export function useSetStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ canonical, stage }: { canonical: string; stage: Stage }) =>
      api.setStage(canonical, stage),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useClearStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (canonical: string) => api.clearStage(canonical),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/** On-demand synthesis for one project. Invalidates the project list so the card
 *  refetches with the new synth result (summary/nextStep/blockers). */
export function useSynthesize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (canonical: string) => api.synthesize(canonical),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.putSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
