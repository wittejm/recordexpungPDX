import React from "react";
import { useAppSelector } from "../../../redux/hooks";
import { CaseData } from "../Record/types";
import SB819Summary from "./SB819Summary";
import SB819GlobalPanel from "./SB819GlobalPanel";
import SB819Case from "./SB819Case";
import useResolvedAnalysis from "./useResolvedAnalysis";
import { SB819AnalysisData } from "./types";

/**
 * Keeps only the charges the analysis covers, and drops cases left with none.
 *
 * The analysis already excludes charges outside the counties with published criteria and
 * charges expungement can still reach, so this follows it.
 */
function analyzedCasesOnly(
  cases: CaseData[],
  analysis: SB819AnalysisData
): CaseData[] {
  return cases.reduce((kept: CaseData[], aCase) => {
    const charges = aCase.charges.filter(
      (charge) => analysis.charges[charge.ambiguous_charge_id]
    );
    if (charges.length > 0) kept.push({ ...aCase, charges });
    return kept;
  }, []);
}

export default function SB819View() {
  const record = useAppSelector((state) => state.search.record);
  const analysis = useResolvedAnalysis();

  if (!record?.cases || !analysis) return <></>;

  const cases = analyzedCasesOnly(record.cases, analysis);

  return (
    <section>
      <SB819Summary
        analysis={analysis}
        totalIneligibleCharges={Object.keys(analysis.charges).length}
      />

      <SB819GlobalPanel analysis={analysis} />

      <div className="mb3">
        <ul className="list">
          {cases.map((aCase) => (
            <li key={aCase.case_number}>
              <SB819Case aCase={aCase} analysis={analysis} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
