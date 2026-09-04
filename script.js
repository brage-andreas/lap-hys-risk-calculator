const calculatorForm = document.querySelector("#risk-calculator");
const heightInput = document.querySelector("#height");
const weightInput = document.querySelector("#weight");
const resultsSection = document.querySelector("#results");
const intraoperativeRiskOutput = document.querySelector(
  "#intraoperative-risk",
);
const postoperativeRiskOutput = document.querySelector("#postoperative-risk");

let numberFormatLocale = "nb-NO";

if (document.documentElement.lang === "en") {
  numberFormatLocale = "en-US";
}

const percentageFormatter = new Intl.NumberFormat(numberFormatLocale, {
  style: "percent",
  roundingMode: "halfEven",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

function readBodyMassIndex() {
  const heightCentimeters = Number(heightInput.value);
  const weightKilograms = Number(weightInput.value);

  return riskModel.calculateBodyMassIndex(
    heightCentimeters,
    weightKilograms,
  );
}

function readModelInput() {
  const submittedValues = new FormData(calculatorForm);

  return {
    surgeryYear: 2024,
    age: Number(submittedValues.get("age")),
    bodyMassIndex: readBodyMassIndex(),
    bodyMassIndexMissing: false,
    educationLevel: submittedValues.get("educationLevel"),
    educationLevelMissing: false,
    asaClass: submittedValues.get("asaClass"),
    priorLaparoscopy: submittedValues.get("priorLaparoscopy"),
    priorLaparoscopyMissing: false,
    priorLaparotomy: submittedValues.get("priorLaparotomy"),
    priorLaparotomyMissing: false,
    hospitalVolume: submittedValues.get("hospitalVolume"),
    indications: submittedValues.getAll("indication"),
    hysterectomyType: submittedValues.get("hysterectomyType"),
    robotAssisted: submittedValues.get("robotAssisted"),
  };
}

function displayResults(risks) {
  intraoperativeRiskOutput.value = percentageFormatter.format(
    risks.intraoperativeProbability,
  );

  postoperativeRiskOutput.value = percentageFormatter.format(
    risks.postoperativeProbability,
  );

  resultsSection.hidden = false;
}

calculatorForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const modelInput = readModelInput();
  const risks = riskModel.calculateRisks(modelInput);

  displayResults(risks);
});

calculatorForm.addEventListener("reset", () => {
  intraoperativeRiskOutput.value = "-";
  postoperativeRiskOutput.value = "-";
  resultsSection.hidden = true;
});
