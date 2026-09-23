import React from "react";
import { ChargeData } from "../Record/types";
import ExpungementRules from "../Record/ExpungementRules";
import SB819Criteria from "./SB819Criteria";
import { SB819ChargeAnalysisData } from "./types";

interface Props {
  charge: ChargeData;
  analysis?: SB819ChargeAnalysisData;
}

/**
 * A conviction as the SB-819 view presents it.
 *
 * Deliberately not the record view's charge panel. Everything here is a conviction that
 * expungement cannot reach, so that view's verdict badge and its type eligibility would
 * read the same on every charge and say nothing. What is left is the charge itself and the
 * SB-819 criteria applied to it.
 */
function describeDisposition(disposition: ChargeData["disposition"]) {
  const { status, ruling, date } = disposition;
  if (status === "Convicted" || status === "Dismissed")
    return `${status} - ${date}`;
  if (status === "Unrecognized") return `${status} ("${ruling}")`;
  return status;
}

export default function SB819Charge({ charge, analysis }: Props) {
  const { ambiguous_charge_id, statute, name, level, date, disposition } =
    charge;

  return (
    <div className="relative br3 bg-white ma2" id={ambiguous_charge_id}>
      <div className="ph3 pt3 pb1">
        <ul className="list mw6">
          <li className="flex mb2">
            <span className="w6rem shrink-none fw7">Charge</span>
            {`${statute}${statute && "-"}${name}`}
          </li>
          <li className="flex mb2">
            <span className="w6rem shrink-none fw7">Severity</span> {level}
          </li>
          <li className="flex mb2">
            <span className="w6rem shrink-none fw7">Disposition</span>{" "}
            {describeDisposition(disposition)}
          </li>
          <li className="flex mb2">
            <span className="w6rem shrink-none fw7">Charged</span> {date}
          </li>
        </ul>
      </div>

      <ExpungementRules expungement_rules={charge.expungement_rules} />

      <SB819Criteria analysis={analysis} />
    </div>
  );
}
