# Design Coffee Vending Machine (LLD)

A coffee vending machine is a variation of the classic vending machine problem. It tests your ability to model state transitions (State pattern), handle beverage customization (Decorator or Builder pattern), and manage inventory.

---

## 1. Requirements

### Functional Requirements
- **Multiple Beverages:** Espresso, Latte, Cappuccino, Hot Chocolate, etc.
- **Customization:** Add-ons like extra sugar, milk, whipped cream (each with a cost).
- **Payment:** Accept coins, bills, or card. Return change for cash payments.
- **Inventory Management:** Track ingredient levels (coffee beans, milk, sugar, cups). Display "Out of stock" when ingredients are insufficient.
- **Dispensing:** Dispense the selected beverage after successful payment.

### Non-Functional Requirements
- **Thread-Safety:** Only one user interacts with the machine at a time.
- **Extensibility:** Easy to add new beverage types or add-ons.

---

## 2. Core Entities

- `CoffeeVendingMachine` (Singleton) — the main controller
- `Beverage` (Abstract) → `Espresso`, `Latte`, `Cappuccino`
- `BeverageDecorator` (Abstract) → `ExtraSugar`, `ExtraMilk`, `WhippedCream`
- `Inventory` — tracks ingredient quantities
- `Payment` — handles coin/card payment and change
- `VendingMachineState` (Interface) → `IdleState`, `SelectingState`, `PaymentState`, `DispensingState`

---

## 3. Key Design Decisions

### State Pattern for Machine Flow

```
IdleState → (press start) → SelectingState → (select beverage) →
PaymentState → (pay) → DispensingState → (dispense done) → IdleState
```

### Decorator Pattern for Customization

```java
Beverage order = new Espresso();                 // $2.00
order = new ExtraMilk(order);                    // $2.00 + $0.50
order = new WhippedCream(order);                 // $2.50 + $0.75
System.out.println(order.getDescription());      // "Espresso + Extra Milk + Whipped Cream"
System.out.println(order.getCost());             // $3.25
```

### Inventory Check Before Dispensing

```java
public boolean hasIngredients(Beverage beverage) {
    Recipe recipe = beverage.getRecipe();
    return coffeeBeans >= recipe.getCoffeeBeans()
        && milk >= recipe.getMilk()
        && sugar >= recipe.getSugar()
        && cups >= 1;
}
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| State      | Machine states (Idle, Selecting, Payment, Dispensing) |
| Decorator  | Beverage customization (add-ons modify cost & description) |
| Singleton  | Only one CoffeeVendingMachine instance         |
| Strategy   | Payment method (CashPayment, CardPayment)      |
