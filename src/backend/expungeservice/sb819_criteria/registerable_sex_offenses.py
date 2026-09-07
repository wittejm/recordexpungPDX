"""Offenses requiring sex offender reporting under ORS 163A.

The Multnomah County Justice Integrity Unit excludes registerable sex offenses from the
Collateral Consequences pathway (SB-819 Application Information Sheet, page 5).

"Sex crime" is defined at ORS 163A.005(5)(a) to (bb). That definition is broader than
models/charge_types/sex_crimes.py, which enumerates only the crimes ORS 137.225(6)(a)
excludes from expungement, so the two lists are kept separate.

Statutes are stored in the stripped, uppercased form that ChargeCreator produces.
"""

from typing import List

# ORS 163A.005(5)(a) to (y). Paragraphs (z), (aa) and (bb) extend the definition to
# attempt, burglary with intent, and conspiracy, which are handled separately below.
REGISTERABLE_SEX_OFFENSE_STATUTES: List[str] = [
    # (a) Rape in any degree
    "163355",  # Rape III
    "163365",  # Rape II
    "163375",  # Rape I
    # (b) Sodomy in any degree
    "163385",  # Sodomy III
    "163395",  # Sodomy II
    "163405",  # Sodomy I
    # (c) Unlawful sexual penetration in any degree
    "163408",  # Unlawful sexual penetration II
    "163411",  # Unlawful sexual penetration I
    # (d) Sexual abuse in any degree
    "163415",  # Sexual abuse III
    "163425",  # Sexual abuse II
    "163427",  # Sexual abuse I
    # (e) Incest with a child victim
    "163525",  # Incest
    # (f) Using a child in a display of sexually explicit conduct
    "163670",
    # (g) Encouraging child sexual abuse in any degree
    "163684",  # Encouraging child sexual abuse I
    "163686",  # Encouraging child sexual abuse II
    "163687",  # Encouraging child sexual abuse III
    # (h) Transporting child pornography into the state
    "163677",
    # (i) Paying for viewing a child's sexually explicit conduct
    "163680",
    # (j) Compelling prostitution
    "167017",
    # (k) Promoting prostitution
    "167012",
    # (L) Kidnapping I if the victim was under 18
    "163235",
    # (m) Contributing to the sexual delinquency of a minor
    "163435",
    # (n) Sexual misconduct if the offender is at least 18
    "163445",
    # (o) Possession of materials depicting sexually explicit conduct of a child I
    "163688",
    # (p) Kidnapping II if the victim was under 18
    "163225",
    # (q) Online sexual corruption of a child in any degree
    "163432",  # Online sexual corruption of a child II
    "163433",  # Online sexual corruption of a child I
    # (r) Luring a minor, on a court designation
    "167057",
    # (s) Sexual assault of an animal
    "167333",
    # (t) Public indecency or private indecency, with a prior conviction from this list
    "163465",  # Public indecency
    "163467",  # Private indecency
    # (u) Trafficking in persons under ORS 163.266(1)(b) or (c)
    "163266",
    # (v) Purchasing sex with a minor, on a court designation or a repeat conviction
    "163413",
    # (w) Invasion of personal privacy I, on a court designation
    "163701",
    # (x) Sexual abuse by fraudulent representation
    "163429",
    # (y) Abuse of a corpse I under ORS 166.087(1)(a)
    "166087",
]

"""
Several offenses register only in circumstances OECI does not record: a victim under 18
for either degree of kidnapping, an offender at least 18 for sexual misconduct, a prior
conviction for public or private indecency, a court designation for luring a minor,
purchasing sex with a minor, and invasion of personal privacy. Treating them as
registerable is the conservative reading, since an applicant told they may be eligible
and then rejected is the outcome this feature exists to prevent.
"""
CONDITIONALLY_REGISTERABLE_STATUTES: List[str] = [
    "163235",  # Kidnapping I, only if the victim was under 18
    "163225",  # Kidnapping II, only if the victim was under 18
    "163445",  # Sexual misconduct, only if the offender was at least 18
    "163465",  # Public indecency, only with a prior conviction from the list
    "163467",  # Private indecency, only with a prior conviction from the list
    "167057",  # Luring a minor, only on a court designation
    "163413",  # Purchasing sex with a minor, only on a designation or repeat conviction
    "163701",  # Invasion of personal privacy I, only on a court designation
    "163266",  # Trafficking in persons, only under subsection (1)(b) or (c)
    "166087",  # Abuse of a corpse I, only under subsection (1)(a)
]

ATTEMPT_NAME_MARKERS = ["attempt to commit", "attempted"]
CONSPIRACY_NAME_MARKERS = ["conspiracy", "conspire"]


def _section(statute: str) -> str:
    return statute[:6].upper()


def is_registerable_sex_offense(statute: str, name: str = "") -> bool:
    """ORS 163A.005(5). Covers the enumerated crimes and, per (z) and (bb), attempts and
    conspiracies to commit them.

    Burglary with intent to commit a listed offense, paragraph (aa), is not detectable:
    OECI records the burglary statute without the underlying intent.
    """
    if _section(statute) in REGISTERABLE_SEX_OFFENSE_STATUTES:
        return True
    lowered = name.lower()
    is_inchoate = any(marker in lowered for marker in ATTEMPT_NAME_MARKERS + CONSPIRACY_NAME_MARKERS)
    if is_inchoate:
        return any(
            crime in lowered
            for crime in ["rape", "sodomy", "sexual penetration", "sexual abuse", "sexual conduct", "prostitution"]
        )
    return False


def is_conditionally_registerable(statute: str) -> bool:
    """True when registration turns on a fact OECI does not record."""
    return _section(statute) in CONDITIONALLY_REGISTERABLE_STATUTES
