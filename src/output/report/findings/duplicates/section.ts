import type {
  DuplicateCodeFragment,
  QualityMetrics
} from "../../../../model/schema.ts";
import {
  formatDuplicateLocation,
  requireDuplicateAreas,
  requireDuplicateLocations
} from "./locations.ts";

const DUPLICATE_FRAGMENTS_PER_AREA = 5;

export function duplicateCodeSection(metrics: QualityMetrics): string {
  const lines: string[] = [];
  lines.push("## 重复代码检测");
  lines.push("");

  const duplicates = metrics.duplicateCode;
  if (duplicates.length === 0) {
    lines.push("✅ 未发现重复代码片段（在配置的 minimum tokens 阈值以上）");
    return lines.join("\n");
  }

  lines.push(`**Total**: ${duplicates.length} duplicate code fragments`);
  lines.push("");
  appendDuplicateAreas(lines, groupDuplicatesByArea(duplicates));

  return lines.join("\n");
}

function appendDuplicateAreas(
  lines: string[],
  duplicatesByArea: Map<string, DuplicateCodeFragment[]>
): void {
  for (const [area, fragments] of duplicatesByArea.entries()) {
    appendDuplicateArea(lines, area, fragments);
  }
}

function groupDuplicatesByArea(duplicates: readonly DuplicateCodeFragment[]): Map<string, DuplicateCodeFragment[]> {
  const byArea = new Map<string, DuplicateCodeFragment[]>();
  for (const duplicate of duplicates) {
    for (const area of requireDuplicateAreas(duplicate)) {
      const areaDuplicates = byArea.get(area) ?? [];
      areaDuplicates.push(duplicate);
      byArea.set(area, areaDuplicates);
    }
  }
  return byArea;
}

function appendDuplicateArea(lines: string[], area: string, fragments: readonly DuplicateCodeFragment[]): void {
  lines.push(`### ${area} (${fragments.length} fragments)`);
  lines.push("");

  for (const fragment of fragments.slice(0, DUPLICATE_FRAGMENTS_PER_AREA)) {
    appendDuplicateFragment(lines, fragment);
  }

  appendRemainingCount(lines, fragments.length, DUPLICATE_FRAGMENTS_PER_AREA, "fragments");
  lines.push("");
}

function appendDuplicateFragment(lines: string[], fragment: DuplicateCodeFragment): void {
  const locations = requireDuplicateLocations(fragment);
  lines.push(`- **Fragment #${fragment.id}**: ${fragment.tokenCount} tokens, ${fragment.lineCount} lines`);
  lines.push(`  - Locations (${locations.length}):`);
  for (const location of locations) {
    lines.push(`    - ${formatDuplicateLocation(fragment, location)}`);
  }
  if (fragment.hitsChangedScope) {
    lines.push("  - ⚠️ 命中 changed scope");
  }
}

function appendRemainingCount(lines: string[], total: number, shown: number, label: string): void {
  if (total > shown) {
    lines.push(`- *... and ${total - shown} more ${label}*`);
  }
}
