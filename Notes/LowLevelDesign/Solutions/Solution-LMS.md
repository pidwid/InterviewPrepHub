# Design a Learning Management System (LLD)

A Learning Management System (LMS) like Coursera or Udemy allows instructors to create courses, students to enroll, and the system to track progress. This problem tests modeling hierarchical content (Composite pattern), user roles, and progress tracking.

---

## 1. Requirements

### Functional Requirements
- **Course Management:** Instructors create courses with modules, lessons, and quizzes.
- **Enrollment:** Students enroll in courses (free or paid).
- **Content Delivery:** Students view lessons (video, text, PDF) in order.
- **Progress Tracking:** Track completion percentage per student per course.
- **Quizzes:** Students take quizzes; auto-grade multiple-choice questions.
- **Certificates:** Issue certificate on course completion.

### Non-Functional Requirements
- **Extensibility:** Easy to add new content types (interactive coding, live sessions).
- **Concurrency:** Multiple students taking quizzes simultaneously.

---

## 2. Core Entities

- `LMS` — singleton, manages courses and users
- `User` (Abstract) → `Student`, `Instructor`, `Admin`
- `Course` — title, instructor, list of modules, enrollment list
- `Module` — title, list of lessons (Composite: can contain sub-modules)
- `Lesson` (Abstract) → `VideoLesson`, `TextLesson`, `PDFLesson`
- `Quiz` — list of questions, passing score
- `Question` → `MCQ`, `TrueFalse`
- `Enrollment` — links Student to Course with progress percentage
- `Certificate` — generated on completion

---

## 3. Key Design Decisions

### Composite Pattern for Course Structure

```java
public interface CourseContent {
    String getTitle();
    int getTotalLessons();
}

public class Lesson implements CourseContent { /* leaf */ }
public class Module implements CourseContent {
    private List<CourseContent> children; // can be lessons or sub-modules
    public int getTotalLessons() {
        return children.stream().mapToInt(CourseContent::getTotalLessons).sum();
    }
}
```

### Progress Tracking

```java
public class Enrollment {
    private Student student;
    private Course course;
    private Set<Lesson> completedLessons = new HashSet<>();

    public double getProgressPercent() {
        return (completedLessons.size() * 100.0) / course.getTotalLessons();
    }

    public void markCompleted(Lesson lesson) {
        completedLessons.add(lesson);
        if (getProgressPercent() >= 100.0) {
            issueCertificate();
        }
    }
}
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| Composite  | Course → Module → Lesson hierarchy             |
| Strategy   | Grading strategies (auto-grade, manual-grade)  |
| Observer   | Notify student on grade, certificate issuance  |
| Factory    | Create different lesson types (Video, Text)    |
| Template   | Quiz evaluation flow (load → evaluate → score) |
