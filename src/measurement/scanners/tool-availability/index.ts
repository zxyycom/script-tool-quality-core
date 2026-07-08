import type { QualityConfig, ToolAvailability } from "../../../model/schema.ts";
import { checkJscpd } from "./jscpd.ts";
import { checkLizard } from "./lizard.ts";
import { checkScc } from "./scc.ts";

export async function checkTools(rootDir: string, tools: QualityConfig["tools"]): Promise<ToolAvailability[]> {
  return Promise.all([
    checkLizard(rootDir, tools.lizard),
    checkScc(rootDir, tools.scc),
    checkJscpd(rootDir, tools.jscpd)
  ]);
}
