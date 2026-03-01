# Design a Survey System — Google Forms (LLD)

A survey system allows users to create forms with various question types, share them with respondents, collect responses, and view aggregated results. This tests Composite pattern (nested sections), Builder pattern (form construction), and Strategy pattern (validation rules).

---

## 1. Requirements

### Functional Requirements
- **Form Creation:** Create forms with a title, description, and multiple questions.
- **Question Types:** Multiple choice, checkbox, text, dropdown, rating scale, date picker.
- **Sections:** Group questions into sections (nested sections allowed).
- **Validation Rules:** Required fields, min/max length, regex patterns.
- **Response Collection:** Respondents fill out forms. One response per respondent (configurable).
- **Results & Analytics:** View individual responses and aggregated statistics (counts, percentages, charts data).
- **Sharing:** Generate shareable links. Control access (public, restricted by email).

### Non-Functional Requirements
- **Extensibility:** Easy to add new question types without modifying existing code.
- **Concurrency:** Multiple respondents submitting simultaneously.

---

## 2. Core Entities

- `SurveySystem` — manages all forms
- `Form` — title, description, list of sections, settings
- `Section` — title, list of questions (Composite: can nest sections)
- `Question` (Abstract) → `MCQ`, `Checkbox`, `TextQuestion`, `RatingQuestion`, `DropdownQuestion`
- `Option` — for MCQ/Checkbox/Dropdown questions
- `ValidationRule` (Interface) → `RequiredRule`, `MinLengthRule`, `RegexRule`
- `Response` — links respondent to a form with list of answers
- `Answer` — links a question to the respondent's value(s)
- `FormSettings` — allow multiple submissions, collect email, close date

---

## 3. Key Design Decisions

### Composite Pattern for Sections

```java
public interface FormElement {
    String getTitle();
    List<Question> getAllQuestions(); // flattens nested structure
}

public class Question implements FormElement { /* leaf */ }
public class Section implements FormElement {
    private List<FormElement> children; // mix of Questions and sub-Sections
}
```

### Factory Pattern for Question Types

```java
public class QuestionFactory {
    public static Question create(QuestionType type, String title, List<Option> options) {
        return switch (type) {
            case MCQ -> new MCQQuestion(title, options);
            case CHECKBOX -> new CheckboxQuestion(title, options);
            case TEXT -> new TextQuestion(title);
            case RATING -> new RatingQuestion(title);
            default -> throw new UnsupportedQuestionTypeException(type);
        };
    }
}
```

### Strategy Pattern for Validation

```java
public interface ValidationRule {
    boolean validate(Answer answer);
    String getErrorMessage();
}

public class RequiredRule implements ValidationRule {
    public boolean validate(Answer answer) { return answer.getValue() != null && !answer.getValue().isEmpty(); }
}
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| Composite  | Form → Section → Question hierarchy            |
| Factory    | Create different question types                |
| Builder    | FormBuilder for fluent form construction       |
| Strategy   | Validation rules (required, regex, length)     |
| Observer   | Notify form owner on new response              |
