const DEFAULT_SURGERY_YEAR = 2024;
const REFERENCE_AGE = 50;
const REFERENCE_BODY_MASS_INDEX = 27;
const MODEL_INPUT_SCALE = 10;

const MODEL_COEFFICIENTS = Object.freeze({
  intraoperative: {
    intercept: -4.52,
    surgeryYear: -0.18,
    age: 0.14,
    bodyMassIndex: 0.43,
    bodyMassIndexMissing: -1.63,
    higherEducation: -0.11,
    educationLevelMissing: 0.18,
    asaClass: {
      "1": 0,
      "2": 0.01,
      "3-or-higher": 0.2,
    },
    priorLaparoscopy: {
      none: 0,
      one: -0.05,
      "more-than-one": 0.17,
    },
    priorLaparoscopyMissing: 0.74,
    priorLaparotomy: 0.34,
    priorLaparotomyMissing: -0.11,
    hospitalVolume: {
      "49-or-fewer": 0,
      "50-to-99": -0.06,
      "100-or-more": -0.33,
    },
    indication: {
      "none-of-these": 0,
      "corpus-cancer": -0.03,
      "cervical-cancer": -0.51,
      fibroma: 0.58,
      "pain-endometriosis-adenomyosis": -0.36,
    },
    hysterectomyType: {
      total: 0,
      supracervical: -0.72,
      other: 0.74,
      radical: -1.1,
    },
    robotAssisted: -0.17,
  },
  postoperative: {
    intercept: -3.25,
    surgeryYear: -0.03,
    age: -0.12,
    bodyMassIndex: -0.13,
    bodyMassIndexMissing: -1.55,
    higherEducation: 0.2,
    educationLevelMissing: 0.2,
    asaClass: {
      "1": 0,
      "2": 0.08,
      "3-or-higher": 0.45,
    },
    priorLaparoscopy: {
      none: 0,
      one: 0.03,
      "more-than-one": 0.23,
    },
    priorLaparoscopyMissing: 0.45,
    priorLaparotomy: 0.17,
    priorLaparotomyMissing: 0.1,
    hospitalVolume: {
      "49-or-fewer": 0,
      "50-to-99": -0.29,
      "100-or-more": -0.21,
    },
    indication: {
      "none-of-these": 0,
      "corpus-cancer": -0.38,
      "cervical-cancer": 0.84,
      fibroma: 0.18,
      "pain-endometriosis-adenomyosis": 0.37,
    },
    hysterectomyType: {
      total: 0,
      supracervical: -0.65,
      other: 0.1,
      radical: 0.66,
    },
    robotAssisted: -0.19,
  },
});

function calculateBodyMassIndex(heightCentimeters, weightKilograms) {
  const heightMeters = heightCentimeters / 100;

  return weightKilograms / (heightMeters * heightMeters);
}

function booleanAsNumber(value) {
  if (value) {
    return 1;
  }

  return 0;
}

function getCategoryCoefficient(coefficientsByCategory, category, fieldName) {
  const coefficient = coefficientsByCategory[category];

  if (typeof coefficient === "undefined") {
    throw new Error(`Ugyldig verdi for ${fieldName}.`);
  }

  return coefficient;
}

function calculateLogOdds(modelCoefficients, modelInput) {
  const surgeryYearDifference = modelInput.surgeryYear - DEFAULT_SURGERY_YEAR;
  const ageDifferenceFromReference =
    (modelInput.age - REFERENCE_AGE) / MODEL_INPUT_SCALE;

  let logOdds =
    modelCoefficients.intercept +
    modelCoefficients.surgeryYear * surgeryYearDifference +
    modelCoefficients.age * ageDifferenceFromReference;

  if (modelInput.bodyMassIndexMissing) {
    logOdds += modelCoefficients.bodyMassIndexMissing;
  } else {
    const bodyMassIndexDifferenceFromReference =
      (modelInput.bodyMassIndex - REFERENCE_BODY_MASS_INDEX) / MODEL_INPUT_SCALE;

    logOdds +=
      modelCoefficients.bodyMassIndex * bodyMassIndexDifferenceFromReference;
  }

  if (modelInput.educationLevelMissing) {
    logOdds += modelCoefficients.educationLevelMissing;
  } else {
    const hasHigherEducation =
      modelInput.educationLevel === "college-or-university";

    logOdds +=
      modelCoefficients.higherEducation * booleanAsNumber(hasHigherEducation);
  }

  logOdds += getCategoryCoefficient(
    modelCoefficients.asaClass,
    modelInput.asaClass,
    "ASA-klasse",
  );

  if (modelInput.priorLaparoscopyMissing) {
    logOdds += modelCoefficients.priorLaparoscopyMissing;
  } else {
    logOdds += getCategoryCoefficient(
      modelCoefficients.priorLaparoscopy,
      modelInput.priorLaparoscopy,
      "tidligere laparoskopi",
    );
  }

  if (modelInput.priorLaparotomyMissing) {
    logOdds += modelCoefficients.priorLaparotomyMissing;
  } else {
    const hasPriorLaparotomy = modelInput.priorLaparotomy === "yes";
    logOdds +=
      modelCoefficients.priorLaparotomy *
      booleanAsNumber(hasPriorLaparotomy);
  }

  logOdds += getCategoryCoefficient(
    modelCoefficients.hospitalVolume,
    modelInput.hospitalVolume,
    "sykehusvolum",
  );

  for (const indication of modelInput.indications) {
    logOdds += getCategoryCoefficient(
      modelCoefficients.indication,
      indication,
      "indikasjon",
    );
  }

  logOdds += getCategoryCoefficient(
    modelCoefficients.hysterectomyType,
    modelInput.hysterectomyType,
    "type hysterektomi",
  );

  const isRobotAssisted = modelInput.robotAssisted === "yes";

  logOdds +=
    modelCoefficients.robotAssisted * booleanAsNumber(isRobotAssisted);

  return logOdds;
}

function convertLogOddsToProbability(logOdds) {
  if (logOdds >= 0) {
    return 1 / (1 + Math.exp(-logOdds));
  }

  const exponentiatedLogOdds = Math.exp(logOdds);

  return exponentiatedLogOdds / (1 + exponentiatedLogOdds);
}

function calculateRisks(modelInput) {
  const intraoperativeLogOdds = calculateLogOdds(
    MODEL_COEFFICIENTS.intraoperative,
    modelInput,
  );

  const postoperativeLogOdds = calculateLogOdds(
    MODEL_COEFFICIENTS.postoperative,
    modelInput,
  );

  return {
    intraoperativeLogOdds,
    intraoperativeProbability:
      convertLogOddsToProbability(intraoperativeLogOdds),
    postoperativeLogOdds,
    postoperativeProbability: convertLogOddsToProbability(postoperativeLogOdds),
  };
}

globalThis.riskModel = Object.freeze({
  calculateBodyMassIndex,
  calculateRisks,
});
