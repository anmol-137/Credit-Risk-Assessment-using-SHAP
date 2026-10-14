
from pathlib import Path
from contextlib import asynccontextmanager

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


# =========================================================
# 1. PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

MODEL_PATH = BASE_DIR / "credit_risk_model.pkl"
THRESHOLD_PATH = BASE_DIR / "best_threshold.pkl"


# =========================================================
# 2. MODEL STORAGE
# =========================================================

ml_model = {}


# =========================================================
# 3. LOAD MODEL WHEN THE APP STARTS
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        if not MODEL_PATH.is_file():
            raise FileNotFoundError(
                f"Model file not found: {MODEL_PATH}"
            )

        if not THRESHOLD_PATH.is_file():
            raise FileNotFoundError(
                f"Threshold file not found: {THRESHOLD_PATH}"
            )

        ml_model["model"] = joblib.load(MODEL_PATH)
        ml_model["threshold"] = float(
            joblib.load(THRESHOLD_PATH)
        )

        threshold = ml_model["threshold"]

        if not 0 <= threshold <= 1:
            raise ValueError(
                "The saved decision threshold must be between 0 and 1."
            )

        if not hasattr(ml_model["model"], "predict_proba"):
            raise ValueError(
                "The loaded model does not support predict_proba()."
            )

        print("Credit risk model loaded successfully.")
        print(f"Decision threshold: {threshold}")

        yield

    except Exception as exc:
        print(f"MODEL STARTUP ERROR: {exc}")
        raise

    finally:
        ml_model.clear()
        print("Credit risk model resources cleared.")


# =========================================================
# 4. CREATE FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="Credit Risk Assessment API",
    description=(
        "Predict loan default risk using a trained "
        "machine learning model."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# =========================================================
# 5. FRONTEND FILE CHECKS AND STATIC FILES
# =========================================================

if not STATIC_DIR.is_dir():
    raise RuntimeError(
        f"Frontend directory not found: {STATIC_DIR}"
    )

if not (STATIC_DIR / "index.html").is_file():
    raise RuntimeError(
        f"Frontend HTML not found: {STATIC_DIR / 'index.html'}"
    )

if not (STATIC_DIR / "style.css").is_file():
    raise RuntimeError(
        f"Frontend CSS not found: {STATIC_DIR / 'style.css'}"
    )

if not (STATIC_DIR / "script.js").is_file():
    raise RuntimeError(
        f"Frontend JavaScript not found: {STATIC_DIR / 'script.js'}"
    )

# Serve CSS and JavaScript from /static/...
app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)


# =========================================================
# 6. INPUT DATA VALIDATION
# =========================================================

class LoanApplication(BaseModel):
    person_age: int = Field(ge=18, le=100)

    person_income: float = Field(gt=0)

    person_home_ownership: str

    person_emp_length: float = Field(ge=0, le=100)

    loan_intent: str

    loan_grade: str

    loan_amnt: float = Field(gt=0)

    loan_int_rate: float = Field(ge=0, le=100)

    loan_percent_income: float = Field(ge=0)

    cb_person_default_on_file: str

    cb_person_cred_hist_length: int = Field(ge=0, le=100)


# =========================================================
# 7. FRONTEND HOME PAGE
# =========================================================

@app.get("/", include_in_schema=False)
def home():
    return FileResponse(STATIC_DIR / "index.html")


# =========================================================
# 8. HEALTH CHECK
# =========================================================

@app.get("/health")
def health_check():
    model_loaded = "model" in ml_model
    threshold_loaded = "threshold" in ml_model

    return {
        "status": (
            "healthy"
            if model_loaded and threshold_loaded
            else "not_ready"
        ),
        "model_loaded": model_loaded,
        "threshold_loaded": threshold_loaded,
    }


# =========================================================
# 9. MODEL PREDICTION
# =========================================================

@app.post("/predict")
def predict(data: LoanApplication):

    if "model" not in ml_model or "threshold" not in ml_model:
        raise HTTPException(
            status_code=503,
            detail="The machine learning model is not loaded.",
        )

    try:
        # Convert the validated input into a DataFrame.
        input_df = pd.DataFrame(
            [data.model_dump()]
        )

        # Calculate probability of class 1 (default).
        model = ml_model["model"]

        probabilities = model.predict_proba(input_df)

        # Locate class 1 explicitly rather than assuming its column.
        classes = list(model.classes_)

        if 1 not in classes:
            raise ValueError(
                "The model does not contain class 1 (default)."
            )

        default_class_index = classes.index(1)

        probability = float(
            probabilities[0, default_class_index]
        )

        threshold = ml_model["threshold"]

        # Apply the saved decision threshold.
        prediction = int(probability >= threshold)

        result = (
            "High Risk"
            if prediction == 1
            else "Low Risk"
        )

        return {
            "default_probability": probability,
            "default_prediction": prediction,
            "threshold": threshold,
            "result": result,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(f"PREDICTION ERROR: {exc}")

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(exc)}",
        ) from exc
