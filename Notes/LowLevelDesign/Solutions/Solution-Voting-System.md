# Design an Online Voting System (LLD)

An online voting system allows registered voters to cast ballots in elections. This problem tests your ability to model elections, candidates, voters, prevent duplicate voting, and apply the Observer pattern for real-time result tracking.

---

## 1. Requirements

### Functional Requirements
- **Election Management:** Admin creates elections with candidates and a voting period.
- **Voter Registration:** Users register with unique voter ID. Each voter can vote once per election.
- **Cast Vote:** Voters select a candidate and submit their ballot.
- **Results:** Real-time vote counting. Display results after election closes.
- **Duplicate Prevention:** Same voter cannot vote twice in the same election.

### Non-Functional Requirements
- **Thread-Safety:** Concurrent votes must not corrupt totals.
- **Auditability:** Every vote is logged immutably.

---

## 2. Core Entities

- `VotingSystem` — manages all elections
- `Election` — has candidates, start/end time, status (UPCOMING, ACTIVE, CLOSED)
- `Candidate` — name, party, vote count
- `Voter` — unique ID, list of elections already voted in
- `Ballot` — links voter to candidate in an election (immutable record)
- `ResultObserver` (Interface) — notified when votes change (Observer pattern)

---

## 3. Key Design Decisions

### Preventing Duplicate Votes

```java
public synchronized void castVote(Voter voter, Candidate candidate, Election election) {
    if (election.getStatus() != ElectionStatus.ACTIVE)
        throw new ElectionNotActiveException();
    if (voter.hasVotedIn(election))
        throw new DuplicateVoteException();

    Ballot ballot = new Ballot(voter, candidate, election, Instant.now());
    election.recordBallot(ballot);
    voter.markVoted(election);
    notifyObservers(election); // Observer pattern — update live results
}
```

### Observer Pattern for Live Results

```java
public interface ResultObserver {
    void onVoteRecorded(Election election, Map<Candidate, Integer> currentTally);
}

// Dashboard, audit log, etc. implement ResultObserver
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| Observer   | Real-time result updates to dashboards         |
| Strategy   | Voting methods (first-past-the-post, ranked choice) |
| Factory    | Create different election types                |
| Singleton  | VotingSystem as single entry point             |
