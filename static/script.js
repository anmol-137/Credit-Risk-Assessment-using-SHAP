
"use strict";

// Same-origin requests: the frontend and API are hosted on the same Render service.
const API_BASE = "";

const form = document.getElementById("form");
const apiStatus = document.getElementById("apiStatus");
const apiStatusText = document.getElementById("apiStatusText");

const panel = document.getElementById("panel");
const resultIndicator = document.getElementById("resultIndicator");
const gaugeBox = document.getElementById("gaugeBox");
const arcFill = document.getElementById("arcFill");
const needle = document.getElementById("needle");
const cutoffTick = document.getElementById("cutoffTick");

const pct = document.getElementById("pct");
const pctUnit = document.getElementById("pctUnit");
const verdict = document.getElementById("verdict");
const verdictIcon = document.getElementById("verdictIcon");
const verdictText = document.getElementById("verdictText");
const message = document.getElementById("message");

const factProb = document.getElementById("factProb");
const factCut = document.getElementById("factCut");
const factGap = document.getElementById("factGap");

const share = document.getElementById("share");
const gradeError = document.getElementById("gradeError");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");
const sampleBtn = document.getElementById("sampleBtn");
const resetBtn = document.getElementById("resetBtn");
const historyList = document.getElementById("history");
const historyCount = document.getElementById("historyCount");

const MAX_HISTORY = 5;
let assessments = [];
let requestInProgress = false;

const sampleApplication = {
  person_age: 28,
  person_income: 600000,
  person_home_ownership: "RENT",
  person_emp_length: 4,
  loan_intent: "PERSONAL",
  loan_grade: "B",
  loan_amnt: 120000,
  loan_int_rate: 11.5,
  cb_person_default_on_file: "N",
  cb_person_cred_hist_length: 5
};

function setApiStatus(state, text) {
  apiStatus.dataset.state = state;
  apiStatusText.textContent = text;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function showError(text) {
  gradeError.textContent = text;
  gradeError.hidden = false;
}

function clearError() {
  gradeError.textContent = "";
  gradeError.hidden = true;
}

function updateLoanRatio() {
  const income = Number(document.getElementById("person_income").value);
  const amount = Number(document.getElementById("loan_amnt").value);

  if (
    document.getElementById("person_income").value === "" ||
    document.getElementById("loan_amnt").value === "" ||
    !Number.isFinite(income) ||
    !Number.isFinite(amount) ||
    income <= 0 ||
    amount < 0
  ) {
    share.textContent = "Enter income and loan amount";
    return;
  }

  const ratio = amount / income;
  share.textContent = `${ratio.toFixed(4)} (${(ratio * 100).toFixed(2)}%)`;
}

function setLoading(loading) {
  requestInProgress = loading;
  submitBtn.disabled = loading;
  sampleBtn.disabled = loading;
  resetBtn.disabled = loading;
  btnText.textContent = loading ? "Assessing application…" : "Assess credit risk";

  if (loading) {
    panel.dataset.state = "loading";
    resultIndicator.textContent = "PROCESSING";
    verdictIcon.textContent = "…";
    verdictText.textContent = "Assessment in progress";
    message.textContent = "Your application is being evaluated by the deployed model.";
  }
}

function resetResult() {
  panel.dataset.state = "idle";
  resultIndicator.textContent = "AWAITING INPUT";

  pct.textContent = "—";
  pctUnit.textContent = "%";

  arcFill.style.strokeDasharray = "0 100";
  needle.style.transform = "rotate(-90deg)";
  cutoffTick.style.transform = "rotate(0deg)";
  cutoffTick.style.transformOrigin = "160px 155px";

  verdictIcon.textContent = "◎";
  verdictText.textContent = "Ready to assess";
  message.textContent = "Submit a borrower profile to generate a prediction.";

  factProb.textContent = "—";
  factCut.textContent = "—";
  factGap.textContent = "—";
}

function showApiError(text) {
  panel.dataset.state = "error";
  resultIndicator.textContent = "ASSESSMENT FAILED";
  verdictIcon.textContent = "!";
  verdictText.textContent = "Unable to assess";
  message.textContent = text;
}

function renderResult(data) {
  const probability = Number(data.default_probability);
  const threshold = Number(data.threshold);
  const prediction = Number(data.default_prediction);

  if (
    !Number.isFinite(probability) ||
    probability < 0 ||
    probability > 1 ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 1 ||
    ![0, 1].includes(prediction)
  ) {
    throw new Error("The API returned an invalid prediction response.");
  }

  const isHighRisk = prediction === 1;
  const gap = Math.abs(probability - threshold);

  panel.dataset.state = isHighRisk ? "high" : "low";
  gaugeBox.classList.add("has-result");

  resultIndicator.textContent = isHighRisk ? "HIGH RISK" : "LOW RISK";

  pct.textContent = (probability * 100).toFixed(2);
  pctUnit.textContent = "%";

  // The gauge arc is a semicircle, so 0–100% maps to 0–50 path units.
  const arcUnits = probability * 50;
  arcFill.style.strokeDasharray = `${arcUnits} 100`;

  // The needle sweeps from the left end (-90°) to the right end (+90°).
  const needleAngle = -90 + probability * 180;
  needle.style.transform = `rotate(${needleAngle}deg)`;

  // The threshold marker follows the same probability scale.
  const thresholdAngle = -90 + threshold * 180;
  cutoffTick.style.transform = `rotate(${thresholdAngle}deg)`;

  verdictIcon.textContent = isHighRisk ? "!" : "✓";
  verdictText.textContent = isHighRisk ? "Higher default risk" : "Lower default risk";

  if (isHighRisk) {
    message.textContent =
      "The estimated probability meets or exceeds the model's decision threshold. Review the application carefully.";
  } else {
    message.textContent =
      "The estimated probability is below the model's decision threshold. This does not guarantee repayment.";
  }

  factProb.textContent = formatPercent(probability);
  factCut.textContent = formatPercent(threshold);
  factGap.textContent = `${(gap * 100).toFixed(2)} pp`;

  addHistory({
    risk: isHighRisk ? "high" : "low",
    probability,
    age: Number(document.getElementById("person_age").value),
    amount: Number(document.getElementById("loan_amnt").value)
  });
}

function addHistory(item) {
  assessments.unshift(item);
  assessments = assessments.slice(0, MAX_HISTORY);

  historyList.replaceChildren();

  assessments.forEach((assessment) => {
    const li = document.createElement("li");
    li.className = assessment.risk;

    const dot = document.createElement("span");
    dot.className = "h-dot";
    dot.setAttribute("aria-hidden", "true");

    const description = document.createElement("span");
    description.className = "h-desc";
    description.textContent =
      `${formatMoney(assessment.amount)} · Age ${assessment.age}`;

    const value = document.createElement("span");
    value.className = "h-val";
    value.textContent = formatPercent(assessment.probability);

    li.append(dot, description, value);
    historyList.appendChild(li);
  });

  historyCount.textContent =
    `${assessments.length} ${assessments.length === 1 ? "check" : "checks"}`;
}

async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Health endpoint returned HTTP ${response.status}`);
    }

    const health = await response.json();

    if (health.model_loaded === true && health.threshold_loaded === true) {
      setApiStatus("online", "API and model online");
    } else {
      setApiStatus("offline", "API online · Model not ready");
    }
  } catch (error) {
    console.error("API health check failed:", error);
    setApiStatus("offline", "API unavailable");
  }
}

function getPayload() {
  const formData = new FormData(form);
  const income = Number(formData.get("person_income"));
  const amount = Number(formData.get("loan_amnt"));

  if (!Number.isFinite(income) || income <= 0) {
    throw new Error("Annual income must be greater than zero.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Loan amount must be greater than zero.");
  }

  const payload = {
    person_age: Number(formData.get("person_age")),
    person_income: income,
    person_home_ownership: formData.get("person_home_ownership"),
    person_emp_length: Number(formData.get("person_emp_length")),
    loan_intent: formData.get("loan_intent"),
    loan_grade: formData.get("loan_grade"),
    loan_amnt: amount,
    loan_int_rate: Number(formData.get("loan_int_rate")),
    loan_percent_income: amount / income,
    cb_person_default_on_file: formData.get("cb_person_default_on_file"),
    cb_person_cred_hist_length: Number(
      formData.get("cb_person_cred_hist_length")
    )
  };

  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === "" || !Number.isFinite(
      typeof value === "number" ? value : 0
    )) {
      throw new Error(`Please provide a valid value for ${key}.`);
    }
  }

  if (payload.person_age < 18 || payload.person_age > 100) {
    throw new Error("Applicant age must be between 18 and 100.");
  }

  if (payload.person_emp_length < 0 || payload.person_emp_length > 100) {
    throw new Error("Employment length must be between 0 and 100 years.");
  }

  if (payload.loan_int_rate < 0 || payload.loan_int_rate > 100) {
    throw new Error("Interest rate must be between 0 and 100%.");
  }

  return payload;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (requestInProgress) return;

  clearError();

  if (!form.reportValidity()) return;

  let payload;

  try {
    payload = getPayload();
  } catch (error) {
    showError(error.message);
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = typeof data.detail === "string"
        ? data.detail
        : `The server returned HTTP ${response.status}.`;

      throw new Error(detail);
    }

    renderResult(data);
    setApiStatus("online", "API and model online");
  } catch (error) {
    console.error("Prediction request failed:", error);
    showApiError(error.message || "An unexpected error occurred.");
    setApiStatus("offline", "Prediction request failed");
  } finally {
    setLoading(false);
  }
});

sampleBtn.addEventListener("click", () => {
  for (const [key, value] of Object.entries(sampleApplication)) {
    const field = form.elements.namedItem(key);

    if (!field) continue;

    if (field instanceof RadioNodeList) {
      const option = form.querySelector(
        `input[name="${key}"][value="${value}"]`
      );

      if (option) option.checked = true;
    } else {
      field.value = String(value);
    }
  }

  updateLoanRatio();
  clearError();
});

form.addEventListener("input", (event) => {
  if (
    event.target.id === "person_income" ||
    event.target.id === "loan_amnt"
  ) {
    updateLoanRatio();
  }

  if (event.target.matches("input, select")) {
    clearError();
  }
});

form.addEventListener("change", clearError);

form.addEventListener("reset", () => {
  // Let the browser reset controls before refreshing derived output.
  window.setTimeout(() => {
    updateLoanRatio();
    clearError();
    resetResult();
  }, 0);
});

checkApiHealth();
