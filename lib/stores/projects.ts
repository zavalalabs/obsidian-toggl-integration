import type {
  EnrichedWithClient,
  ProjectsResponseItem,
} from "lib/model/Report-v3";
import { derived, get, writable } from "svelte/store";

import { Clients } from "./clients";

const projects = writable<ProjectsResponseItem[]>([]);

const enrichedProjects = derived(
  [projects, Clients],
  ([$projects, $clients]): EnrichedWithClient<typeof $projects[number]>[] => {
    // Defensive: ensure both stores are arrays
    if (!Array.isArray($projects)) {
      console.warn("[toggl] Projects store is not an array in enrichedProjects derived store");
      return [];
    }
    if (!Array.isArray($clients)) {
      console.warn("[toggl] Clients store is not an array in enrichedProjects derived store");
      // Return projects without client enrichment
      return $projects.map((project: any) => ({ ...project, $client: undefined }));
    }
    
    return $projects.map((project: any) => ({
      ...project,
      $client: $clients.find((client: any) => client.id === (project.client_id ?? project.cid)),
    }));
  },
);

export const setProjects = projects.set;

export const Projects = { subscribe: enrichedProjects.subscribe };

export function getProjectIds(items: (string | number)[]): number[] {
  const projects = get(Projects);
  
  // Defensive: if projects not loaded yet, return empty array
  if (!projects || !Array.isArray(projects)) {
    console.warn("[toggl] Projects store is empty/undefined when filtering report");
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === "number") {
        return item;
      }
      const project = projects.find(
        (project) => project.name.toLowerCase() === item.toLowerCase(),
      );
      return project?.id ?? null;
    })
    .filter((id) => id !== null) as number[];
}

export function enrichObjectWithProject<
  T extends Record<string, any>,
  Key extends keyof T = "project_id",
>(object: T, key: Key = "project_id" as Key) {
  const projects = get(Projects);
  
  // Defensive: if projects not loaded yet, return object with undefined $project
  if (!projects || !Array.isArray(projects)) {
    console.warn("[toggl] Projects store is empty/undefined when enriching object");
    return {
      ...object,
      $project: undefined,
    };
  }

  return {
    ...object,
    $project: projects.find((project: any) => project.id === object[key]),
  };
}
