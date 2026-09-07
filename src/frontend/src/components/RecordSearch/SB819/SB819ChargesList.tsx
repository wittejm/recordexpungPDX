import React from "react";
import { SB819AnalysisData, SB819Status, statusColor } from "./types";

interface Props {
  analysis: SB819AnalysisData;
  statusBlurbs: { [key in SB819Status]: string };
}

function Charge({
  id,
  name,
  caseNumber,
}: {
  id: string;
  name: string;
  caseNumber: string;
}) {
  return (
    <li className="f6 bb b--light-gray pv2">
      <a href={"#" + id} className="link hover-blue">
        {caseNumber}: {name}
      </a>
    </li>
  );
}

export default function SB819ChargesList({ analysis, statusBlurbs }: Props) {
  return (
    <>
      {analysis.sections.map(({ status, charge_ids }) => {
        const color = statusColor(status);
        return (
          <div className="mb3" key={status}>
            <div className={color + " bb b--light-gray lh-copy pb1"}>
              <span className="fw7 mb2">{status}</span>{" "}
              {charge_ids.length > 0 && `(${charge_ids.length})`}
              <p className="f6 fw5 black">{statusBlurbs[status]}</p>
            </div>

            <ul className="list">
              {charge_ids.length === 0 ? (
                <li className="f6 gray pv2">None</li>
              ) : (
                charge_ids.map((id) => {
                  const charge = analysis.charges[id];
                  return (
                    <Charge
                      key={id}
                      id={id}
                      name={charge.charge_name}
                      caseNumber={charge.case_number}
                    />
                  );
                })
              )}
            </ul>
          </div>
        );
      })}
    </>
  );
}
