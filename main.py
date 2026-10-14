
from pathlib import Path
from contextlib import asynccontextmanager

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


# Project directory
BASE_DIR = Path(__file__).resolve().parent

# Store the loaded model and threshold
ml_model = {}
 

# Load model when the application starts
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        ml_model["model"] = joblib.load(
            BASE_DIR / "credit_risk_model.pkl"
        )

        ml_model["threshold"] = joblib.load(
            BASE_DIR / "best_threshold.pkl"
        )

        print("Credit risk model loaded successfully!")
        print("Best threshold:", ml_model["threshold"])

        yield

    finally:
        ml_model.clear()


# Create FastAPI application
app = FastAPI(
    title="Credit Risk Prediction API",
    description="Predict loan default risk using a machine learning model.",
    version="1.0.0",
    lifespan=lifespan
)




# Input schema
class LoanApplication(BaseModel):
    person_age: int
    person_income: float
    person_home_ownership: str
    person_emp_length: float
    loan_intent: str
    loan_grade: str
    loan_amnt: float
    loan_int_rate: float
    loan_percent_income: float
    cb_person_default_on_file: str
    cb_person_cred_hist_length: int


# Home endpoint
@app.get("/")
def greet():
    return {
        "message": "Welcome to the Credit Risk Prediction API!"
    }


# Health check endpoint
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": "model" in ml_model,
        "threshold_loaded": "threshold" in ml_model
    }


# Prediction endpoint
@app.post("/predict")
def predict(data: LoanApplication):

    # Ensure model and threshold are loaded
    if "model" not in ml_model or "threshold" not in ml_model:
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded."
        )

    # Convert input data into a single-row DataFrame
    input_df = pd.DataFrame([data.model_dump()])

    # Print input data in the terminal
    print("\nReceived loan application:")
    print(input_df)

    try:
        # Predict probability of default (positive class)
        probability = float(
            ml_model["model"].predict_proba(input_df)[0, 1]
        )

        # Get the saved decision threshold
        threshold = float(ml_model["threshold"])

        # 1 = high risk, 0 = low risk
        prediction = int(probability >= threshold)

        # Return prediction as JSON
        return {
            "default_probability": probability,
            "default_prediction": prediction,
            "threshold": threshold,
            "result": "High Risk" if prediction == 1 else "Low Risk"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )
app.mount("/",StaticFiles(directory = "static",html = True),name = "static")


       


