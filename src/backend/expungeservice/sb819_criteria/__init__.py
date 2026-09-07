"""County registry for SB-819 limiting criteria.

Each county's District Attorney publishes its own criteria. Adding a county means adding a
module here and one entry in RULESETS; nothing else in the analysis changes.
"""

from typing import Dict, Optional

from expungeservice.models.sb819 import SB819Ruleset
from expungeservice.sb819_criteria import multnomah

RULESETS: Dict[str, SB819Ruleset] = {
    multnomah.COUNTY.lower(): multnomah.RULESET,
}


def for_county(location: str) -> Optional[SB819Ruleset]:
    """The ruleset for a case location, or None where no criteria are implemented.

    Charges in counties without a ruleset stay out of the SB-819 view entirely. Marking
    them ineligible would read as a decision the DA has not made.
    """
    return RULESETS.get(location.lower().strip()) if location else None
