import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pathKey, type FocusPreferences, type Stage } from "@ai-dashboard/core";
import {
  api,
  type ProjectsResponse,
  type SynthesizeAllProgressEvent,
} from "./api";
import { DEFAULT_FILTER, type ProjectFilter } from "./filter";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: api.projects, staleTime: 60_000 });
}

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: api.health, staleTime: 30_000 });
}

export function useActivity() {
  return useQuery({ queryKey: ["activity"], queryFn: api.activity, staleTime: 60_000 });
}

/** All projects including archived (for the archive drawer). */
export function useArchived() {
  return useQuery({ queryKey: ["archived"], queryFn: api.archivedProjects, staleTime: 60_000 });
}

/** R3: archive a project (sticky). Invalidates projects + archived + activity. */
export function useArchive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (canonical: string) => api.archive(canonical),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["archived"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      qc.invalidateQueries({ queryKey: ["focus-preferences"] });
    },
  });
}

/** R3: restore an archived project. */
export function useUnarchive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (canonical: string) => api.unarchive(canonical),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["archived"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.refresh,
    onSuccess: () => {
      // A server-side refresh recomputes adapters, so activity (derived from
      // the same collected projects) is stale too.
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["health"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

/**
 * Periodically trigger a server-side refresh (recompute adapters) when enabled.
 * `intervalMins <= 0` (or undefined) disables. mutate() is stable, so the
 * interval is only re-armed when the interval changes.
 */
export function useAutoRefresh(intervalMins: number | undefined) {
  const refresh = useRefresh();
  useEffect(() => {
    const mins = intervalMins ?? 0;
    if (mins <= 0) return;
    const id = setInterval(() => refresh.mutate(), mins * 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMins]);
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

/** Cache-aware sequential synthesis for every unarchived project. */
export function useSynthesizeAll() {
  const qc = useQueryClient();
  const [progress, setProgress] =
    useState<SynthesizeAllProgressEvent | null>(null);
  const mutation = useMutation({
    mutationFn: () =>
      api.synthesizeAll((event) => {
        setProgress(event);
        const updatedProject = event.project;
        if (!updatedProject) return;
        qc.setQueryData<ProjectsResponse>(["projects"], (current) => {
          if (!current) return current;
          return {
            ...current,
            projects: current.projects.map((project) =>
              pathKey(project.canonicalPath) ===
              pathKey(updatedProject.canonicalPath)
                ? updatedProject
                : project,
            ),
          };
        });
      }),
    onMutate: () => setProgress(null),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      qc.invalidateQueries({ queryKey: ["health"] });
    },
  });
  return { ...mutation, progress };
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

export function useFocusPreferences(localDate: string) {
  return useQuery({
    queryKey: ["focus-preferences", localDate],
    queryFn: () => api.focusPreferences(localDate),
    staleTime: 60_000,
  });
}

export function useSaveFocusPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.putFocusPreferences,
    onMutate: async (next: FocusPreferences) => {
      const queryKey = ["focus-preferences", next.localDate] as const;
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<FocusPreferences>(queryKey);
      qc.setQueryData(queryKey, next);
      return { previous, queryKey };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) qc.setQueryData(context.queryKey, context.previous);
    },
    onSettled: (_data, _error, next) => {
      qc.invalidateQueries({ queryKey: ["focus-preferences", next.localDate] });
    },
  });
}

const FILTER_KEY = "ai-dashboard:filter";

function loadFilter(): ProjectFilter {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) return { ...DEFAULT_FILTER, ...(JSON.parse(raw) as Partial<ProjectFilter>) };
  } catch {
    // malformed / unavailable localStorage — fall back to defaults
  }
  return DEFAULT_FILTER;
}

/**
 * R1+R2 filter state, persisted to localStorage so it survives refreshes.
 * (`ui_filters` in the settings table was the alternative; localStorage keeps
 * R1/R2 purely frontend per the backlog assessment.)
 */
export function useFilter(): [ProjectFilter, (f: ProjectFilter) => void] {
  const [filter, setFilter] = useState<ProjectFilter>(loadFilter);
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
    } catch {
      // storage full / disabled — non-fatal; filter still works in-memory
    }
  }, [filter]);
  return [filter, setFilter];
}
