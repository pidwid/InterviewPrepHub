# Design Consistent Hashing

This is rarely an "app design" question and heavily leans into a distributed systems algorithm question. Consistent Hashing is the fundamental routing algorithm used in DynamoDB, Cassandra, Redis Cluster, and Memcached to distribute data across multiple servers while minimizing the impact of server failures.

---

## Step 1 — Understand the Problem

### The Problem with Simple Hashing
In a distributed database, if we have 4 servers (N=4), and we want to store `key="user_123"`, a naive approach is to use the modulo operator:
`server_index = Hash("user_123") % 4`
Let's say this results in `server_index = 2`. The data goes to Server 2.

**The Catastrophe:** What happens if Server 2 crashes? Now we only have 3 servers (N=3).
When a new request comes in for `user_123`, the algorithm calculates:
`server_index = Hash("user_123") % 3`. 
The result will overwhelmingly likely be different (e.g., it now points to Server 0).
When `N` changes, **nearly every single key in the entire database now hashes to a different server.** 
This triggers a massive data migration storm, crashing the entire system (a Cache Stampede or Rebalance Storm).

### The Goal of Consistent Hashing
We need an algorithm where adding or removing a node only affects the keys specifically associated with that node ($\frac{1}{N}$ of the data), leaving the rest of the keys untouched.

---

## Step 2 — The Conceptual Design (The Hash Ring)

Imagine a standard hash function (like SHA-1) that outputs a massive integer between $0$ and $2^{160}-1$.
Instead of visualizing this as a straight line, bend the line so that zero and the maximum value meet, forming a **Ring**.

### 1. Placing Servers on the Ring
We take the IP address (or name) of our 4 database servers, hash them using SHA-1, and place them on this ring based on their hash value.

### 2. Placing Keys on the Ring
To find out where to store `key="user_123"`, we hash the key using the *same* SHA-1 function. We place the key on the ring.

### 3. The Routing Rule
To determine which server gets the key, we start at the key's position on the ring and walk **clockwise** until we encounter the very first Server Node. We store the data there.

---

## Step 3 — Design Deep Dive: Handling Failures and Imbalance

### Scenario 1: Removing a Node (Failure)
Assume we have Servers A, B, C, D on the ring. Key $K_1$ is located between A and B. Walking clockwise, $K_1$ belongs to Server B.
- **Server B crashes.**
- What happens to $K_1$?
- We walk clockwise from $K_1$. Since B is gone, the first server we hit is now **Server C**. $K_1$ is re-routed to C.
- What happens to keys stored on Server C or D? **Nothing.** They still map to C and D.
- *Result:* Only the keys that originally mapped to Server B are reassigned (which is roughly $\frac{1}{N}$ of the data). The system survives.

### Scenario 2: Adding a Node (Scale Up)
Assume we add Server E between B and C.
- Keys located between B and E will now map to the new Server E.
- Keys located between E and C will continue to map to Server C.
- *Result:* Only a small segment of data from Server C needs to be migrated to Server E. The rest of the ring is untouched.

### The Major Flaw: Non-Uniform Distribution (Hotspots)
In reality, hashing 4 IP addresses on a massive ring with $2^{160}$ positions will not result in them being perfectly spaced at 0, 90, 180, and 270 degrees. 
Server A and B might hash right next to each other. Consequently, Server B's "territory" on the ring is tiny, while Server A might own 60% of the ring. Server A will become a "Hotspot" and crash under the load.

### The Solution: Virtual Nodes (vNodes)
To fix unequal distribution, we don't just place Server A on the ring once. We place it on the ring **100 times**.
We hash `Server_A_1`, `Server_A_2`, ... `Server_A_100` and scatter them pseudo-randomly across the entire ring. We do the same for Server B, C, and D.

Now, the ring has 400 alternating nodes.
- **Perfect Distribution:** Statistically, the distance between any two nodes averages out. Server A is responsible for 100 tiny slivers of the ring, roughly equating to 25% of the total ring space.
- **Heterogeneous Hardware:** If Server A is a supercomputer with 128GB of RAM, and Server B is a weak machine with 16GB of RAM, we can assign 100 virtual nodes to Server A, and only 10 virtual nodes to Server B. Server A will naturally receive 10x more traffic.
- **Smoother Rebalancing:** If Server B crashes, all its 10 virtual nodes disappear. The territory of those 10 virtual nodes is absorbed by the closest clockwise nodes. Because the virtual nodes are scattered, the load of the dead Server B is distributed evenly across Server A, C, and D, instead of dumping 100% of the dead server's load onto exactly one neighbor.

---

## Step 4 — Implementation Details

### How is the Ring stored in Code?
You don't actually build a circular linked list. The ring is typically implemented as an **Array or a Binary Search Tree (Red-Black Tree)** on the client application routing the requests.

1. Create a 1D Array of Objects holding `[Hash_Value, Server_IP]`.
2. Sort the array ascending by `Hash_Value`.
3. When computing `hash(key)`, perform a **Binary Search** `O(log V)` (where V is the number of virtual nodes) on the array to find the first `Hash_Value` greater than or equal to the key's hash.
4. If the key's hash is larger than the final node in the array, loop around and pick the `0` index node.

### Real World Examples
- **Amazon DynamoDB / Apache Cassandra:** They organize their underlying Partition topologies using Consistent Hashing. Data is placed on a Token Ring, and nodes are assigned tokens (points on the ring).
- **Discord:** Discord uses Consistent Hashing in their API gateway to route users requesting a specific chat channel to the specific Erlang process (node) managing that channel's state.

### Summary
Consistent caching solves horizontal scalability for stateful datastores. By mapping keys and servers onto a circular keyspace and using Virtual Nodes (V-Nodes) for uniform distribution, we guarantee that resizing the cluster results in the absolute mathematical minimum `k/N` amount of data movement.