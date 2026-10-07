# Payments and pandit settlements

## Payment modes

- **Cash on delivery (COD):** The client pays the pandit directly for the completed puja. When the pandit marks the job complete, the ledger records a 10% platform commission as a negative balance, due within seven days.
- **Razorpay online:** Checkout charges the client and settles the full payment to the PujaSathi merchant account. After the pandit marks the job complete, the ledger records 90% of the booking total as the pandit's payable balance. Razorpay Route is not enabled in this flow, so an admin must transfer payouts outside PujaSathi and record the bank/UPI reference in the admin dashboard.

The commission is calculated on the full booking total, including samagri where selected. Razorpay processing charges and applicable taxes are separate merchant costs and are not deducted from the pandit's 90% ledger share.

## Razorpay configuration

Set the following in `backend/.env`:

```text
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

Use test keys for test transactions and live keys only after Razorpay activates the account for live payments. Keep the secret key on the backend; the public key ID is returned to the checkout page. Booking payment verification checks Razorpay's signature, order and captured payment amount.

## Settlements

- Pandits see their ledger balance and COD commission due in the pandit dashboard.
- Admin payout and COD-fee settlement actions only record a verified external bank/UPI transaction; they do not move money themselves.
- The COD commission due date is stored on the ledger entry. The negative ledger amount is recorded on job completion.
- Automatic transfers/withdrawals require Razorpay Route approval and linked-account onboarding; this project does not claim to automate those payouts.
