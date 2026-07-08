import type {
  DuplicateCodeFragment,
  DuplicateCodeLocation
} from "../../../../model/schema.ts";

export function requireDuplicateAreas(dup: DuplicateCodeFragment): string[] {
  if (!Array.isArray(dup.codeAreas) || dup.codeAreas.length === 0) {
    throw new Error(`Duplicate fragment #${dup.id} is missing code areas`);
  }
  return dup.codeAreas;
}

export function requireDuplicateLocations(dup: DuplicateCodeFragment): DuplicateCodeLocation[] {
  if (!Array.isArray(dup.locations) || dup.locations.length === 0) {
    throw new Error(`Duplicate fragment #${dup.id} is missing locations`);
  }
  return dup.locations;
}

export function formatDuplicateLocation(dup: DuplicateCodeFragment, location: DuplicateCodeLocation): string {
  if (!location.path || !Number.isInteger(location.startLine) || !Number.isInteger(location.endLine)) {
    throw new Error(`Duplicate fragment #${dup.id} has an incomplete location`);
  }
  if (!location.codeArea || location.codeArea === "unknown") {
    throw new Error(`Duplicate fragment #${dup.id} location is missing code area`);
  }

  const endLine = location.endLine && location.endLine !== location.startLine
    ? `-${location.endLine}`
    : "";

  return `${location.path}:${location.startLine}${endLine} (${location.codeArea})`;
}
