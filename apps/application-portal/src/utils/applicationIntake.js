export function isPendingApplicationIntakeClosed(application) {
  return (
    application?.applicationIntakeOpen === false &&
    application?.admissionDecision === "pending" &&
    application?.status === "pending"
  );
}
