export function isUnsubmittedApplicationIntakeClosed(application) {
  const applicationFormSubmitted =
    typeof application?.applicationFormSubmitted === "boolean"
      ? application.applicationFormSubmitted
      : Boolean(application?.submittedAt);

  return (
    application?.applicationIntakeOpen === false &&
    application?.admissionDecision === "pending" &&
    application?.status === "pending" &&
    !applicationFormSubmitted
  );
}
