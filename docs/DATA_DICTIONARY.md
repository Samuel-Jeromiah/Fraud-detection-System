# Data dictionary and feature policy

## Source files

| File | Rows | Fraud labels | Period | Role |
| --- | ---: | ---: | --- | --- |
| `fraudTrain.csv` | 1,296,675 | 7,506 (0.579%) | 2019-01-01 to 2020-06-21 | Development data |
| `fraudTest.csv` | 555,719 | 2,145 (0.386%) | 2020-06-21 to 2020-12-31 | Untouched final test |

The files are synthetic transaction data distributed with the Sparkov/Kaggle dataset. They are ignored by Git because of their size.

## Raw fields used only to create allowed features

| Raw field | Use | Why |
| --- | --- | --- |
| `trans_date_trans_time`, `unix_time` | Transaction time features and chronological ordering | Available when a transaction occurs. |
| `amt` | Amount and amount-to-history ratio | Available when a transaction occurs. |
| `category` | Categorical transaction type | Available when a transaction occurs. |
| `city_pop` | Log-transformed city population | Static contextual attribute in this dataset. |
| `lat`, `long`, `merch_lat`, `merch_long` | Great-circle distance from home | Converts four location fields into one interpretable value. |
| `cc_num`, `merchant` | Keys for prior-only history aggregates | Never supplied to the estimator as raw identifiers. |
| `is_fraud` | Label only | Never used to create input features. |

## Excluded fields

`first`, `last`, `street`, `city`, `state`, `zip`, `job`, `dob`, `gender`, and `trans_num` are excluded. They are direct identifiers, sensitive characteristics, or high-cardinality fields that could let a course model memorize synthetic data instead of learn general fraud signals.

## Rebuilt model features

| Feature | Meaning | Point-in-time safe? |
| --- | --- | --- |
| `amount_log` | `log(1 + transaction amount)` | Yes |
| `city_pop_log` | `log(1 + city population)` | Yes |
| `distance_from_home_km` | Haversine distance between home and merchant coordinates | Yes |
| `transaction_hour`, `day_of_week`, `is_weekend`, `month` | Calendar/time indicators | Yes |
| `customer_prior_count` | Number of transactions for this customer strictly earlier in the ordered history | Yes |
| `customer_prior_avg_amount` | Average amount of prior transactions for this customer | Yes |
| `amount_to_customer_avg` | Current amount divided by prior customer average | Yes |
| `customer_merchant_prior_count` | Prior visits by the customer to the same merchant | Yes |
| `is_new_to_merchant` | Whether that prior-visit count is zero | Yes |
| `category` | One-hot encoded category | Yes |

`customer_prior_avg_amount` uses the training-window global median only when a customer has no history. This fallback is learned from the training window and is recorded in the bundle.

## What the model predicts

The output is the estimated probability that the synthetic transaction label is fraud. After calibration, a score of 0.30 should mean that transactions given that score were fraudulent roughly 30% of the time in a comparable future period. The configured threshold converts that probability into an alert; it does not prove fraud.
