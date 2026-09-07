import { useMemo } from "react";
import { useAppSelector } from "../../../redux/hooks";
import { selectSB819Answers } from "../../../redux/sb819AnswersSlice";
import resolveAnalysis from "./resolveAnalysis";
import { SB819AnalysisData } from "./types";

/** The analysis as it stands after the answers given so far. */
export default function useResolvedAnalysis(): SB819AnalysisData | undefined {
  const raw = useAppSelector(
    (state) => state.search.record?.summary?.sb819_analysis
  );
  const answers = useAppSelector(selectSB819Answers);
  return useMemo(
    () => (raw ? resolveAnalysis(raw, answers) : undefined),
    [raw, answers]
  );
}
