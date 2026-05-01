# Library Management System (LMS) - Low-Level OOP Design
## Comprehensive Research Report for Senior Software Engineer Interview

---

## EXECUTIVE SUMMARY

This research compiles a complete low-level design specification for a Library Management System, covering functional/non-functional requirements, core entities with cardinality relationships, 7 key design patterns (State, Strategy, Observer, Chain of Responsibility, Command, Singleton, Visitor), concurrency control strategies, and core algorithms. The design balances extensibility, data consistency, and interview best practices.

**YouTube Resource**: Video ID `fVqv4B8sG1s` - "Design a Library Management System" (primary reference)

---

## 1. FUNCTIONAL REQUIREMENTS

### Core Operations
- **Book Catalog Management**: Multiple titles with multiple physical copies (BookItem/BookCopy distinction)
- **Member Management**: STUDENT (5-book limit) and TEACHER (10-book limit) roles with status tracking
- **Search**: Query by title, author, ISBN, category with O(1) inverted index lookups
- **Borrowing**: 10-day maximum checkout; automatic due date assignment
- **Return Processing**: Automatic fine calculation; support for partial payments
- **Reservation Queue**: FIFO queue per book; auto-notification when available
- **Librarian Admin**: Add/remove books and members; view member history and statistics
- **Notifications**: Due date reminders, overdue alerts, reservation fulfillment via Observer pattern

### Business Rules
- One copy = one active loan at a time (single owner constraint)
- Members cannot borrow if account is BLOCKED or they have unpaid fines
- Fines calculated using pluggable FineCalculationStrategy
- Reservations persist in queue even after member becomes inactive

---

## 2. NON-FUNCTIONAL REQUIREMENTS

### Data Integrity
- **Atomicity**: Borrow transitions (check availability + acquire + update) must be indivisible
- **Single-Owner Guarantee**: Row-level database locks or synchronized object access
- **Consistency**: All indices (booksByTitle, booksByISBN) updated atomically with entity changes

### Concurrency
- **Race Prevention**: Multiple concurrent borrow requests for same copy — only 1 succeeds
- **Queue Ordering**: Timestamp-based with lexicographic tiebreaker for reservation positions
- **Isolation**: Reservation notifications don't interfere with active loans

### Performance & Extensibility
- **Search O(1)**: Inverted indices via HashMap (title, author, ISBN)
- **Strategy Swappability**: Fine calculations, notification channels, member types
- **Auditability**: Command pattern enables full transaction logging

---

## 3. CORE ENTITIES & RELATIONSHIPS

### Entity Diagram
```
Book (1) ──M─ BookCopy
                    │
Member (1) ──M─ Loan ──1── (BookCopy holds 0..1 active)

Book {
  isbn: String (PK)
  title, author, category: String
  copies: List<BookCopy>
}

BookCopy {
  copyId: String (PK within Book)
  bookId: FK
  status: Enum [AVAILABLE | BORROWED | RESERVED | LOST | DAMAGED]
  currentLoan: Loan? (active loan reference)
  reservationQueue: Queue<Reservation>
}

Member {
  memberId: String (PK)
  memberType: Enum [STUDENT(limit=5) | TEACHER(limit=10)]
  currentBorrows: List<Loan> (count ≤ borrowLimit)
  totalFinesOwed: double
  accountStatus: Enum [ACTIVE | BLOCKED | SUSPENDED]
}

Loan {
  loanId: String (PK)
  memberId: FK
  copyId: FK
  borrowedAt, dueAt, returnedAt?: Timestamp
  fineAmount: double
}

Reservation {
  reservationId: String (PK)
  memberId, bookId: String (FK)
  requestedAt: Timestamp
  position: int (auto-calculated from queue)
}

Fine {
  fineId: String (PK)
  loanId: FK
  amountOwed, amountPaid: double
  dueDate, paidAt?: Timestamp
}

Librarian {
  librarianId: String (PK)
  permissions: List<Permission>
}

Notification {
  notificationId: String (PK)
  memberId: FK
  type: Enum [DUE_DATE | OVERDUE | RESERVATION_AVAILABLE | FINE_REMINDER]
  sentAt, readAt?: Timestamp
}
```

---

## 4. DESIGN PATTERNS (7 Key Patterns)

### Pattern 1: STATE (BookCopy & Loan Lifecycle)

**Use Case**: BookCopy states have distinct valid transitions; operations only valid in specific states.

**State Diagram**:
```
AVAILABLE → (borrow) → BORROWED → (return) → AVAILABLE
     ↓              ↓ (reserve)     ↓ (lost during borrow)
   RESERVED         RESERVED         LOST
```

**Why State?**: Encapsulates state-specific behavior; prevents invalid transitions (can't return non-borrowed copy).

**Interview Talking Point**: "State pattern prevents invalid state transitions by delegating behavior to state objects, unlike a simple enum + switch which can miss edge cases."

---

### Pattern 2: STRATEGY (Fine Calculation)

**Concrete Strategies**:
```java
interface FineCalculationStrategy {
  double calculateFine(Loan loan, int daysOverdue);
}

// Implementation 1: Per-Day with Cap
class PerDayCapFine implements FineCalculationStrategy {
  public double calculate(Loan loan, int days) {
    double fine = days <= 10 ? days * 1.0 : (10 * 1.0) + (days - 10) * 2.0;
    return Math.min(fine, 20.0); // Capped at $20
  }
}

// Implementation 2: Member-Type Discount
class MemberTypeDiscountFine implements FineCalculationStrategy {
  private FineCalculationStrategy delegate;
  public double calculate(Loan loan, int days) {
    double baseFine = delegate.calculate(loan, days);
    double discount = loan.getMember().getType() == STUDENT ? 0.5 : 0.75;
    return baseFine * discount;
  }
}
```

**Rationale**: Library policy changes (e.g., holiday fine waiver, tiered pricing) require new strategy without modifying Loan.returnBook().

---

### Pattern 3: OBSERVER (Reservation Queue Notifications)

**Flow**:
```
BookCopy.returnBook() calls notifyReservationQueue()
  → Check reservationQueue.isEmpty()
  → If not empty:
      - Dequeue Reservation at position 0
      - Create Notification("Your reserved book is ready")
      - Send via NotificationService (SMS/Email/Push)
      - Update positions of remaining reservations (position--)
```

**Why Observer?**: Decouples BookCopy return logic from notification delivery; supports multiple observers (SMS, email, in-app).

---

### Pattern 4: CHAIN OF RESPONSIBILITY (Borrow Validation)

**Validation Chain**:
```
BorrowRequest
  ↓
[MembershipValidator] → Is account ACTIVE?
  ↓ (yes)
[BorrowLimitValidator] → currentBorrows.size() < limit?
  ↓ (yes)
[OverdueValidator] → totalFinesOwed == 0?
  ↓ (yes)
[BookAvailabilityValidator] → BookCopy.status == AVAILABLE?
  ↓ (yes)
[Return: Borrow Approved]

[Return: Borrow Denied] ← Any step fails
```

**Benefit**: Add new validators (BlockListValidator, SuspensionValidator) without modifying BorrowService.

---

### Pattern 5: COMMAND (Auditability & Undo)

**Commands**:
```java
interface LibraryCommand {
  void execute();
  void undo();
}

class BorrowCommand implements LibraryCommand {
  private String memberId, copyId;
  private Loan createdLoan;
  
  public void execute() {
    // Create loan, update statuses
    createdLoan = loanService.createLoan(memberId, copyId);
    auditLog.record("BORROW", memberId, copyId, now());
  }
  
  public void undo() {
    // Revert loan, restore statuses
    loanService.cancelLoan(createdLoan.id);
  }
}
```

**Rationale**: Full audit trail; support rollback for transaction failures.

---

### Pattern 6: SINGLETON (LibraryCatalogService)

**Rationale**: Indices must be globally consistent; prevent duplicate HashMaps.

```java
public class LibraryCatalogService {
  private static LibraryCatalogService instance;
  private Map<String, List<Book>> booksByTitle;
  private Map<String, List<Book>> booksByAuthor;
  private Map<String, Book> booksByISBN;
  
  private LibraryCatalogService() { }
  
  public static synchronized LibraryCatalogService getInstance() {
    if (instance == null) instance = new LibraryCatalogService();
    return instance;
  }
  
  public List<Book> searchByTitle(String title) {
    return booksByTitle.getOrDefault(title.toLowerCase(), new ArrayList<>());
  }
}
```

---

### Pattern 7: VISITOR (Reporting & Analytics)

**Use Case**: Generate reports (top-borrowed books, member activity, overdue summary) without modifying core entities.

```java
interface ReportVisitor {
  void visit(Book book);
  void visit(Member member);
  void visit(Loan loan);
}

class TopBorrowedBooksVisitor implements ReportVisitor {
  private Map<String, Integer> borrowCounts = new HashMap<>();
  
  public void visit(Loan loan) {
    borrowCounts.merge(loan.getBookId(), 1, Integer::sum);
  }
  
  public List<String> getTopBooks(int limit) {
    return borrowCounts.entrySet().stream()
      .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
      .limit(limit)
      .map(Map.Entry::getKey)
      .collect(Collectors.toList());
  }
}
```

---

## 5. CONCURRENCY CONTROL

### Atomic Borrow (Prevent Double-Borrow)

**Challenge**: Two members submit borrow requests simultaneously for same copy.

**Database Solution** (Row-Level Lock):
```sql
BEGIN TRANSACTION;
SELECT * FROM book_copies 
WHERE copyId = ? AND status = 'AVAILABLE' 
FOR UPDATE;  -- Exclusive lock acquired

IF (row found) {
  UPDATE book_copies SET status = 'BORROWED', current_loan_id = ? 
  WHERE copyId = ?;
  
  INSERT INTO loans (loanId, memberId, copyId, borrowedAt, dueAt) 
  VALUES (?, ?, ?, NOW(), NOW() + INTERVAL 10 DAY);
  
  UPDATE members SET current_borrows = current_borrows + 1 
  WHERE memberId = ?;
  
  COMMIT;
  RETURN success;
}
ELSE {
  ROLLBACK;
  RETURN failure; -- Copy no longer available
}
```

**In-Memory Solution** (Single-Thread/Cached):
```java
public synchronized boolean borrowCopy(String memberId, BookCopy copy) {
  if (copy.getStatus() != Status.AVAILABLE) {
    return false;
  }
  copy.setStatus(Status.BORROWED);
  loan = createLoan(memberId, copy.getId());
  return true;
}
```

### Member Borrow Limit (Prevent Over-Borrowing)

```java
public synchronized void borrowBook(Member member, BookCopy copy) {
  synchronized(member) {  // Serialize access to member's borrow list
    if (member.getCurrentBorrows().size() >= member.getBorrowLimit()) {
      throw new BorrowLimitExceededException();
    }
    // Proceed with borrow (already locked from BookCopy side)
  }
}
```

### Reservation Queue Ordering (FIFO with Timestamp Tiebreaker)

```java
public void addReservation(Reservation res) {
  res.setPosition(queue.size());  // FIFO position
  res.setRequestedAt(System.currentTimeMillis());
  queue.add(res);
  
  // If tie in requestedAt (microsecond collision), use lexicographic ID
  Collections.sort(queue, Comparator
    .comparing(Reservation::getRequestedAt)
    .thenComparing(Reservation::getId)
  );
}
```

---

## 6. KEY ALGORITHMS

### searchBooks(query, searchType) — O(1)
```
if (searchType == TITLE) {
  return booksByTitle.get(query.toLowerCase());
} else if (searchType == AUTHOR) {
  return booksByAuthor.get(query.toLowerCase());
} else if (searchType == ISBN) {
  return Arrays.asList(booksByISBN.get(query));
}
```
**Complexity**: O(1) HashMap lookup + O(n) to return results

### borrowBook(memberId, copyId) — O(1) + Transaction
```
1. [LOCK] Acquire lock on BookCopy (database row-lock or synchronized)
2. [CHECK] if (copy.status != AVAILABLE) → REJECT
3. [CREATE] Loan record with dueAt = now + 10 days
4. [UPDATE] BookCopy.status = BORROWED, currentLoan = loanId
5. [UPDATE] Member.currentBorrows.add(loan)
6. [COMMIT] Release lock
```
**Complexity**: O(1) lookups + O(log n) list insertion

### returnBook(loanId) — O(1) + Fine Calculation
```
1. Retrieve Loan and BookCopy
2. daysOverdue = max(0, returnDate - dueDate)
3. IF daysOverdue > 0:
     fine = fineCalculationStrategy.calculate(loan, daysOverdue)
     fineRecord = create Fine(loanId, fine)
4. UPDATE Loan.returnedAt = now, fineAmount = fine
5. UPDATE BookCopy.status = AVAILABLE
6. [OBSERVER] notifyReservationQueue():
     IF (queue.isEmpty() == false):
       nextRes = queue.dequeue()
       notification = createNotification(nextRes.memberId, "Ready to borrow")
       SEND notification
7. UPDATE Member.currentBorrows.remove(loan)
```
**Complexity**: O(1) + O(k) where k = queue size

### reserveBook(memberId, bookId) — O(n)
```
1. IF (exists AVAILABLE copy):
     → Just borrow directly (bypass queue)
2. ELSE:
     position = calculatePosition(bookId)  // COUNT existing reservations
     res = new Reservation(memberId, bookId, position)
     queue.add(res)
     NOTIFY memberId: "Added to queue at position X"
```
**Complexity**: O(n) to count existing reservations

### payFine(fineId, amount) — O(1)
```
1. fine = retrieve(fineId)
2. fine.amountPaid += amount
3. IF (fine.amountPaid >= fine.amountOwed):
     fine.paidAt = now
     member.totalFinesOwed -= fine.amountOwed
4. RETURN fine.getRemainingAmount()
```
**Complexity**: O(1)

---

## 7. ADVANCED CONSIDERATIONS

### Extensibility Hooks
1. **Fine Strategies**: StudentDiscountFine, HolidayWaiverFine, DamageReplacementFine
2. **Search Indices**: Add category index, publication date range, keyword search
3. **Notification Channels**: SMS, Email, Push, In-App via Strategy + Observer
4. **Member Types**: Add FACULTY(limit=15), VISITOR(limit=1), RESEARCHER(limit=unlimited)
5. **Reservation Policies**: Priority for seniors, different queue rules for reference books

### Edge Cases & Handling
| Case | Handling |
|------|----------|
| **Multiple copies same book, 5+ reservations** | Dequeue first N; notify all simultaneously |
| **Member blocked while in reservation queue** | Leave in queue; reject if they reach front |
| **Copy damaged during borrow** | Charge replacement fine; remove from circulation |
| **Partial fine payment** | Member can borrow more if policy allows; fine remains payable |
| **Librarian removes book** | Cancel all active loans + reservations; refund fines? |
| **Member account deleted** | Mark as INACTIVE; keep audit trail; handle active loans |

### Testing Strategy
```
Unit Tests:
  - FineCalculationStrategy: verify tiered, capped, discount calculations
  - State transitions: valid/invalid paths in StateMachine
  - SearchIndex: add/update/delete book → verify index consistency

Integration Tests:
  - Full borrow→return→fine→pay flow
  - Reservation queue: multiple dequeues, position updates
  - Concurrent borrows: 100 threads, same copy → exactly 1 succeeds

Concurrency Tests:
  - Race condition: borrow + return simultaneous
  - Deadlock detection: circular wait scenarios
  - Load: 1000 searches/sec on inverted index

Boundary Tests:
  - Due date: leap year, DST transitions, timezone crossing
  - Fine: 0 days, 10 days, 365 days overdue
  - Limits: 0 copies, 1M members, 100M books
```

---

## 8. INTERVIEW TALKING POINTS

### Differentiation Question: "State vs Strategy — which for BookCopy status?"
**Answer**: "State. BookCopy status transitions internally based on actions (borrow, return); the object auto-manages state changes. Strategy is for fine calculation, which is selected externally by FineService. **Key distinction**: State transitions are automatic and internal; Strategy selection is manual and external."

### Concurrency Question: "How prevent two members borrowing same copy?"
**Answer**: "Row-level database lock (`FOR UPDATE`) + double-check pattern. Atomically: (1) Lock row, (2) Verify status=AVAILABLE, (3) Update status=BORROWED, (4) Create Loan, (5) Commit. If status changes between check and update, transaction rolls back and requesting member retries. This guarantees exactly one winner."

### Scalability Question: "1M books, 10K daily searches — performance?"
**Answer**: "Inverted indices (HashMap booksByTitle, booksByAuthor, booksByISBN) enable O(1) lookups. Singleton pattern ensures indices aren't duplicated. Trade-off: memory overhead for Map storage (~100MB for 1M books), but search latency < 1ms. For distributed systems, use distributed cache (Redis) instead of Singleton."

### Extensibility Question: "New fine rule: holiday waiver (25% discount Dec 20-Jan 5)?"
**Answer**: "Add `HolidayWaiverFineStrategy implements FineCalculationStrategy`. In `calculateFine()`, check if returnDate falls in holiday window; apply 0.75 multiplier. No changes to Loan, FineService, or borrowBook(). Strategy pattern decouples policy from logic."

### Observer Question: "Why Observer for reservation notifications vs polling?"
**Answer**: "Polling = every minute, query all reservations, check if copy available. Scales O(n) with reservations and runs 1K+ times daily. Observer = triggered only when copy actually returns; O(k) where k = queue size, runs once per return. Saves CPU and provides real-time notification."

---

## 9. CODE STRUCTURE ESTIMATE

| Layer | Classes | Lines of Code | Complexity |
|-------|---------|---------------|-----------|
| **Core Entities** | Book, BookCopy, Member, Loan, Reservation, Fine, Librarian, Notification | ~800 | Low |
| **Design Patterns** | 15+ (StateImpl, StrategyImpl, Observer, Chain validators, Commands, Visitor) | ~2000 | Medium |
| **Services** | LibraryCatalogService, BorrowService, ReturnService, SearchService, FineService | ~1200 | High |
| **Concurrency** | LockManager, TransactionManager | ~400 | High |
| **Utilities** | DateUtils, NotificationDispatcher, AuditLogger | ~600 | Low-Medium |
| **Total** | **40-50 classes** | **~5000 LOC** | **Medium-High** |

---

## 10. RELATED INTERVIEW TOPICS TO PREPARE

- **HashMap Internals**: How booksByTitle indexing works (hash collision, load factor)
- **Transactions & ACID**: Why row-lock maintains consistency; ACID properties
- **Threading & Synchronization**: synchronized vs ReentrantLock vs atomic operations
- **UML Diagrams**: Class & sequence diagrams for borrow→return flow
- **SOLID Principles**: How Strategy/Observer/Chain of Resp follow OCP/SRP
- **Database Design**: Indexing strategy for 1M books; query optimization
- **API Design**: Loan expiration; cascading deletes when book removed

---

## 11. RECOMMENDED RESOURCES

- **Video**: YouTube ID `fVqv4B8sG1s` - "Design a Library Management System LLD"
- **Patterns Reference**: Behavioral Patterns (State, Strategy, Observer, Command, Chain of Responsibility, Visitor)
- **Concurrency**: Database locks, row-level locking, optimistic concurrency control
- **Data Structures**: HashMap, PriorityQueue (for reservation ordering), LinkedHashMap (FIFO preservation)

