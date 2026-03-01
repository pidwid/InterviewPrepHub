# 🛠️ Multi-threaded Merge Sort (LLD/Concurrency)

Standard Merge Sort splits an array in half, recursively sorts both halves, and then merges them back together. Because sorting the left half and right half are completely independent mathematically, it is the perfect candidate for the **Fork/Join Framework** (parallel processing).

---

## 1. Requirements

- Sort a large array of integers (e.g., millions of elements) in ascending order.
- Utilize multiple CPU cores.
- If the array chunk is small enough (threshold), falling back to standard single-threaded sorting prevents the overhead of creating too many threads.

---

## 2. Approach: The Fork/Join Pool

Java 7 introduced the `ForkJoinPool`, specifically designed for Divide-and-Conquer algorithms.

Instead of explicitly creating standard `Thread` objects (which are heavy to spin up), we create `RecursiveAction` or `RecursiveTask` objects.
- **Fork:** Splits the task into two sub-tasks and pushes them to work-stealing queues.
- **Join:** Waits for the sub-tasks to finish, then merges their results.

---

## 3. Implementation (Java)

```java
import java.util.Arrays;
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.RecursiveAction;

public class ConcurrentMergeSort {

    public static void main(String[] args) {
        int[] array = {38, 27, 43, 3, 9, 82, 10, 19, 50, 1, 4, 30};
        
        System.out.println("Before: " + Arrays.toString(array));
        
        // The ForkJoinPool automatically sizes itself to the number of CPU cores available
        ForkJoinPool pool = new ForkJoinPool();
        
        // Start the recursive sorting process
        pool.invoke(new MergeSortTask(array, 0, array.length - 1));
        
        System.out.println("After:  " + Arrays.toString(array));
    }

    // The Recursive Task
    static class MergeSortTask extends RecursiveAction {
        private final int[] array;
        private final int left;
        private final int right;
        // Threshold where parallel overhead outweighs benefits
        private static final int THRESHOLD = 1000; 

        public MergeSortTask(int[] array, int left, int right) {
            this.array = array;
            this.left = left;
            this.right = right;
        }

        @Override
        protected void compute() {
            if (left < right) {
                // Base Case: If chunk is small, use built-in dual-pivot Quicksort
                if (right - left < THRESHOLD) {
                    Arrays.sort(array, left, right + 1);
                    return;
                }

                int mid = left + (right - left) / 2;

                // 1. FORK Phase: Split into two new independent tasks
                MergeSortTask leftTask = new MergeSortTask(array, left, mid);
                MergeSortTask rightTask = new MergeSortTask(array, mid + 1, right);

                // Start the left task on a background worker thread
                leftTask.fork();
                
                // Do the right task on the current thread
                rightTask.compute();

                // 2. JOIN Phase: Wait for the left background thread to finish
                leftTask.join();

                // 3. Both halves are now sorted. Merge them!
                merge(array, left, mid, right);
            }
        }

        // Standard 2-pointer Merge Algorithm
        private void merge(int[] arr, int left, int mid, int right) {
            int n1 = mid - left + 1;
            int n2 = right - mid;

            int[] LeftArr = new int[n1];
            int[] RightArr = new int[n2];

            System.arraycopy(arr, left, LeftArr, 0, n1);
            System.arraycopy(arr, mid + 1, RightArr, 0, n2);

            int i = 0, j = 0, k = left;

            while (i < n1 && j < n2) {
                if (LeftArr[i] <= RightArr[j]) {
                    arr[k] = LeftArr[i];
                    i++;
                } else {
                    arr[k] = RightArr[j];
                    j++;
                }
                k++;
            }

            while (i < n1) {
                arr[k] = LeftArr[i];
                i++;
                k++;
            }

            while (j < n2) {
                arr[k] = RightArr[j];
                j++;
                k++;
            }
        }
    }
}
```

### Why ForkJoinPool over ExecutorService (Thread Pool)?
If you used a standard `Executors.newFixedThreadPool(4)` and submitted the left half and right half tasks, and then called `future.get()` (join) on them, the thread would block. If the pool is filled with 4 threads all calling `get()`, they are all waiting for sub-tasks that have no available threads to run on, resulting in Deadlock (ThreadPool Starvation).

**Work-Stealing Algorithm:**
`ForkJoinPool` is designed so that when a thread calls `join()`, instead of going to sleep, it actively looks at other queues and "steals" their sub-tasks to process, ensuring that CPU cores are constantly doing useful work and never deadlocking during recursive splits.