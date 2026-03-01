# Design Inventory Management System (LLD)

An inventory management system tracks products, their stock levels, warehouse locations, and movements (inbound/outbound). This problem tests modeling of entities with complex relationships, the Observer pattern for low-stock alerts, and the Strategy pattern for restocking policies.

---

## 1. Requirements

### Functional Requirements
- **Product Catalog:** Add, update, remove products with SKU, name, category, price.
- **Stock Tracking:** Track quantity per product per warehouse location.
- **Inbound/Outbound:** Record stock arrivals (purchase orders) and departures (sales orders).
- **Low Stock Alerts:** Notify when stock falls below a configurable threshold.
- **Search & Filter:** Find products by name, category, or SKU.
- **Audit Trail:** Log all inventory changes with timestamp, user, and reason.

### Non-Functional Requirements
- **Concurrency:** Multiple warehouse workers updating stock simultaneously.
- **Consistency:** Stock count must never go negative (prevent overselling).

---

## 2. Core Entities

- `InventorySystem` — singleton, manages products and warehouses
- `Product` — SKU, name, category, price, reorderThreshold
- `Warehouse` — location, list of `StockEntry` records
- `StockEntry` — links Product to Warehouse with quantity
- `StockMovement` — immutable record: product, qty, type (IN/OUT), timestamp, warehouse
- `PurchaseOrder` / `SalesOrder` — grouped movements
- `StockAlertObserver` (Interface) — notified on low stock (Observer pattern)

---

## 3. Key Design Decisions

### Thread-Safe Stock Update

```java
public synchronized void removeStock(Product product, int quantity) {
    StockEntry entry = getEntry(product);
    if (entry.getQuantity() < quantity)
        throw new InsufficientStockException(product, quantity, entry.getQuantity());

    entry.decrementBy(quantity);
    auditLog.record(new StockMovement(product, quantity, MovementType.OUT, Instant.now()));

    if (entry.getQuantity() <= product.getReorderThreshold()) {
        notifyObservers(product, entry.getQuantity()); // low stock alert
    }
}
```

### Strategy Pattern for Restock Policies

```java
public interface RestockStrategy {
    int calculateReorderQuantity(Product product, int currentStock);
}
// Implementations: FixedQuantityRestock, MinMaxRestock, JustInTimeRestock
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| Observer   | Low stock alerts to purchasing, dashboards     |
| Strategy   | Restock policies (fixed qty, min-max, JIT)     |
| Singleton  | InventorySystem as central manager             |
| Command    | Stock movements as undoable commands           |
