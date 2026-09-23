import React from "react";
import { Link } from "react-router-dom";
import { useAppDispatch } from "../../../redux/hooks";
import { hideSB819View } from "../../../redux/sb819Slice";
import scrollToPanel, {
  RECORD_SUMMARY_PANEL_ID,
  SB819_SUMMARY_PANEL_ID,
} from "./scrollToPanel";
import { SB819AnalysisData, SB819Status } from "./types";
import SB819ChargesList from "./SB819ChargesList";

interface Props {
  analysis: SB819AnalysisData;
  totalIneligibleCharges: number;
}

const STATUS_BLURBS: { [key in SB819Status]: string } = {
  "Possibly SB-819 Eligible":
    "Nothing in the record disqualifies these convictions, and no question is left open.",
  "Needs More Analysis":
    "Nothing in the record disqualifies these convictions, but the criteria below turn on facts the client has to confirm.",
  "SB-819 Ineligible":
    "These convictions fail a criterion that can be settled from the record.",
};

export default function SB819Summary({
  analysis,
  totalIneligibleCharges,
}: Props) {
  const dispatch = useAppDispatch();
  const counties = analysis.counties_analyzed.join(", ");

  return (
    <div
      id={SB819_SUMMARY_PANEL_ID}
      className="bg-white shadow br3 mb3 ph3 pb3 scroll-mt-20"
    >
      <div className="flex flex-wrap justify-end mb1">
        <h2 className="f5 fw7 mv3 mr-auto">SB-819 Eligibility Analysis</h2>

        <button
          onClick={() => {
            dispatch(hideSB819View());
            scrollToPanel(RECORD_SUMMARY_PANEL_ID);
          }}
          className="inline-flex bg-white f6 fw5 br2 ba b--black-10 mid-gray link hover-blue pv1 ph2 mv2"
        >
          <span className="fas fa-arrow-left pr2" aria-hidden="true"></span>
          Back to Search Summary
        </button>
      </div>

      <div className="bt b--light-gray pt2">
        <Link
          to="/sb819-rules"
          className="link bb hover-blue f6 fw6"
          target="_blank"
          rel="noopener noreferrer"
        >
          Full rules
        </Link>
      </div>

      <div className="pt3">
        <p className="f6 mb2">
          SB 819 lets the {counties} County District Attorney petition jointly
          with a client to reconsider a conviction expungement cannot reach. The
          office publishes limiting criteria that decide which applications it
          will screen at all.
        </p>
        <p className="f6 mb3">
          This view covers the {totalIneligibleCharges}{" "}
          {totalIneligibleCharges === 1 ? "conviction" : "convictions"} from{" "}
          {counties} County that RecordSponge found ineligible under ORS
          137.225. Convictions from other counties are not shown, because no
          criteria are implemented for them yet.
        </p>
      </div>

      <SB819ChargesList analysis={analysis} statusBlurbs={STATUS_BLURBS} />
    </div>
  );
}
