# Design a Payment Gateway (LLD)

A payment gateway is a service that processes financial transactions between merchants and customers. It routes payment requests to banks/processors, handles multiple payment methods, and ensures transactional integrity. This problem tests the Strategy pattern, State pattern, and idempotency handling.

---

## 1. Requirements

### Functional Requirements
- **Multiple Payment Methods:** Credit card, debit card, UPI, net banking, wallet.
- **Process Payment:** Validate, authorize, and capture payments.
- **Refunds:** Full or partial refunds on completed payments.
- **Transaction Status:** Track status: INITIATED → PROCESSING → SUCCESS/FAILED.
- **Idempotency:** Same request submitted twice should not charge twice.
- **Webhook Notifications:** Notify merchant on payment status changes.

### Non-Functional Requirements
- **Reliability:** Financial transactions must be atomic — no partial charges.
- **Security:** PCI-DSS compliance, card data encryption, tokenization.
- **Concurrency:** Handle thousands of concurrent transactions.

---

## 2. Core Entities

- `PaymentGateway` — entry point, routes to correct processor
- `PaymentRequest` — amount, currency, method, merchantId, idempotencyKey
- `Transaction` — tracks lifecycle: id, status, timestamps, retries
- `PaymentProcessor` (Interface) → `CreditCardProcessor`, `UPIProcessor`, `WalletProcessor`
- `PaymentStatus` (Enum) — INITIATED, PROCESSING, SUCCESS, FAILED, REFUNDED
- `Refund` — partial or full, linked to original transaction
- `WebhookNotifier` — notifies merchant of status changes (Observer)

---

## 3. Key Design Decisions

### Strategy Pattern for Payment Methods

```java
public interface PaymentProcessor {
    PaymentResult process(PaymentRequest request);
    RefundResult refund(Transaction transaction, Money amount);
}

public class CreditCardProcessor implements PaymentProcessor { /* ... */ }
public class UPIProcessor implements PaymentProcessor { /* ... */ }

// Gateway selects processor based on payment method
PaymentProcessor processor = processorFactory.getProcessor(request.getMethod());
PaymentResult result = processor.process(request);
```

### Idempotency via Idempotency Key

```java
public Transaction processPayment(PaymentRequest request) {
    // Check if we've already processed this idempotency key
    Transaction existing = transactionRepo.findByIdempotencyKey(request.getIdempotencyKey());
    if (existing != null) return existing; // return cached result

    Transaction txn = Transaction.create(request);
    txn.setStatus(PaymentStatus.PROCESSING);
    transactionRepo.save(txn);

    PaymentResult result = processor.process(request);
    txn.setStatus(result.isSuccess() ? PaymentStatus.SUCCESS : PaymentStatus.FAILED);
    transactionRepo.save(txn);

    webhookNotifier.notify(txn); // Observer pattern
    return txn;
}
```

### State Pattern for Transaction Lifecycle

```
INITIATED → PROCESSING → SUCCESS → REFUNDED (partial/full)
                       → FAILED → (can retry) → PROCESSING
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| Strategy   | Payment method processors (Card, UPI, Wallet)  |
| Factory    | PaymentProcessorFactory creates correct processor |
| State      | Transaction lifecycle management               |
| Observer   | Webhook notifications to merchants             |
| Command    | Payment and refund as command objects           |
