# SB-819 — Outstanding Questions

For Michael and Cody. The feature is on the demo page under the alias **sb / 819**, and the
**Full rules** link in the SB-819 view opens the logic sheet, which states every rule the
software applies and how each is determined. Try the feature and read the sheet; the
questions below are the points the sheet cannot settle on its own.

1. **Sentence completion.** Michael's table marks it "OECI only", but OECI carries no
   post-prison supervision or probation end date, and a case status of Closed describes the
   court case. It is asked of the client. Is there a signal we are missing?

2. **Registerable sex offences.** Does the criterion track the full ORS 163A reporting
   obligation, including out-of-state equivalents?

3. **"Sentenced as a felony."** Does it turn on the sentencing level rather than the charging
   level, and how should a reduced or amended disposition be treated? Today an amended or
   lesser-charge disposition turns the criterion into a question.

4. **Which county's criteria follow Multnomah?**

5. **How does OECI name an attempt or a conspiracy?** The registerable-sex-offence and
   person-crime tests read an inchoate charge off its name, matching the crime beside
   "attempt" or "conspir". If OECI records "Attempt to Commit a Class B Felony" without naming
   the object crime, these charges pass as not registerable, which is the wrong direction for
   a screening tool.

6. **Is the Date column on an OECI charge the offence date?** The under-18 alternative
   subtracts the birth year from it and fails the criterion at 19 or older. The rest of
   RecordSponge fills "Date of arrest" on the forms from the same column. For an offence
   prosecuted years later, an arrest date would overstate the age. If the column can be an
   arrest date, the 19-or-older branch should become a question.

7. **Should the two gates inform each other?** An applicant currently incarcerated has not
   completed the sentence, so Yes to the first could answer No to the second on every case.
   The reverse does not hold: No to incarceration says nothing about post-prison supervision.
   Today the two are asked independently.

Three readings on the sheet are the developer's, not the District Attorney's, and are worth a
look while reading it:

- **The filter/verdict split** in sections 1 and 2. Two of the four main criteria on page 3
  remove a charge from the analysis; two report it ineligible.
- **Conditionally registerable offences** are asked about, since the record cannot settle
  them either way.
- **The three criteria nobody can settle from the record or the client** take no part in any
  status, per section 5.5, so "Possibly SB-819 Eligible" means the record and the client have
  cleared everything they can.
