# Proximity & Location-Based Services

## Table of Contents

1. [Overview](#1-overview)
2. [The Core Problem](#2-the-core-problem)
3. [Geohashing](#3-geohashing)
4. [Quadtrees](#4-quadtrees)
5. [R-Trees](#5-r-trees)
6. [S2 Geometry (Google)](#6-s2-geometry-google)
7. [H3 (Uber)](#7-h3-uber)
8. [PostGIS & Spatial Databases](#8-postgis--spatial-databases)
9. [Comparison & Trade-offs](#9-comparison--trade-offs)
10. [System Design Patterns](#10-system-design-patterns)
11. [Key Takeaways](#11-key-takeaways)

---

## 1. Overview

Location-based services power ride-sharing (Uber), food delivery (DoorDash),
place search (Yelp/Google Maps), dating (Tinder), and friend-finding (Snapchat).
The core challenge: **efficiently find things near a point on Earth**.

```
User at (37.78, -122.41):
  "Show me restaurants within 1 mile"
  
Naive approach: Scan ALL restaurants, compute distance to each.
  → O(n) per query. With 100M POIs, this is unacceptable.
  
Goal: O(log n) or O(1) lookups using spatial indexing.
```

---

## 2. The Core Problem

### Why Standard Indexes Don't Work

```
Standard B-tree index:
  Can efficiently query: WHERE lat BETWEEN 37.7 AND 37.8
  But NOT simultaneously: WHERE lat BETWEEN ... AND lng BETWEEN ...
  
  A compound index on (lat, lng) helps with the first dimension
  but still scans all matching rows in the second dimension.
  
  ┌──────────────────────────────┐
  │  This entire latitude band   │  ← Still scanning thousands
  │  ========================== │     of irrelevant points
  │       ┌──┐                   │
  │       │  │ ← Actual area     │
  │       │  │   of interest     │
  │       └──┘                   │
  │  ========================== │
  └──────────────────────────────┘
```

### Distance Calculations

```
Haversine Formula (great-circle distance on a sphere):
  a = sin²(Δlat/2) + cos(lat₁) · cos(lat₂) · sin²(Δlng/2)
  d = 2R · arctan2(√a, √(1-a))
  
  Where R = 6,371 km (Earth's radius)

For short distances, approximate with:
  dx = (lng₂ - lng₁) × cos(lat₁)
  dy = lat₂ - lat₁
  d ≈ R × √(dx² + dy²)
```

---

## 3. <abbr title="Geohashing: encodes latitude/longitude into a short string; nearby locations share prefixes.">Geohashing</abbr>

Encodes a 2D location into a 1D string. Nearby locations share a common prefix.

```
Encoding (37.7749, -122.4194) → "9q8yyk"

How it works:
  1. Divide world into 2 halves (longitude): left = 0, right = 1
  2. Divide result into 2 halves (latitude): bottom = 0, top = 1
  3. Repeat, alternating longitude and latitude
  4. Convert binary to Base32

  Longitude range: [-180, 180]
  Step 1: -122.4 in [-180, 0]? Yes → bit = 0, range = [-180, 0]
  Step 2: -122.4 in [-180, -90]? No → bit = 1, range = [-90, 0]
  Step 3: -122.4 in [-90, -45]? No → bit = 1, range = [-45, 0]
  ...continue...

  Visual grid at precision 4:
  ┌────┬────┬────┬────┐
  │9q8z│9q9p│9q9r│    │
  ├────┼────┼────┼────┤
  │9q8y│9q9n│9q9q│    │  ← User is in "9q8y"
  ├────┼────┼────┼────┤    Nearby: 9q8z, 9q9n, 9q9p...
  │9q8w│9q9j│9q9m│    │
  └────┴────┴────┴────┘
```

### Geohash Precision Levels

| Precision | Cell Size           | Use Case                 |
|-----------|---------------------|--------------------------|
| 1         | ~5,000 × 5,000 km  | Continental              |
| 2         | ~1,250 × 625 km    | Large region             |
| 3         | ~156 × 156 km      | Large city               |
| 4         | ~39 × 19.5 km      | City                     |
| 5         | ~4.9 × 4.9 km      | Neighborhood             |
| 6         | ~1.2 × 0.6 km      | Block level              |
| 7         | ~153 × 153 m       | Street level             |
| 8         | ~38 × 19 m         | Building level           |

### Finding Nearby Points

```
To find points within radius R of a location:

1. Compute the geohash of the target location
2. Determine the precision level that covers the search radius
3. Find the 8 neighboring geohash cells
4. Query database: WHERE geohash LIKE 'prefix%' for all 9 cells
5. Filter results by exact distance (post-processing)

  ┌────┬────┬────┐
  │ NW │ N  │ NE │
  ├────┼────┼────┤
  │ W  │ ●  │ E  │  ← Query all 9 cells
  ├────┼────┼────┤
  │ SW │ S  │ SE │
  └────┴────┴────┘
```

### Edge Cases

```
Problem 1: Boundary issue
  Two points very close but in different cells:
  ┌──────────┬──────────┐
  │          │          │
  │        A ● ● B     │  ← A and B are 10m apart
  │   9q8y   │   9q9n   │     but in different cells
  └──────────┴──────────┘
  Solution: Always query neighboring cells.

Problem 2: Meridian/Pole wrap-around
  Geohash 0000... is adjacent to geohash zzzz... at the date line.
  Solution: Use libraries that handle wrap-around correctly.
```

**Pros**: Simple, string-based (easy to index with B-tree), prefix-based range queries.
**Cons**: Grid-aligned cells (boundary issues), uneven cell sizes near poles, 
fixed precision levels.

---

## 4. <abbr title="Quadtree: a tree that recursively splits 2D space into four quadrants for fast spatial queries.">Quadtrees</abbr>

A tree data structure that recursively divides 2D space into 4 quadrants.

```
Initial space:                After subdivisions:
┌────────────────┐            ┌────────┬────────┐
│                │            │  NW    │   NE   │
│     ● ●        │            │   ●    ├───┬────┤
│   ●     ●      │     →      │  ●     │ ● │    │
│         ●      │            ├────┬───┼───┼────┤
│  ●             │            │    │   │   │ ●  │
│          ●     │            │  ● │   │   │    │
└────────────────┘            └────┴───┴───┴────┘

Rule: Subdivide a cell when it contains > N points (e.g., N = 4)
```

### Quadtree Node Structure

```python
class QuadTreeNode:
    def __init__(self, boundary, capacity=4):
        self.boundary = boundary      # Rectangle (x, y, width, height)
        self.capacity = capacity      # Max points before split
        self.points = []
        self.divided = False
        self.nw = self.ne = self.sw = self.se = None
    
    def insert(self, point):
        if not self.boundary.contains(point):
            return False
        
        if len(self.points) < self.capacity:
            self.points.append(point)
            return True
        
        if not self.divided:
            self.subdivide()
        
        return (self.nw.insert(point) or self.ne.insert(point) or
                self.sw.insert(point) or self.se.insert(point))
    
    def query_range(self, search_area, found=None):
        if found is None:
            found = []
        
        if not self.boundary.intersects(search_area):
            return found
        
        for point in self.points:
            if search_area.contains(point):
                found.append(point)
        
        if self.divided:
            self.nw.query_range(search_area, found)
            self.ne.query_range(search_area, found)
            self.sw.query_range(search_area, found)
            self.se.query_range(search_area, found)
        
        return found
```

### Adaptive Density

```
Dense area (Manhattan):       Sparse area (Desert):
┌──┬──┬──┬──┐                ┌────────────────┐
│● │ ●│● │● │                │                │
├──┼──┼──┤  │                │       ●        │
│● │● │  │● │                │                │
├──┴──┼──┤──┤                │    ●           │
│  ●  │● │  │                │                │
├─────┼──┤──┤                └────────────────┘
│     │  │● │                  One large cell
└─────┴──┴──┘
Many small cells → higher precision where needed
```

**Pros**: Adapts to data density, efficient range queries, in-memory.
**Cons**: Not persistent (in-memory only), needs rebuilding on restart, 
updates require rebalancing, harder to distribute.

---

## 5. <abbr title="R-tree: a balanced tree that groups spatial objects using bounding rectangles for efficient range queries.">R-Trees</abbr>

Balanced tree that groups nearby objects using minimum bounding rectangles (MBRs).

```
R-Tree structure:

                    ┌───────────────────┐
                    │     Root          │
                    │ [MBR_A] [MBR_B]  │
                    └────┬────────┬─────┘
                         │        │
              ┌──────────┘        └──────────┐
              ▼                              ▼
    ┌─────────────────┐            ┌─────────────────┐
    │   Node A        │            │   Node B        │
    │ [R1] [R2] [R3]  │            │ [R4] [R5]       │
    └──┬────┬────┬────┘            └──┬────┬─────────┘
       │    │    │                    │    │
       ▼    ▼    ▼                    ▼    ▼
      pts  pts  pts                  pts  pts

Spatial query: "Find all points in this rectangle"
  → Start at root
  → Check which MBRs overlap with query rectangle
  → Traverse only overlapping branches
  → O(log n) average case
```

### R-Tree vs Quadtree

| Feature         | Quadtree               | R-Tree                  |
|----------------|------------------------|-------------------------|
| Division       | Fixed grid (4 quadrants)| Data-driven (MBRs)     |
| Balance        | Not guaranteed          | Balanced (like B-tree) |
| Disk-friendly  | Not really              | Yes (page-aligned)     |
| Updates        | Can unbalance           | Self-balancing         |
| Implementation | Simple                  | Complex                |
| Used in        | In-memory indexes       | PostGIS, SQLite, etc.  |

**Pros**: Balanced, disk-friendly, supports complex shapes (not just points), standard in spatial DBs.
**Cons**: More complex to implement, insertion can be slower.

---

## 6. <abbr title="S2 Geometry: Google's spatial indexing library that projects the Earth onto a sphere and divides it using a Hilbert curve.">S2 Geometry (Google)</abbr>

Google's library that projects Earth's surface onto a unit sphere and divides it
using a Hilbert space-filling curve.

```
Hilbert Curve mapping:
  Maps 2D space to 1D while preserving locality
  
  ┌──┬──┐       1D: 1-2-3-4-5-6-7-8-9-10-11-12-13-14-15-16
  │1 │2 │
  ├──┼──┤       Points close in 2D are close in 1D
  │4 │3 │       (better than geohash's Z-curve)
  └──┴──┘
  
S2 Cell Hierarchy:
  Level 0:  6 face cells (cube projected onto sphere)
  Level 1:  24 cells
  ...
  Level 12: ~3.3 km² cells
  Level 30: ~1 cm² cells (maximum precision)
  
  Each cell has a 64-bit Cell ID → simple integer comparisons!
```

### S2 Cell Covering

```
To find "all restaurants within 5km of user":

1. Create a circle (center = user location, radius = 5km)
2. Compute a "covering" = minimum set of S2 cells that cover the circle
3. Query: WHERE s2_cell_id BETWEEN cell_min AND cell_max
   (for each cell in the covering)

  ┌───────────────────┐
  │     ┌──────┐      │
  │  ┌──┤ Cell ├──┐   │
  │  │  │  2   │  │   │
  │  │  └──────┘  │   │  ← S2 covering with ~8 cells
  │  │  ╭──────╮  │   │     approximates the circle
  │  │ ╱  5km  ╲ │   │
  │  │╱ radius  ╲│   │
  │  │╲   ●    ╱ │   │
  │  │ ╲      ╱  │   │
  │  │  ╰────╯   │   │
  │  └────────────┘   │
  └───────────────────┘
```

**Used by**: Google Maps, Google Earth, Pokémon Go, Foursquare.
**Pros**: Excellent locality preservation, variable precision, works with standard integer indexes.
**Cons**: Complex library, learning curve.

---

## 7. <abbr title="H3: Uber's hexagonal hierarchical spatial index for geospatial queries.">H3 (Uber)</abbr>

Uber's hexagonal hierarchical spatial index.

```
Why hexagons?
  Squares:           Hexagons:
  ┌──┬──┐            ╱╲  ╱╲
  │  │  │           ╱  ╲╱  ╲
  ├──┼──┤          │    ●    │
  │  │  │           ╲  ╱╲  ╱
  └──┴──┘            ╲╱  ╲╱
  
  - Square neighbors have 2 different distances (side vs diagonal)
  - Hexagon neighbors all have the SAME distance
  - Better approximation of circles (important for "X within radius")
  
H3 Resolution Levels:
  Res 0: ~4.3M km² (122 base cells)
  Res 4: ~1,770 km²
  Res 7: ~5.16 km²  ← city block
  Res 9: ~105 m²    ← building
  Res 15: ~0.9 m²   ← maximum
  
  Each hex has 7 children (approximately) at the next resolution.
```

### H3 Operations

```python
import h3

# Location to H3 index
h3_index = h3.latlng_to_cell(37.7749, -122.4194, resolution=9)
# → '8928308280fffff'

# Get neighboring hexagons (k-ring)
neighbors = h3.grid_disk(h3_index, k=1)
# → Returns center cell + 6 surrounding cells

# H3 index back to location
lat, lng = h3.cell_to_latlng(h3_index)
```

**Used by**: Uber (matching riders/drivers, surge pricing, ETAs).
**Pros**: Uniform neighbor distances, great for movement/routing, hierarchical.
**Cons**: Not natively supported by most databases, hex grids don't tile perfectly at all resolutions.

---

## 8. <abbr title="PostGIS: PostgreSQL extension that adds spatial data types, functions, and indexes for geospatial queries.">PostGIS & Spatial Databases</abbr>

PostGIS extends PostgreSQL with spatial data types and indexes.

```sql
-- Create a table with a geography column
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    name TEXT,
    location GEOGRAPHY(POINT, 4326)  -- WGS 84 coordinate system
);

-- Create a spatial index (uses R-tree internally via GiST)
CREATE INDEX idx_restaurants_location ON restaurants USING GIST(location);

-- Insert a restaurant
INSERT INTO restaurants (name, location)
VALUES ('Pizza Place', ST_MakePoint(-122.4194, 37.7749)::geography);

-- Find restaurants within 1000 meters
SELECT name, ST_Distance(location, ST_MakePoint(-122.42, 37.78)::geography) AS dist
FROM restaurants
WHERE ST_DWithin(location, ST_MakePoint(-122.42, 37.78)::geography, 1000)
ORDER BY dist;
```

### Other Spatial Database Options

| Database       | Spatial Support           | Index Type  |
|---------------|---------------------------|-------------|
| PostgreSQL    | PostGIS extension         | GiST (R-tree) |
| MySQL         | Built-in spatial          | R-tree      |
| MongoDB       | Built-in 2dsphere         | Geohash     |
| Redis         | GEOADD/GEOSEARCH          | Sorted set (geohash) |
| Elasticsearch | geo_point, geo_shape      | BKD tree    |
| DynamoDB      | Geo Library (geohash)     | B-tree on geohash |

---

## 9. Comparison & Trade-offs

| Approach    | Index Type | Neighbor Distance | Precision   | DB Support   | Complexity |
|------------|-----------|-------------------|-------------|-------------|------------|
| Geohash    | String/B-tree | Unequal (rect) | Fixed levels | Excellent  | Simple     |
| Quadtree   | In-memory tree | Unequal       | Adaptive    | Custom      | Moderate   |
| R-Tree     | Balanced tree  | N/A           | Exact       | PostGIS, etc.| Complex   |
| S2         | 64-bit int    | Good           | 30 levels   | Libraries   | Complex    |
| H3         | 64-bit int    | Uniform (hex)  | 16 levels   | Libraries   | Moderate   |

### When to Use What

```
Simple proximity search with any DB?
  └── Geohash (easiest to implement, works with any database)

Using PostgreSQL?
  └── PostGIS with GiST index (R-tree under the hood)

Building Uber-like real-time matching?
  └── H3 (uniform distances, great for movement)

Google-scale with fine-grained control?
  └── S2 Geometry

In-memory spatial index for a service?
  └── Quadtree (simple, adaptive)
```

---

## 10. System Design Patterns

### Pattern 1: Nearby Search (Yelp, Google Places)

```
User Request: "Find coffee shops within 2km"

┌──────┐     ┌───────────┐     ┌──────────────────────┐
│Client│────►│ API Server│────►│ Geohash/S2 Index     │
│      │     │           │     │ "9q8yy*" + neighbors │
│      │◄────│           │◄────│ → candidate set      │
└──────┘     └───────────┘     └──────────────────────┘
                  │
                  ▼
         Post-filter by exact
         distance (Haversine)
         + sort by distance
```

### Pattern 2: Real-Time Location Tracking (Uber)

```
Driver sends location every 3 seconds:

Driver ──► WebSocket ──► Location Service ──► Update H3 cell
                                              │
                         ┌────────────────────┘
                         ▼
                    ┌──────────┐
                    │ Redis    │  Key: h3_cell_id
                    │          │  Value: {driver_id, lat, lng, timestamp}
                    │          │  TTL: 30 seconds (auto-expire stale)
                    └──────────┘

Rider requests ride:
  1. Compute rider's H3 cell
  2. Query k-ring (center + surrounding cells)
  3. Get all drivers in those cells from Redis
  4. Rank by distance and ETA
```

### Pattern 3: Geofencing

```
"Notify user when they enter Times Square area"

  Define geofence as polygon:
    [(40.757, -73.986), (40.759, -73.984), ...]
  
  On each location update:
    - Compute S2/H3 cell
    - Check if cell overlaps any geofence
    - If yes, run point-in-polygon test
    - Trigger notification if entered
```

---

## 11. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Standard indexes fail for 2D queries | Need specialized spatial indexing |
| Geohash is the simplest starting point | String prefix queries on any DB, but query neighboring cells |
| Quadtrees adapt to data density | Dense urban → small cells, sparse rural → large cells |
| R-trees power spatial databases | PostGIS, MySQL spatial — the "B-tree of spatial" |
| H3's hexagons give uniform distances | Critical for ride-matching, delivery radius |
| Always post-filter by exact distance | Spatial indexes return candidates, not exact results |
| Real-time tracking needs in-memory stores | Redis with geohash or H3, short TTLs for freshness |
| Choose based on your database & scale | Geohash for simplicity, PostGIS for SQL, H3/S2 for scale |
