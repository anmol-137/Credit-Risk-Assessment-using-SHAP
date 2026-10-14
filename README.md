# Credit Risk Assessment using SHAP, Calibration, FastAPI & Deployment

An end-to-end Machine Learning project that predicts loan default risk, explains model behavior using SHAP, evaluates probability calibration, optimizes the classification threshold, and deploys the trained model through a FastAPI web application.

**Live Demo:** https://credit-risk-assessment-using-shap-el47.onrender.com/

**API Documentation:** https://credit-risk-assessment-using-shap-el47.onrender.com/docs

**Health Check:** https://credit-risk-assessment-using-shap-el47.onrender.com/health

---

## Table of Contents

- Project Overview
- Problem Statement
- Project Objectives
- Technology Stack
- Dataset and Features
- Machine Learning Workflow
- Data Preprocessing
- Model Training and Comparison
- Model Evaluation
- Probability Calibration
- Decision Threshold Optimization
- SHAP Explainability
- Error Analysis
- FastAPI Backend
- Web Application
- Model Serialization
- Deployment on Render
- Project Structure
- Installation and Local Setup
- API Usage
- Challenges and Learnings
- Limitations and Future Improvements
- Disclaimer

## 1. Project Overview

Credit risk assessment is an important task in financial services. Lenders need to estimate the likelihood of loan default to support risk evaluation and lending decisions.

This project develops a machine learning pipeline that estimates the probability of loan default from borrower and loan-related information.

The project goes beyond training a classifier by incorporating:

- **Machine Learning:** Logistic Regression and XGBoost for binary classification.
- **Model Evaluation:** Cross-validation, precision, recall, F1-score, ROC-AUC, and confusion matrix analysis.
- **Probability Calibration:** Evaluating whether predicted probabilities better represent observed event frequencies.
- **Decision Threshold Optimization:** Selecting a probability cutoff to classify applications as high or low risk.
- **SHAP Explainability:** Understanding which features influence model predictions.
- **FastAPI:** Exposing the trained model through a REST API.
- **Frontend Integration:** Connecting a web interface to the prediction API.
- **Deployment:** Hosting the application on Render.

The goal is to build an end-to-end ML application that combines predictive modeling, interpretability, API development, and deployment.

## 2. Problem Statement

Loan default can result in financial losses for lenders. A machine learning model can help estimate the probability that a borrower will default based on historical loan data.

This project formulates credit risk assessment as a **binary classification problem**.

The target variable is `loan_status`:

- `0` — Non-default class
- `1` — Default class

The model estimates a probability for the default class. A decision threshold then converts that probability into a binary prediction.

For example, a model might estimate a default probability of 0.72. If the selected threshold is approximately 0.634, the application would be classified as high risk.

The prediction is an estimate based on learned patterns in historical data, not a guarantee of future repayment behavior.

## 3. Project Objectives

1. Explore and preprocess a real-world credit risk dataset.
2. Train and compare machine learning classification models.
3. Handle missing values and class imbalance.
4. Optimize XGBoost hyperparameters using cross-validation.
5. Evaluate classification performance using multiple metrics.
6. Evaluate probability calibration.
7. Select a classification threshold based on model performance.
8. Interpret model behavior using SHAP.
9. Analyze false positives and false negatives.
10. Serialize the trained model for reuse.
11. Develop a REST API using FastAPI.
12. Build a frontend connected to the backend.
13. Deploy the application on Render.

## 4. Technology Stack

| Component | Technologies |
|---|---|
| Programming Language | Python |
| Data Manipulation | Pandas, NumPy |
| Data Visualization | Matplotlib, Seaborn |
| Machine Learning | Scikit-learn |
| Gradient Boosting | XGBoost |
| Explainable AI | SHAP |
| Probability Calibration | Scikit-learn calibration tools |
| Model Serialization | Joblib |
| Backend API | FastAPI |
| API Server | Uvicorn |
| Frontend | HTML, CSS, JavaScript |
| Deployment | Render |
| Version Control | Git and GitHub |

## 5. Dataset and Features

The notebook loads `credit_risk_dataset.csv`.

The original dataset contains **32,581 rows and 12 columns**.

### Target distribution

| Target | Number of records | Meaning |
|---|---:|---|
| 0 | 25,473 | Non-default |
| 1 | 7,108 | Default |
| Total | 32,581 | All records |

Approximately 21.8% of the original records belong to the default class, making class imbalance an important consideration.

### Features

| Feature | Description |
|---|---|
| `person_age` | Applicant age |
| `person_income` | Applicant income |
| `person_home_ownership` | Home ownership category |
| `person_emp_length` | Employment length |
| `loan_intent` | Purpose of the loan |
| `loan_grade` | Loan grade |
| `loan_amnt` | Requested loan amount |
| `loan_int_rate` | Loan interest rate |
| `loan_percent_income` | Loan amount divided by income |
| `cb_person_default_on_file` | Historical default indicator |
| `cb_person_cred_hist_length` | Credit history length |
| `loan_status` | Target variable |

The notebook's configured preprocessing lists exclude `loan_grade`. Although the field is present in the dataset and API input, it is not used by those configured model pipelines.

## 6. Machine Learning Workflow

The project follows an end-to-end machine learning workflow:

1. Load the dataset and inspect its structure.
2. Analyze missing values and target distribution.
3. Explore feature distributions and correlations.
4. Remove duplicate and implausible records.
5. Separate the features and target variable.
6. Split the dataset into training and test sets.
7. Build preprocessing pipelines.
8. Train Logistic Regression and XGBoost.
9. Compare models using cross-validation.
10. Tune XGBoost hyperparameters.
11. Evaluate the selected estimator.
12. Calibrate predicted probabilities.
13. Select a classification threshold.
14. Generate SHAP explanations.
15. Analyze prediction errors.
16. Save the model and threshold.
17. Serve predictions using FastAPI.
18. Deploy the application on Render.

## 7. Data Preprocessing

### Data cleaning

The notebook removes duplicate records and filters implausible values, including:

- Applicant age below 18 or above 100.
- Employment length above 60 years.
- Loan amounts less than or equal to zero.

After duplicate removal, the dataset contains 32,416 records. Following the subsequent filtering steps, the notebook reports 31,522 rows.

### Missing values

The original dataset contains missing values in:

| Feature | Missing values |
|---|---:|
| `person_emp_length` | 895 |
| `loan_int_rate` | 3,116 |

The model pipelines use imputation rather than requiring every row with missing data to be removed.

### Numeric preprocessing

For numeric features, the pipelines use median imputation.

The Logistic Regression pipeline additionally uses `StandardScaler`, while the XGBoost pipeline does not standardize numeric features.

### Categorical preprocessing

Categorical features are processed using:

- Missing-value imputation with the value `Missing`.
- One-hot encoding.
- `handle_unknown="ignore"` to handle previously unseen categories.

### Class imbalance

The notebook uses `class_weight="balanced"` for Logistic Regression in the cross-validation comparison.

For XGBoost, it calculates the ratio of negative to positive examples in the training data and passes this value to `scale_pos_weight`.

These approaches help account for the minority default class, although their effectiveness must still be evaluated using suitable metrics.

## 8. Model Training and Comparison

### Logistic Regression

Logistic Regression provides a baseline for the binary classification task.

Its pipeline includes numeric imputation, standardization, categorical imputation, one-hot encoding, and class weighting.

### XGBoost

XGBoost is a gradient-boosting algorithm that builds an ensemble of decision trees. It can learn nonlinear relationships and interactions between borrower and loan characteristics.

The notebook compares XGBoost with Logistic Regression and subsequently performs hyperparameter tuning.

### Cross-validation

The notebook uses five-fold stratified cross-validation with shuffling and `random_state=42`.

The models are compared using:

- ROC-AUC
- Accuracy
- Precision
- Recall
- F1-score

Stratification helps preserve the approximate class distribution across folds.

### Hyperparameter tuning

The notebook uses `RandomizedSearchCV` with:

- 150 candidate parameter combinations.
- Five-fold cross-validation.
- Average precision as the search scoring metric.
- A total of 750 model fits.

The search explores:

- `n_estimators`
- `max_depth`
- `learning_rate`
- `subsample`
- `colsample_bytree`
- `min_child_weight`
- `gamma`

The best cross-validation average-precision score recorded in the notebook is **0.88477**.

### Selected hyperparameters

| Parameter | Selected value |
|---|---:|
| `n_estimators` | 400 |
| `max_depth` | 6 |
| `learning_rate` | 0.0687548 |
| `subsample` | 0.8976066 |
| `colsample_bytree` | 0.8876222 |
| `min_child_weight` | 2 |
| `gamma` | 2.0413642 |

## 9. Model Evaluation

### Cross-validation comparison

The notebook records the following five-fold cross-validation results:

| Metric | Logistic Regression | XGBoost |
|---|---:|---:|
| ROC-AUC | 0.8499 | 0.9377 |
| Accuracy | 0.7704 | 0.9022 |
| Precision | 0.4804 | 0.7678 |
| Recall | 0.7682 | 0.7846 |
| F1-score | 0.5911 | 0.7760 |

XGBoost performs better on the reported metrics, including ROC-AUC and F1-score, in this comparison.

### Tuned XGBoost test-set results

The notebook reports the following classification report for the tuned estimator:

| Metric | Class 0 | Class 1 |
|---|---:|---:|
| Precision | 0.94 | 0.79 |
| Recall | 0.94 | 0.79 |
| F1-score | 0.94 | 0.79 |
| Support | 4,943 | 1,362 |

Additional reported metrics:

- Accuracy: **0.91**
- Macro-average F1-score: **0.86**
- Weighted-average F1-score: **0.91**

These are the rounded results recorded for the tuned estimator at its default prediction behavior. They should not be interpreted as a separate evaluation of the final calibrated model at the saved decision threshold.

### Why use multiple metrics?

- **Accuracy:** Fraction of all predictions that are correct.
- **Precision:** Fraction of predicted defaults that are actual defaults.
- **Recall:** Fraction of actual defaults detected by the model.
- **F1-score:** Harmonic mean of precision and recall.
- **ROC-AUC:** Measures the model's ability to rank positive examples above negative examples across thresholds.
- **Average precision:** Summarizes precision-recall performance and is useful when the positive class is less common.

For credit risk, recall can be important because a false negative means that a defaulting borrower is classified as non-default. Precision also matters because false positives can lead to unnecessary scrutiny of borrowers.

## 10. Probability Calibration

### What is probability calibration?

A classifier can rank examples effectively but still produce probabilities that do not accurately reflect the observed frequency of an event.

For example, among a sufficiently large group of comparable cases assigned a 20% default probability, a well-calibrated model should observe defaults in approximately 20% of those cases.

Calibration is important when model probabilities are used for risk assessment rather than only ranking applications.

### Calibration used in this project

The notebook applies sigmoid calibration using Scikit-learn's `CalibratedClassifierCV` with five-fold calibration:

`CalibratedClassifierCV(best_model, method="sigmoid", cv=5)`

The calibrated model is fitted on the training data. The notebook compares uncalibrated and calibrated probabilities using a ten-bin calibration curve.

### Why calibration matters

Calibration can help make predicted probabilities more meaningful for downstream decisions. It does not necessarily improve ranking metrics or classification accuracy, and it should be evaluated independently.

A more complete evaluation would report a Brier score alongside calibration curves and compare the calibrated model with the uncalibrated model on untouched evaluation data.

The notebook does not record a numeric Brier score or a numeric calibration improvement, so no such result is claimed here.

## 11. Decision Threshold Optimization

### What is a decision threshold?

A binary classifier may output a probability instead of directly returning a class label.

A threshold determines how that probability is converted into a classification.

For example, if the model predicts a default probability of 0.70:

- With a threshold of 0.50, the prediction is class 1.
- With a threshold of 0.75, the prediction is class 0.

The same probability can therefore result in different class predictions depending on the chosen threshold.

### Threshold selection in this project

The notebook calculates F1 scores using the precision-recall curve of the calibrated model's test-set probabilities and saves the selected threshold:

**Selected threshold: `0.6338306487247757`**

The deployed application uses this saved threshold:

- If `default_probability >= threshold`, the result is **High Risk**.
- If `default_probability < threshold`, the result is **Low Risk**.

### Why not always use 0.50?

The default threshold of 0.50 is not automatically optimal for every dataset or business objective.

In credit risk:

- A lower threshold may detect more potential defaults but may also flag more non-default borrowers.
- A higher threshold may reduce false positives but can miss more actual defaults.

The preferred threshold depends on the cost of false positives and false negatives, the lender's objectives, and applicable policies.

### Important evaluation note

The notebook selects the threshold using test-set probabilities and labels. This introduces potential test-set leakage into threshold selection.

A stronger evaluation procedure would select the threshold using a separate validation set or cross-validation, freeze the threshold, and then evaluate the complete model and threshold on an untouched test set.

The saved threshold should be treated as the result of the notebook's current procedure, not as a universally optimal credit risk cutoff.

## 12. SHAP Explainability

### What is SHAP?

SHAP stands for **SHapley Additive exPlanations**. It is a method for explaining machine learning model predictions using Shapley-value concepts from cooperative game theory.

A complex model may estimate default probability without making its decision process easy to inspect. SHAP helps describe how individual features contribute to the model output relative to a baseline.

### Why SHAP is useful for credit risk

SHAP can help answer questions such as:

- Which features influence the model most across the dataset?
- Which features pushed a particular prediction higher or lower?
- How does the model use income, loan amount, interest rate, or credit history?
- Are the model's learned patterns worth investigating for possible bias or data quality issues?

SHAP explanations describe learned model behavior. They do not prove that a feature causes default.

### SHAP implementation in this project

The notebook uses `shap.TreeExplainer` with the XGBoost classifier.

The workflow is:

1. Extract the XGBoost classifier from the trained pipeline.
2. Transform test data using the fitted preprocessing component.
3. Retrieve the transformed feature names.
4. Calculate SHAP values for the transformed test set.
5. Generate a SHAP summary plot.
6. Generate a waterfall plot for an individual test example.

### Global feature interpretation

A SHAP summary plot provides an overall view of feature contributions across multiple examples. It helps identify which transformed features have the greatest influence on the model output.

The plot can also show how feature values are associated with positive or negative contributions.

### Local prediction interpretation

A SHAP waterfall plot explains the contribution of features for one individual example.

It shows how feature contributions move the model output away from a baseline toward that example's prediction.

This can help with debugging, model review, and understanding individual model behavior.

### SHAP limitation in the current implementation

The notebook's SHAP analysis explains the uncalibrated XGBoost classifier, while the exported model is calibrated.

Consequently, the SHAP plots explain the XGBoost model output and are not direct explanations of the final calibrated probability returned by the deployed model.

## 13. Error Analysis

The notebook records the following error counts:

- **False positives:** 291
- **False negatives:** 287

A false positive occurs when a non-default example is classified as default.

A false negative occurs when an actual default example is classified as non-default.

Both errors matter, but their relative importance depends on the application. False negatives can lead to underestimating risk, while false positives can lead to rejecting or scrutinizing borrowers who would not default.

These counts are from the notebook's tuned model predictions at its default prediction behavior. They are not claimed as error counts for the calibrated model at the saved threshold.

## 14. FastAPI Backend

### Why FastAPI?

FastAPI is a Python framework for building HTTP APIs. It makes a trained machine learning model accessible to applications without requiring the notebook to be running.

Instead of retraining a model every time a user submits an application, the API loads the saved model when the service starts and reuses it to generate predictions.

### Role of FastAPI in this project

The backend:

1. Loads the serialized model and threshold.
2. Serves the frontend HTML page.
3. Serves static CSS and JavaScript files.
4. Validates incoming loan application data.
5. Converts validated input into the structure expected by the model.
6. Calls the model's `predict_proba()` method.
7. Applies the saved decision threshold.
8. Returns a JSON response to the frontend.

### API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Serves the web application |
| GET | `/health` | Reports model and threshold loading status |
| POST | `/predict` | Predicts default probability and risk classification |
| GET | `/docs` | Opens interactive API documentation |

### Health endpoint

The `/health` endpoint helps verify that the model and threshold have loaded.

Example response:

```json
{
  "status": "healthy",
  "model_loaded": true,
  "threshold_loaded": true
}
```

The actual response depends on the service's current state.

### Prediction endpoint

The `/predict` endpoint accepts a JSON payload containing the borrower's details and returns a prediction.

Example response structure:

```json
{
  "default_probability": 0.18,
  "default_prediction": 0,
  "threshold": 0.6338306487247757,
  "result": "Low Risk"
}
```

The probability in this example is illustrative, not a verified output for a particular application. Actual results depend on the deployed model and input values.

## 15. Web Application

The frontend uses HTML, CSS, and JavaScript.

Its purpose is to provide a user-friendly way to submit a loan application and view the model's output without manually sending API requests.

The frontend:

- Collects borrower and loan details.
- Sends a JSON request to the `/predict` endpoint.
- Receives the predicted probability, threshold, and classification.
- Displays the risk result.
- Provides an API status check through `/health`.
- Displays assessment information in the interface.

The frontend and API are hosted on the same Render service. The JavaScript can therefore use same-origin requests such as `/predict` and `/health`.

## 16. Model Serialization

After model development, the notebook saves artifacts using Joblib.

The main artifacts are:

- `credit_risk_model.pkl` — the calibrated model used by the API.
- `best_threshold.pkl` — the selected classification threshold.

Serialization allows the trained model to be loaded by the deployed service without rerunning model training and hyperparameter search.

The backend loads the artifacts during application startup and reuses them for prediction requests.

**Security note:** Pickle-based model files should only be loaded from trusted sources. Loading an untrusted serialized model can execute malicious code. The training and deployment environments should also use compatible versions of scikit-learn and XGBoost.

## 17. Deployment on Render

Render hosts the FastAPI service and makes the application accessible through a public URL.

### Deployment workflow

1. Push the project files to GitHub.
2. Connect the repository to a Render Web Service.
3. Install the required Python dependencies.
4. Configure the start command.
5. Ensure the model artifacts are available at the paths expected by `main.py`.
6. Deploy the service.
7. Verify the frontend, health endpoint, and prediction endpoint.

### Build command

```bash
pip install -r requirements.txt
```

### Start command

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

The service must be able to access both the model artifact and threshold file during startup.

### Live links

- **Web application:** https://credit-risk-assessment-using-shap-el47.onrender.com/
- **Health check:** https://credit-risk-assessment-using-shap-el47.onrender.com/health
- **Swagger API documentation:** https://credit-risk-assessment-using-shap-el47.onrender.com/docs

For reproducible deployments, keep dependency versions compatible with the versions used to train and serialize the model.

## 18. Project Structure

The core application can be organized as follows:

```text
Credit-Risk-Assessment-using-SHAP/
│
├── credit_risk.ipynb
├── credit_risk_dataset.csv
├── main.py
├── requirements.txt
├── README.md
├── credit_risk_model.pkl
├── best_threshold.pkl
│
└── static/
    ├── index.html
    ├── style.css
    └── script.js
```

The CSV is needed to rerun the notebook but is not necessarily needed to serve predictions when the trained artifacts are already available.

Adjust the structure to match the actual repository. Dataset redistribution must comply with the dataset's license, and large model files may require an artifact storage solution.

## 19. Installation and Local Setup

### Step 1: Clone the repository

```bash
git clone https://github.com/anmol-137/Credit-Risk-Assessment-using-SHAP.git
cd Credit-Risk-Assessment-using-SHAP
```

### Step 2: Create a virtual environment

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

On macOS or Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

### Step 3: Install dependencies

```bash
pip install -r requirements.txt
```

The complete environment should include the libraries required by the notebook and backend, including Pandas, NumPy, scikit-learn, XGBoost, SHAP, Joblib, FastAPI, and Uvicorn, plus any visualization or notebook tools used during development.

### Step 4: Verify the model files

Make sure `credit_risk_model.pkl` and `best_threshold.pkl` exist at the locations configured in `main.py`.

### Step 5: Start the API

```bash
uvicorn main:app --reload
```

Open the following URLs:

- Frontend: http://127.0.0.1:8000/
- Health check: http://127.0.0.1:8000/health
- API documentation: http://127.0.0.1:8000/docs

### Step 6: Run the notebook

Open `credit_risk.ipynb` in Jupyter Notebook or VS Code. Place `credit_risk_dataset.csv` in the expected working directory and execute the cells in order.

The hyperparameter search may take time because it evaluates 150 parameter combinations across five folds.

## 20. Challenges and Learnings

This project provides practical experience in:

- Building preprocessing pipelines for numeric and categorical data.
- Comparing baseline and gradient-boosting models.
- Evaluating models on imbalanced classification data.
- Tuning hyperparameters using cross-validation.
- Understanding the difference between classification scores and calibrated probabilities.
- Selecting a threshold based on a defined objective.
- Interpreting model behavior using global and local SHAP explanations.
- Analyzing false positives and false negatives.
- Saving and reusing trained model artifacts.
- Building a REST API with FastAPI.
- Connecting a frontend to a model-serving backend.
- Deploying a machine learning application to a cloud platform.

## 21. Limitations and Future Improvements

Potential improvements include:

- Selecting the threshold on validation data rather than test data.
- Reporting final calibrated-model metrics at the selected threshold.
- Computing Brier score and additional calibration metrics.
- Explaining the final deployed model's calibrated output where technically appropriate.
- Adding automated tests for API validation and prediction behavior.
- Adding input schema and feature-pipeline consistency tests.
- Pinning dependency versions and documenting reproducible training.
- Monitoring data drift and changes in model performance.
- Evaluating fairness and performance across relevant borrower subgroups.
- Improving logging, model versioning, and deployment monitoring.
- Adding model explanations to the frontend with clear limitations.

These are recommended improvements, not claims that the functionality is already implemented.

## 22. Disclaimer

This project is intended for educational, portfolio, and demonstration purposes. Its predictions are estimates and should not be treated as definitive lending decisions or financial advice.

A production credit decision system requires rigorous independent validation, fairness and bias assessment, privacy and security controls, ongoing monitoring, and appropriate legal and regulatory review.

## Author

**Anmol Pandey**  
B.Tech — Computer Science Engineering

GitHub: https://github.com/anmol-137

---

If you find this project useful, consider starring the repository.
