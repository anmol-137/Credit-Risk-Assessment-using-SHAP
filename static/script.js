/* ==========================================================
   Underwrite: credit risk UI
   - Talks to the FastAPI backend (/health and /predict)
   - Animates the risk gauge
   ========================================================== */

(() => {
  "use strict";

  // Leave empty when the UI is served by the same FastAPI app (recommended).
  // If you host the UI somewhere else, set it to your API URL, e.g.
  // "https://your-service.onrender.com" (and enable CORS on the API).
  const API_BASE = "";

  const MIN_SCAN_MS = 1100;          // keep the "scoring" animation visible at least this long
  const REQUEST_TIMEOUT_MS = 60000;  // free Render instances can take a while to wake up
  const HEALTH_RETRIES = 12;
  const HEALTH_RETRY_MS = 4000;
  const MAX_HISTORY = 5;

  /* ---------- Elements ---------- */

  const $ = (sel) => document.querySelector(sel);

  const form = $("#form");
  const submitBtn = $("#submitBtn");
  const btnText = $("#btnText");
  const shareOut = $("#share");
  const gradeError = $("#gradeError");

  const panel = $("#panel");
  const gaugeBox = $("#gaugeBox");
  const needle = $("#needle");
  const arcFill = $("#arcFill");
  const zoneLow = $("#zoneLow");
  const zoneHigh = $("#zoneHigh");
  const cutoffTick = $("#cutoffTick");

  const pctEl = $("#pct");
  const pctUnit = $("#pctUnit");
  const verdictEl = $("#verdict");
  const verdictText = $("#verdictText");
  const messageEl = $("#message");
  const factsEl = $("#facts");
  const factProb = $("#factProb");
  const factCut = $("#factCut");
  const factGap = $("#factGap");
  const historyWrap = $("#historyWrap");
  const historyList = $("#history");

  const statusEl = $("#status");
  const statusText = $("#statusText");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isNarrow = () => window.matchMedia("(max-width: 960px)").matches;

  /* ---------- Small helpers ---------- */

  const clamp01 = (n) => Math.min(1, Math.max(0, n));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pct1 = (p) => (p * 100).toFixed(1);

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => {
    const c1 = 1.15;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  /* ==========================================================
     Gauge
     value is 0..1. The needle sweeps from -90deg to +90deg.
     ========================================================== */

  const gauge = { value: 0, raf: 0, scanning: false };

  function renderGauge(p) {
    const v = clamp01(p);
    gauge.value = v;
    needle.setAttribute("transform", `rotate(${-90 + v * 180} 150 150)`);
    arcFill.setAttribute("stroke-dasharray", `${v * 100} 100`);
  }

  function setNumber(v) {
    pctEl.textContent = pct1(Math.max(0, v));
    pctUnit.hidden = false;
  }

  function clearNumber() {
    pctEl.textContent = "—";
    pctUnit.hidden = true;
  }

  function tween(to, duration, onNumber) {
    cancelAnimationFrame(gauge.raf);
    const from = gauge.value;

    if (reduceMotion.matches || duration <= 0) {
      renderGauge(to);
      if (onNumber) onNumber(to);
      return Promise.resolve();
    }

    const start = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        renderGauge(from + (to - from) * easeOutBack(t));
        if (onNumber) onNumber(from + (to - from) * easeOutCubic(t));
        if (t < 1) {
          gauge.raf = requestAnimationFrame(step);
        } else {
          renderGauge(to);
          resolve();
        }
      };
      gauge.raf = requestAnimationFrame(step);
    });
  }

  // Needle swings back and forth while the request is in flight.
  function startScan() {
    cancelAnimationFrame(gauge.raf);
    gauge.scanning = true;
    clearNumber();

    if (reduceMotion.matches) {
      renderGauge(0.5);
      return;
    }

    const amp = 0.42;
    const phase = Math.asin(Math.max(-1, Math.min(1, (gauge.value - 0.5) / amp)));
    const t0 = performance.now();

    const step = (now) => {
      if (!gauge.scanning) return;
      const s = (now - t0) / 1000;
      renderGauge(0.5 + amp * Math.sin(s * 3.2 + phase));
      gauge.raf = requestAnimationFrame(step);
    };
    gauge.raf = requestAnimationFrame(step);
  }

  function stopScan() {
    gauge.scanning = false;
    cancelAnimationFrame(gauge.raf);
  }

  function setCutoff(t) {
    const c = clamp01(t);
    zoneLow.setAttribute("stroke-dasharray", `${c * 100} 100`);
    zoneHigh.setAttribute("stroke-dasharray", `0 ${c * 100} ${(1 - c) * 100} 100`);
    cutoffTick.setAttribute("transform", `rotate(${-90 + c * 180} 150 150)`);
    gaugeBox.classList.add("has-result");
  }

  // One-time hello on page load: the needle sweeps across and settles at zero.
  function introSweep() {
    if (reduceMotion.matches) return;
    setTimeout(async () => {
      if (gauge.scanning || panel.dataset.state !== "idle") return;
      await tween(0.55, 900);
      if (gauge.scanning || panel.dataset.state !== "idle") return;
      await tween(0, 900);
    }, 500);
  }

  /* ==========================================================
     Panel state
     ========================================================== */

  function setPanelState(state) {
    panel.dataset.state = state;
  }

  function resetResultView() {
    verdictEl.hidden = true;
    factsEl.hidden = true;
    gaugeBox.classList.remove("has-result");
  }

  /* ==========================================================
     Form helpers
     ========================================================== */

  function updateShare() {
    const income = parseFloat(form.elements.person_income.value);
    const amount = parseFloat(form.elements.loan_amnt.value);

    if (income > 0 && amount >= 0) {
      const share = Math.round((amount / income) * 100) / 100;
      shareOut.textContent = `${Math.round(share * 100)}%`;
      shareOut.classList.add("has-value");
      return share;
    }

    shareOut.textContent = "Calculated";
    shareOut.classList.remove("has-value");
    return null;
  }

  function collectPayload() {
    const f = form.elements;
    return {
      person_age: Math.round(Number(f.person_age.value)),
      person_income: Number(f.person_income.value),
      person_home_ownership: f.person_home_ownership.value,
      person_emp_length: Number(f.person_emp_length.value),
      loan_intent: f.loan_intent.value,
      loan_grade: f.loan_grade.value,
      loan_amnt: Number(f.loan_amnt.value),
      loan_int_rate: Number(f.loan_int_rate.value),
      loan_percent_income: updateShare(),
      cb_person_default_on_file: f.cb_person_default_on_file.value,
      cb_person_cred_hist_length: Math.round(Number(f.cb_person_cred_hist_length.value)),
    };
  }

  const SAMPLES = {
    low: {
      person_age: 36,
      person_income: 92000,
      person_home_ownership: "MORTGAGE",
      person_emp_length: 9,
      loan_intent: "HOMEIMPROVEMENT",
      loan_grade: "A",
      loan_amnt: 8000,
      loan_int_rate: 7.5,
      cb_person_default_on_file: "N",
      cb_person_cred_hist_length: 12,
    },
    high: {
      person_age: 23,
      person_income: 26000,
      person_home_ownership: "RENT",
      person_emp_length: 1,
      loan_intent: "MEDICAL",
      loan_grade: "F",
      loan_amnt: 14000,
      loan_int_rate: 19.8,
      cb_person_default_on_file: "Y",
      cb_person_cred_hist_length: 2,
    },
  };

  function fillSample(key) {
    const data = SAMPLES[key];
    if (!data) return;

    Object.entries(data).forEach(([name, value]) => {
      const radio = form.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
      if (radio) {
        radio.checked = true;
      } else if (form.elements[name]) {
        form.elements[name].value = value;
      }
    });

    clearGradeError();
    updateShare();
  }

  function showGradeError() {
    gradeError.hidden = false;
    gradeError.previousElementSibling.previousElementSibling.classList.add("is-invalid");
    const first = form.querySelector('input[name="loan_grade"]');
    if (first) first.focus();
  }

  function clearGradeError() {
    gradeError.hidden = true;
    gradeError.previousElementSibling.previousElementSibling.classList.remove("is-invalid");
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.classList.toggle("is-busy", busy);
    btnText.textContent = busy ? "Checking…" : "Check default risk";
  }

  /* ==========================================================
     API
     ========================================================== */

  class ApiError extends Error {
    constructor(kind, message) {
      super(message);
      this.kind = kind;
    }
  }

  async function httpError(res) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail !== undefined ? body.detail : "";
    } catch (_) {
      /* response had no JSON body */
    }

    if (res.status === 422 && Array.isArray(detail)) {
      const items = detail.map((d) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "value";
        return `${String(field).replace(/_/g, " ")}: ${d.msg}`;
      });
      return new ApiError("validation", `Some values were rejected. ${items.join("; ")}.`);
    }

    if (res.status === 503) {
      return new ApiError("unavailable", "The model isn't loaded yet. Try again in a few seconds.");
    }

    if (res.status >= 500) {
      const text = typeof detail === "string" && detail ? ` ${detail}` : "";
      return new ApiError(
        "server",
        `The model couldn't score this application.${text} Check that the category values match what the model was trained on.`
      );
    }

    return new ApiError("http", `The request failed (status ${res.status}).`);
  }

  async function predict(payload) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) throw await httpError(res);
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err.name === "AbortError") {
        throw new ApiError("timeout", "The request took too long. Try again in a moment.");
      }
      throw new ApiError(
        "network",
        "Couldn't reach the API. If the service was idle it may still be starting, so wait a few seconds and try again."
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /* ==========================================================
     Showing results
     ========================================================== */

  async function showResult(result, payload) {
    const p = clamp01(Number(result.default_probability));
    const t = clamp01(Number(result.threshold));
    const high = Number(result.default_prediction) === 1;

    setCutoff(t);
    setPanelState(high ? "high" : "low");

    await tween(p, 1500, setNumber);

    verdictText.textContent = result.result || (high ? "High Risk" : "Low Risk");
    verdictEl.hidden = false;

    const relation = high ? "at or above" : "under";
    const stance = high ? "high risk" : "low risk";
    messageEl.textContent =
      `The predicted default probability is ${pct1(p)}%, which is ${relation} the ` +
      `${pct1(t)}% cutoff. The model treats this application as ${stance}.`;

    const gap = Math.abs(p - t) * 100;
    factProb.textContent = `${pct1(p)}%`;
    factCut.textContent = `${pct1(t)}%`;
    factGap.textContent = `${gap.toFixed(1)} pts ${p >= t ? "above" : "below"}`;
    factsEl.hidden = false;

    addHistory({ payload, p, high });
  }

  function showError(err) {
    resetResultView();
    setPanelState("error");
    clearNumber();
    messageEl.textContent = err.message || "Something went wrong. Try again.";
    return tween(0, 600);
  }

  /* ---------- Recent checks ---------- */

  const history = [];

  function addHistory(entry) {
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.pop();

    historyList.textContent = "";
    history.forEach(({ payload, p, high }) => {
      const li = document.createElement("li");
      li.className = high ? "is-high" : "is-low";

      const dot = document.createElement("span");
      dot.className = "h-dot";

      const desc = document.createElement("span");
      desc.className = "h-desc";
      desc.textContent = `Grade ${payload.loan_grade}, ${payload.loan_amnt.toLocaleString()} loan`;

      const val = document.createElement("span");
      val.className = "h-val";
      val.textContent = `${pct1(p)}%`;

      li.append(dot, desc, val);
      historyList.append(li);
    });

    historyWrap.hidden = false;
  }

  /* ==========================================================
     Events
     ========================================================== */

  form.addEventListener("input", (e) => {
    if (e.target.name === "person_income" || e.target.name === "loan_amnt") updateShare();
  });

  form.addEventListener("change", (e) => {
    if (e.target.name === "loan_grade") clearGradeError();
  });

  form.addEventListener("reset", () => {
    // Wait for the browser to clear the fields first.
    setTimeout(() => {
      updateShare();
      clearGradeError();
      stopScan();
      resetResultView();
      setPanelState("idle");
      clearNumber();
      messageEl.textContent = "Fill in the application and run the check. The result appears here.";
      tween(0, 500);
    }, 0);
  });

  document.querySelectorAll("[data-sample]").forEach((btn) => {
    btn.addEventListener("click", () => fillSample(btn.dataset.sample));
  });

  let busy = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    if (!form.reportValidity()) return;
    if (!form.elements.loan_grade.value) {
      showGradeError();
      return;
    }

    const payload = collectPayload();

    busy = true;
    setBusy(true);
    resetResultView();
    setPanelState("loading");
    messageEl.textContent = "Scoring the application…";
    startScan();

    if (isNarrow()) {
      panel.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
    }

    const started = performance.now();

    try {
      const result = await predict(payload);
      const remaining = MIN_SCAN_MS - (performance.now() - started);
      if (remaining > 0) await sleep(remaining);

      stopScan();
      await showResult(result, payload);
    } catch (err) {
      stopScan();
      await showError(err);
    } finally {
      busy = false;
      setBusy(false);
    }
  });

  /* ==========================================================
     API status chip (also wakes a sleeping Render instance)
     ========================================================== */

  function setStatus(state, text) {
    statusEl.dataset.state = state;
    statusText.textContent = text;
  }

  async function checkHealth(attempt = 0) {
    setStatus(
      "checking",
      attempt === 0 ? "Connecting to model…" : "Waking the server, this can take a minute…"
    );

    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      if (!res.ok) throw new Error("health check failed");
      const data = await res.json();

      if (data.model_loaded && data.threshold_loaded) {
        setStatus("online", "Model online");
      } else {
        setStatus("offline", "Model not loaded");
      }
    } catch (_) {
      if (attempt < HEALTH_RETRIES) {
        setTimeout(() => checkHealth(attempt + 1), HEALTH_RETRY_MS);
      } else {
        setStatus("offline", "API unreachable");
      }
    }
  }

  /* ---------- Start ---------- */

  updateShare();
  renderGauge(0);
  introSweep();
  checkHealth();
})();
