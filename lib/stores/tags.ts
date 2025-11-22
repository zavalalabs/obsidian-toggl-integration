import type { TagsResponseItem } from "lib/model/Report-v3";
import { get, writable } from "svelte/store";

const tags = writable<TagsResponseItem[]>([]);

export const setTags = tags.set;

export const Tags = { subscribe: tags.subscribe };

export function getTagIds(item: (string | number)[]): number[] {
  const tags = get(Tags);
  
  // Defensive: if tags not loaded yet, return empty array
  if (!tags || !Array.isArray(tags)) {
    console.warn("[toggl] Tags store is empty/undefined when filtering report");
    return [];
  }

  return item
    .map((item) => {
      if (typeof item === "number") {
        return item;
      }
      const tag = tags.find(
        (tag) => tag.name.toLowerCase() === item.toLowerCase(),
      );
      return tag?.id ?? null;
    })
    .filter((id) => id !== null) as number[];
}

export function enrichObjectWithTags<T extends { tag_ids: number[] }>(
  object: T,
) {
  const tags = get(Tags);
  
  // Defensive: if tags not loaded yet, return empty tags array
  if (!tags || !Array.isArray(tags)) {
    console.warn("[toggl] Tags store is empty/undefined when enriching object");
    return {
      ...object,
      $tags: [],
    };
  }

  return {
    ...object,
    $tags: tags.filter((tag) => object.tag_ids.includes(tag.id)),
  };
}
