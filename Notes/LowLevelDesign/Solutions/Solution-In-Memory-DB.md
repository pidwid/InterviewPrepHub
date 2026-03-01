# Design an In-Memory Database with Indexing (LLD)

An in-memory database stores all data in RAM for ultra-fast reads and writes. Adding indexing on columns enables efficient lookups beyond primary key. This problem tests your knowledge of hash-based and tree-based indexing, table schemas, query processing, and thread-safety.

---

## 1. Requirements

### Functional Requirements
- **Create Table:** Define a schema with column names and types.
- **Insert Row:** Insert a row that conforms to the table schema.
- **Select Rows:** Query by column value (exact match, range queries).
- **Delete Rows:** Delete by primary key or by filter condition.
- **Create Index:** Create an index on any column for faster lookups.
- **Update Rows:** Update specific columns in matching rows.

### Non-Functional Requirements
- **Low Latency:** O(1) lookups on indexed columns via hash index. O(log n) for range queries via tree index.
- **Thread-Safety:** Concurrent reads and writes must be safe.

---

## 2. Core Entities

- `Database` — singleton, manages all tables
- `Table` — name, schema, rows, indexes
- `Row` — map of column name → value
- `Schema` — list of columns with names and types
- `Column` — name, data type, nullable, primary key flag
- `Index` (Interface) → `HashIndex` (HashMap-based), `TreeIndex` (TreeMap-based)
- `QueryResult` — list of matching rows

---

## 3. Key Design Decisions

### Hash Index for Exact Lookups

```java
public class HashIndex implements Index {
    private Map<Object, Set<Row>> index = new ConcurrentHashMap<>();

    public void addEntry(Object key, Row row) {
        index.computeIfAbsent(key, k -> ConcurrentHashMap.newKeySet()).add(row);
    }

    public Set<Row> lookup(Object key) {
        return index.getOrDefault(key, Collections.emptySet()); // O(1)
    }
}
```

### Tree Index for Range Queries

```java
public class TreeIndex implements Index {
    private TreeMap<Comparable, Set<Row>> index = new TreeMap<>();

    public Set<Row> rangeLookup(Comparable from, Comparable to) {
        return index.subMap(from, true, to, true).values()
            .stream().flatMap(Set::stream).collect(Collectors.toSet()); // O(log n + k)
    }
}
```

### Table with Schema Validation

```java
public void insert(Map<String, Object> rowData) {
    schema.validate(rowData); // check types, nullability, primary key uniqueness
    Row row = new Row(rowData);
    rows.add(row);
    for (Index idx : indexes.values()) {
        idx.addEntry(rowData.get(idx.getColumnName()), row);
    }
}
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| Strategy   | Index types (HashIndex vs TreeIndex)           |
| Singleton  | Database as single entry point                 |
| Factory    | Create appropriate index type based on config  |
| Iterator   | Iterate over query results                     |
