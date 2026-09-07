import React, { useEffect } from "react";
import useSelectableDisclosure from "./useSelectableDisclosure";
import DisclosureIcon from "../../common/DisclosureIcon";
import SB819Collapse from "./SB819Collapse";
import { disqualifyingCriteria, openQuestionCount } from "./resolveAnalysis";
import SB819Question from "./SB819Question";
import {
  SB819ChargeAnalysisData,
  SB819CriterionResultData,
  SB819PathwayResultData,
  answerTarget,
  failureReason,
  outcomeIcon,
  statusBackground,
  statusColor,
} from "./types";

function DeterminationTag({ result }: { result: SB819CriterionResultData }) {
  const styling = {
    OECI: "green bg-washed-green",
    Question: "purple bg-washed-purple",
    Discretion: "mid-gray bg-light-gray",
    "Part 2": "mid-gray bg-light-gray",
  }[result.determination];

  return (
    <span className={"f7 fw6 br2 ph1 ml2 nowrap " + styling}>
      {result.determination}
    </span>
  );
}

function Criterion({
  result,
  charge,
}: {
  result: SB819CriterionResultData;
  charge: SB819ChargeAnalysisData;
}) {
  // Shown whether or not it has been answered, so an answer can always be revisited.
  const askedHere = result.scope === "charge" && result.question;

  return (
    <li className="pv2 bb b--light-gray">
      <div className="flex flex-wrap items-baseline">
        <span
          className={outcomeIcon(result.outcome) + " mr2"}
          aria-hidden="true"
        ></span>
        <span className="fw6">{result.name}</span>
        <DeterminationTag result={result} />
        <span className="f7 gray ml2 nowrap">{result.citation}</span>
      </div>
      <div className="f6 mt1 ml3 pl1">{result.explanation}</div>
      {askedHere && (
        <div className="ml3 pl1">
          <SB819Question
            criterion={result}
            target={answerTarget(
              result,
              charge.case_number,
              charge.ambiguous_charge_id
            )}
          />
        </div>
      )}
    </li>
  );
}

function PathwayBar({ criterion }: { criterion: SB819CriterionResultData }) {
  const reason = failureReason(criterion);

  return (
    <p className="f6 mt1 mb0 ml3">
      {reason.answer ? (
        <>
          <span className="gray">{reason.text}</span>{" "}
          <span className="fw7 red">{reason.answer}</span>
        </>
      ) : (
        <span className="gray">{reason.text}</span>
      )}
    </p>
  );
}

function Pathway({
  pathway,
  charge,
}: {
  pathway: SB819PathwayResultData;
  charge: SB819ChargeAnalysisData;
}) {
  const decided = pathway.status === "SB-819 Ineligible";
  const {
    disclosureIsExpanded,
    disclosureButtonProps,
    disclosureContentProps,
    setIsExpanded,
  } = useSelectableDisclosure({
    id: `pathway-${charge.ambiguous_charge_id}-${pathway.pathway}`,
    isOpenToStart: !decided,
  });

  // An answer can rule the pathway out after it has already been rendered open, so the
  // remaining questions fold away when they stop mattering.
  useEffect(() => {
    if (decided) setIsExpanded(false);
  }, [decided, setIsExpanded]);

  // Questions about the applicant are answered once, above, and summarised separately.
  // Criteria nobody can settle are not criteria rows at all; they render as instructions.
  const own = pathway.criteria.filter(
    (c) => c.scope !== "record" && c.is_screenable
  );
  const blocker = disqualifyingCriteria(pathway.criteria)[0];

  return (
    <div className="mb3">
      <button
        {...disclosureButtonProps}
        className="w-100 flex flex-wrap items-center bg-transparent bn pointer tl pa0 pv2"
      >
        <h4 className="fw7 mr2">{pathway.pathway}</h4>
        <span
          className={`f6 fw6 br2 ph2 pv1 mr2 ${statusColor(
            pathway.status
          )} ${statusBackground(pathway.status)}`}
        >
          {pathway.status}
        </span>
        <span className="mr-auto"></span>
        <DisclosureIcon disclosureIsExpanded={disclosureIsExpanded} />
      </button>

      {/* Only worth saying while the questions themselves are out of sight. */}
      {decided && blocker && !disclosureIsExpanded && (
        <PathwayBar criterion={blocker} />
      )}

      <SB819Collapse contentProps={disclosureContentProps}>
        <ul className="list">
          {own.map((result) => (
            <Criterion key={result.key} result={result} charge={charge} />
          ))}
        </ul>
      </SB819Collapse>
    </div>
  );
}

interface Props {
  analysis?: SB819ChargeAnalysisData;
}

export default function SB819Criteria({ analysis }: Props) {
  const allMainPassed =
    analysis?.main_criteria.every((c) => c.outcome === "Passed") ?? false;
  const {
    disclosureIsExpanded,
    disclosureButtonProps,
    disclosureContentProps,
    setIsExpanded,
  } = useSelectableDisclosure({
    id: `main-${analysis?.ambiguous_charge_id ?? "none"}`,
    isOpenToStart: !allMainPassed,
  });

  // Answering the sentencing-level question can settle the main criteria after render.
  useEffect(() => {
    if (allMainPassed) setIsExpanded(false);
  }, [allMainPassed, setIsExpanded]);

  if (!analysis) return null;

  const blockedOnMainCriteria = analysis.pathways.length === 0;
  const remaining = openQuestionCount(analysis);

  return (
    <div className="bt b--light-gray ph3 pv3">
      <div className="flex flex-wrap items-baseline mb2">
        <h3 className="fw7 mr-auto">SB-819 Limiting Criteria</h3>
        {remaining > 0 && (
          <span className="f6 purple">
            {remaining} {remaining === 1 ? "question" : "questions"} to answer
          </span>
        )}
      </div>

      {blockedOnMainCriteria && (
        <p className="f6 mb3">
          This conviction fails a criterion that gates every application type,
          so the Justice Integrity Unit cannot accept it under any pathway.
        </p>
      )}

      {analysis.blocked_pathways.length > 0 &&
        analysis.available_pathways.length > 0 && (
          <p className="f6 mb3">
            Blocked under {analysis.blocked_pathways.join(", ")}, but still open
            under {analysis.available_pathways.join(" and ")}.
          </p>
        )}

      <button
        {...disclosureButtonProps}
        className="w-100 flex flex-wrap items-center bg-transparent bn pointer tl pa0 pv2"
      >
        <h4 className="fw7 mr2">Main Criteria</h4>
        {allMainPassed ? (
          <span className="f6 green mr-auto">&mdash; all four met</span>
        ) : (
          <span className="f6 gray mr-auto">
            &mdash; required for every application type
          </span>
        )}
        <DisclosureIcon disclosureIsExpanded={disclosureIsExpanded} />
      </button>
      <SB819Collapse contentProps={disclosureContentProps}>
        <ul className="list mb3">
          {analysis.main_criteria.map((result) => (
            <Criterion key={result.key} result={result} charge={analysis} />
          ))}
        </ul>
      </SB819Collapse>

      {analysis.pathways.map((pathway) => (
        <Pathway key={pathway.pathway} pathway={pathway} charge={analysis} />
      ))}
    </div>
  );
}
