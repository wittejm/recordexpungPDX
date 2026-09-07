"""ORS 163A.005(5) defines the sex crimes that carry a reporting obligation."""

from expungeservice.models.charge_types.sex_crimes import SexCrime
from expungeservice.sb819_criteria.registerable_sex_offenses import (
    REGISTERABLE_SEX_OFFENSE_STATUTES,
    is_conditionally_registerable,
    is_registerable_sex_offense,
)


def test_enumerated_offenses_are_registerable():
    assert is_registerable_sex_offense("163365")  # Rape II
    assert is_registerable_sex_offense("163405")  # Sodomy I
    assert is_registerable_sex_offense("163429")  # Sexual abuse by fraudulent representation
    assert is_registerable_sex_offense("167333")  # Sexual assault of an animal
    assert is_registerable_sex_offense("163677")  # Transporting child pornography into the state
    assert is_registerable_sex_offense("163680")  # Paying for viewing a child's sexually explicit conduct


def test_a_statute_with_a_subsection_still_matches():
    assert is_registerable_sex_offense("1633751A")


def test_non_sex_crimes_are_not_registerable():
    assert not is_registerable_sex_offense("164405", "Robbery in the Second Degree")
    assert not is_registerable_sex_offense("163095", "Aggravated Murder")
    assert not is_registerable_sex_offense("813010", "Driving Under the Influence of Intoxicants")


def test_attempts_and_conspiracies_are_registerable():
    """ORS 163A.005(5)(z) and (bb) extend the definition to attempt and conspiracy."""
    assert is_registerable_sex_offense("161405", "Attempt to Commit Rape in the First Degree")
    assert is_registerable_sex_offense("161450", "Criminal Conspiracy to Commit Sexual Abuse I")


def test_an_attempt_at_a_non_sex_crime_is_not_registerable():
    assert not is_registerable_sex_offense("161405", "Attempt to Commit a Class A Misdemeanor")
    assert not is_registerable_sex_offense("161405", "Attempted Robbery in the First Degree")
    # Prostitution itself, ORS 167.007, is not on the list; compelling and promoting it are.
    assert not is_registerable_sex_offense("161405", "Attempt to Commit Prostitution")
    assert is_registerable_sex_offense("161405", "Attempt to Commit Promoting Prostitution")


def test_attempts_at_every_enumerated_crime_are_registerable():
    for name in [
        "Attempted Incest",
        "Attempt to Commit Encouraging Child Sexual Abuse in the First Degree",
        "Attempted Online Sexual Corruption of a Child in the Second Degree",
        "Attempted Using a Child in a Display of Sexually Explicit Conduct",
        "Attempt to Commit Contributing to the Sexual Delinquency of a Minor",
        "Attempted Sexual Assault of an Animal",
    ]:
        assert is_registerable_sex_offense("161405", name), name


def test_an_attempt_at_a_conditionally_registerable_crime_is_asked_about():
    """An attempt is registerable on the same unrecorded fact as the completed crime."""
    assert is_registerable_sex_offense("161405", "Attempt to Commit Kidnapping in the Second Degree")
    assert is_conditionally_registerable("161405", "Attempt to Commit Kidnapping in the Second Degree")
    assert is_conditionally_registerable("161405", "Attempted Luring a Minor")
    assert not is_conditionally_registerable("161405", "Attempt to Commit Rape in the First Degree")


def test_offenses_registerable_only_in_unrecorded_circumstances_are_flagged():
    assert is_conditionally_registerable("163235")  # Kidnapping I, only if the victim was under 18
    assert is_conditionally_registerable("163701")  # Invasion of privacy I, only on a court designation
    assert not is_conditionally_registerable("163365")  # Rape II registers unconditionally


def test_the_list_is_broader_than_the_expungement_sex_crime_list():
    """ORS 137.225(6)(a) and ORS 163A.005(5) are different lists for different purposes."""
    only_registerable = set(REGISTERABLE_SEX_OFFENSE_STATUTES) - set(SexCrime.statutes)
    assert "163355" in only_registerable  # Rape III registers but is a Romeo and Juliet exception
    assert "167333" in only_registerable  # Sexual assault of an animal
    assert "163429" in only_registerable  # Sexual abuse by fraudulent representation
