import React from "react";
import { PendingQuestion, revealingAnswer } from "./questionCollection";
import scrollToPanel, {
  SB819_APPLICANT_PANEL_ID,
  sb819CasePanelId,
} from "./scrollToPanel";
import { SB819CriterionResultData, SB819Scope } from "./types";

/**
 * Names the panel that asks a record-scope or case-scope question, and scrolls to it.
 *
 * Those questions are put to the volunteer once, above the charges, so a charge row that
 * mentions one has to say where it is.
 */
function PanelLink({
  scope,
  caseNumber,
}: {
  scope: SB819Scope;
  caseNumber: string;
}) {
  const applicant = scope === "record";
  const panelId = applicant
    ? SB819_APPLICANT_PANEL_ID
    : sb819CasePanelId(caseNumber);

  return (
    <button
      type="button"
      onClick={() => scrollToPanel(panelId)}
      className="bn bg-transparent pa0 pointer f6 blue underline-hover"
    >
      {applicant ? "About the applicant" : "About this case"}
    </button>
  );
}

/**
 * One line naming the question that has to be met before a held question is asked.
 *
 * Used in place of the question's controls on a charge, so the row still says what the
 * criterion is and why nothing can be answered there yet. A holder that is asked in a
 * panel above is linked, since it is out of sight from the row.
 */
export function HeldNote({
  holder,
  caseNumber,
}: {
  holder: SB819CriterionResultData;
  caseNumber: string;
}) {
  return (
    <p className="f6 gray mt1 mb2">
      Asked if <q>{holder.question?.text}</q> is answered{" "}
      <span className="fw6">{revealingAnswer(holder)}</span>.
      {holder.scope !== "charge" && (
        <>
          {" "}
          Answer it under{" "}
          <PanelLink scope={holder.scope} caseNumber={caseNumber} />.
        </>
      )}
    </p>
  );
}

/**
 * One line saying where a row's question is asked, for a criterion whose question is not
 * about this one conviction and so is put to the volunteer in a panel above.
 */
export function AskedAboveNote({
  result,
  caseNumber,
}: {
  result: SB819CriterionResultData;
  caseNumber: string;
}) {
  return (
    <p className="f6 gray mt1 mb2">
      Asked above, under{" "}
      <PanelLink scope={result.scope} caseNumber={caseNumber} />.
    </p>
  );
}

interface Props {
  held: PendingQuestion[];
}

/**
 * The questions a panel is not asking yet, grouped by the question they wait on.
 *
 * The count tells the volunteer that more follows and which answer brings it, so the form
 * grows as the client's circumstances come out.
 */
export default function SB819Held({ held }: Props) {
  if (held.length === 0) return null;

  const byHolder = new Map<string, PendingQuestion[]>();
  held.forEach((q) => {
    const key = q.heldBy!.question!.text;
    byHolder.set(key, [...(byHolder.get(key) ?? []), q]);
  });

  return (
    <div className="f6 gray mt2">
      {Array.from(byHolder.entries()).map(([text, questions]) => {
        const holder = questions[0].heldBy!;
        const count = questions.length;
        return (
          <p key={text} className="mv1">
            {count} more {count === 1 ? "question" : "questions"} if{" "}
            <q>{text}</q> is answered{" "}
            <span className="fw6">{revealingAnswer(holder)}</span>.
          </p>
        );
      })}
    </div>
  );
}
