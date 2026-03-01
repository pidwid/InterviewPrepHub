# Design a Logistics / Delivery System (LLD)

A logistics system manages the end-to-end flow of parcels from pickup to delivery. It tests your ability to model packages with different sizes, route planning via Strategy pattern, delivery status tracking via State pattern, and fleet management.

---

## 1. Requirements

### Functional Requirements
- **Order Creation:** Create delivery orders with pickup/drop locations, package size/weight.
- **Package Tracking:** Real-time status: CREATED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED.
- **Fleet Management:** Assign delivery agents/vehicles based on capacity and proximity.
- **Route Optimization:** Calculate optimal delivery route for a batch of packages.
- **Pricing:** Calculate delivery cost based on distance, weight, and speed (express vs standard).
- **Notifications:** Notify sender/receiver on status changes.

### Non-Functional Requirements
- **Scalability:** Handle thousands of concurrent deliveries.
- **Concurrency:** Multiple agents picking up packages simultaneously.

---

## 2. Core Entities

- `LogisticsSystem` — singleton, manages orders and fleet
- `DeliveryOrder` — sender, receiver, package, status, route, agent
- `Package` — weight, dimensions, type (FRAGILE, STANDARD, PERISHABLE)
- `DeliveryAgent` — name, vehicle, current location, availability
- `Vehicle` (Abstract) → `Bike`, `Van`, `Truck` (different capacities)
- `Route` — list of waypoints, estimated time
- `DeliveryStatus` (Enum) — lifecycle states
- `PricingStrategy` (Interface) → `StandardPricing`, `ExpressPricing`, `WeightBasedPricing`
- `StatusObserver` (Interface) — notifications on status change

---

## 3. Key Design Decisions

### State Pattern for Delivery Status

```java
public interface DeliveryState {
    void next(DeliveryOrder order);
    void prev(DeliveryOrder order);
    String getStatus();
}
// States: CreatedState → PickedUpState → InTransitState → OutForDeliveryState → DeliveredState
```

### Strategy Pattern for Pricing

```java
public interface PricingStrategy {
    double calculateCost(Package pkg, Route route);
}
public class ExpressPricing implements PricingStrategy {
    public double calculateCost(Package pkg, Route route) {
        return route.getDistanceKm() * 1.5 + pkg.getWeightKg() * 2.0; // premium
    }
}
```

### Agent Assignment

```java
public DeliveryAgent assignAgent(DeliveryOrder order) {
    return agents.stream()
        .filter(DeliveryAgent::isAvailable)
        .filter(a -> a.getVehicle().canCarry(order.getPackage()))
        .min(Comparator.comparingDouble(a -> a.distanceTo(order.getPickupLocation())))
        .orElseThrow(NoAvailableAgentException::new);
}
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| State      | Delivery order lifecycle                       |
| Strategy   | Pricing (standard, express, weight-based)      |
| Observer   | Status change notifications                    |
| Factory    | Create vehicles by type                        |
| Singleton  | LogisticsSystem as central manager             |
