# Design a Configuration Management System (LLD)

A configuration management system allows applications to store, retrieve, and dynamically update configuration key-value pairs without redeployment. This problem tests the Observer pattern (notify on config changes), Singleton pattern, and hierarchical/layered configuration merging.

---

## 1. Requirements

### Functional Requirements
- **CRUD Operations:** Add, read, update, delete configuration entries.
- **Namespaces:** Group configs by namespace/application (e.g., `payment-service.timeout`).
- **Layered Configs:** Support config layers: default → environment → application → override. Higher layers override lower ones.
- **Dynamic Updates:** Push config changes in real-time without app restart.
- **Listeners:** Applications register listeners for specific keys; get notified on change.
- **Type Support:** Store strings, integers, booleans, JSON objects.

### Non-Functional Requirements
- **Thread-Safety:** Concurrent reads and writes.
- **Consistency:** All subscribers see the same config value after an update.

---

## 2. Core Entities

- `ConfigManager` (Singleton) — manages all namespaces and listeners
- `ConfigNamespace` — logical grouping of configs (e.g., per service)
- `ConfigEntry` — key, value, type, last modified timestamp
- `ConfigLayer` (Enum) — DEFAULT, ENVIRONMENT, APPLICATION, OVERRIDE
- `ConfigChangeListener` (Interface) — notified on value change (Observer)
- `ConfigSnapshot` — immutable snapshot of resolved config at a point in time

---

## 3. Key Design Decisions

### Layered Resolution

```java
public String resolve(String namespace, String key) {
    // Check layers from highest priority to lowest
    for (ConfigLayer layer : ConfigLayer.values()) { // OVERRIDE → APP → ENV → DEFAULT
        String value = getFromLayer(namespace, key, layer);
        if (value != null) return value;
    }
    throw new ConfigKeyNotFoundException(namespace + "." + key);
}
```

### Observer Pattern for Dynamic Updates

```java
public void updateConfig(String namespace, String key, String newValue) {
    ConfigEntry entry = getEntry(namespace, key);
    String oldValue = entry.getValue();
    entry.setValue(newValue);
    entry.setLastModified(Instant.now());

    // Notify all listeners
    listeners.getOrDefault(namespace + "." + key, List.of())
        .forEach(l -> l.onConfigChanged(key, oldValue, newValue));
}
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| Observer   | Config change listeners                        |
| Singleton  | ConfigManager as global entry point            |
| Strategy   | Config source backends (file, DB, remote API)  |
| Composite  | Layered config resolution chain                |
