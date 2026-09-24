import React from "react";
import {
  chargeIdsForCase,
  collectQuestions,
  partitionQuestions,
} from "./questionCollection";
import SB819SetAside from "./SB819SetAside";
import SB819Held from "./SB819Held";
import SB819Question from "./SB819Question";
import { useAppSelector } from "../../../redux/hooks";
import { selectSB819Answers } from "../../../redux/sb819AnswersSlice";
import { SB819AnalysisData } from "./types";
import { sb819CasePanelId } from "./scrollToPanel";

interface Props {
  analysis: SB819AnalysisData;
  caseNumber: string;
}

/**
 * The questions that are facts about a prosecution rather than about one conviction.
 *
 * Answered once for the case, so two convictions on the same case cannot disagree about
 * whether its sentence was completed.
 */
export default function SB819CaseQuestions({ analysis, caseNumber }: Props) {
  const chargeIds = chargeIdsForCase(analysis, caseNumber);
  const answers = useAppSelector(selectSB819Answers);
  const questions = collectQuestions(analysis, "case", chargeIds);
  const { asked, held, setAside, setAsideReason } = partitionQuestions(
    questions,
    answers
  );

  if (asked.length === 0 && setAside.length === 0) return null;

  return (
    <div
      id={sb819CasePanelId(caseNumber)}
      className="bg-white br3 ph3 pv2 mh2 mb2 scroll-mt-20"
    >
      <h4 className="fw7 mv2">About this case</h4>
      <p className="f6 mb2">
        Answered once for the case, and applied to every conviction on it.
      </p>
      {asked.map(({ criterion, target }) => (
        <SB819Question key={target} criterion={criterion} target={target} />
      ))}

      <SB819Held held={held} />

      <SB819SetAside
        id={`sb819-case-set-aside-${caseNumber}`}
        setAside={setAside}
        setAsideReason={setAsideReason}
      />
    </div>
  );
}
