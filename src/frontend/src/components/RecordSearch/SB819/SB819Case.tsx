import React from "react";
import { CaseData } from "../Record/types";
import currencyFormat from "../../../service/currency-format";
import SB819Charge from "./SB819Charge";
import SB819CaseQuestions from "./SB819CaseQuestions";
import { SB819AnalysisData } from "./types";

interface Props {
  aCase: CaseData;
  analysis: SB819AnalysisData;
}

const OECI_CASE_DETAIL =
  "https://publicaccess.courts.oregon.gov/PublicAccessLogin/CaseDetail.aspx?CaseID=";

/**
 * A case as the SB-819 view presents it: enough to identify the prosecution, the questions
 * that are answered once for it, and its convictions.
 */
export default function SB819Case({ aCase, analysis }: Props) {
  const {
    case_number,
    location,
    current_status,
    balance_due,
    case_detail_link,
    charges,
  } = aCase;

  // Matches the record view: in development the API is not behind the same origin.
  const prefix = window.location.href.includes("localhost")
    ? "http://localhost:5000"
    : "";
  const linkId = case_detail_link.substring(OECI_CASE_DETAIL.length);

  return (
    <div id={case_number} className="f6 f5-l bg-gray-blue-3 shadow br3 pa1 mb4">
      <div className="cf pv2">
        <div className="fl ph3 pv1">
          <div className="fw7">Case</div>
          <a
            href={prefix + "/api/case_detail_page/" + linkId}
            target="_blank"
            rel="noopener noreferrer"
            className="link bb hover-blue"
          >
            {case_number}
          </a>
        </div>
        <div className="fl ph3 pv1">
          <div className="fw7">County</div>
          {location}
        </div>
        <div className="fl ph3 pv1">
          <div className="fw7">Status</div>
          {current_status}
        </div>
        <div className="fl ph3 pv1">
          <div className="fw7">Balance</div>
          {currencyFormat(balance_due)}
        </div>
      </div>

      <SB819CaseQuestions analysis={analysis} caseNumber={case_number} />

      <ul className="list">
        {charges.map((charge) => (
          <li key={charge.ambiguous_charge_id}>
            <SB819Charge
              charge={charge}
              analysis={analysis.charges[charge.ambiguous_charge_id]}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
