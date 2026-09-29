# Software Requirements Specification (SRS) — Crunch Week

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) documents the requirements for **Crunch Week**, a student workload–planning application. The purpose of the software is to help college students see upcoming coursework, understand how much work they have each week, and recognize difficult weeks before they happen. This document defines the functional and non-functional requirements that the development team will build and that testers will validate.
This SRS also incorporates the "program requirements" for the same product, which cover login/authentication, syllabus input, and difficulty summaries. Where the two sets of requirements are at different maturity levels, both are presented as-is; nothing has been fabricated.

### 1.2 Intended Audience

This SRS is intended for the people who produce and use requirements for this product, as described in the guide this document follows: product owners and business analysts (who define requirements), developers (who understand what to build), testers (who create test cases and validate), project managers (who track scope and progress), and clients/stakeholders (who approve features and expectations). The requirements do not identify specific named individuals or departments.

### 1.3 Intended Use

This SRS establishes the single source of truth for what Crunch Week must do. It is used to:

*   Align the development team on functionality and constraints.
    
*   Provide a basis for writing test cases and acceptance checks.
    
*   Track scope and prevent unchecked additions during development.
    
*   Communicate expected behavior to stakeholders.
    
*   Provide traceability from user stories to functional requirements (see Section 3.5).
    

Like any SRS, it is a living document that should be reviewed, updated, and validated as requirements evolve.

### 1.4 Product Scope

Crunch Week is a student workload–planning application whose purpose is to help college students see upcoming coursework, understand how much work they have each week, and recognize difficult weeks before they happen.
The current prototype scope explicitly excludes authentication, a database, server communication, and live Moodle integration; the prototype is intended to operate without them. The program-requirements draft additionally envisions login, authentication, and authorization, inputs such as syllabi, a Moodle calendar, and course reviews, and outputs such as class-difficulty-spike summaries; these are captured as functional requirements in this document, though several details remain undecided (for example, the specific authentication provider).

> **Note (uncertainty/conflict):** The prototype scope states the current system should operate without authentication, a database, server communication, or live Moodle integration, while the program-requirements draft lists login, authentication, Moodle-calendar input, and course reviews. These two sets of requirements conflict in scope and need to be resolved by the team.

### 1.5 Definitions and Acronyms

*   **SRS** — Software Requirements Specification.
    
*   **FR** — Functional Requirement.
    
*   **NFR** — Non-Functional Requirement.
    
*   **US** — User Story.
    
*   **Semester** — A 15-week academic term used by the application for workload planning.
    
*   **Workload** — The estimated hours of schoolwork for a given week.
    
*   **Capacity** — The number of hours a student has available for schoolwork in a week.
    
*   **Crunch week** — A week in which the estimated workload is greater than the student's available capacity.
    
*   **Crunch period** — A group of consecutive crunch weeks.
    
*   **EARS** — Easy Approach to Requirements Syntax (used for requirement phrasing).
    
*   **Expo** — A framework used to develop the application; the system is developed using Expo and React Native.
    
*   **Expo Web** — The mechanism by which the prototype runs in a web browser.
    
*   **Moodle** — A learning platform referenced as a possible input; not integrated within the current prototype.
    
*   **OAuth** — An authorization framework mentioned as a tentative option in the program-requirements draft.
    

## 2. Overall Description

### 2.1 User Needs

The primary user of Crunch Week is a college student. The product is needed because students want to see upcoming coursework, understand how much work they have each week, and recognize difficult weeks before they happen. Workload information must be presented so that a college student can understand it without needing technical knowledge.
The program-requirements draft indicates the product may also serve students seeking class-difficulty information, providing full summaries of class difficulty spikes, notifications, and a visual depiction of where assignments fall across weeks.
Questions addressed:

*   **Why is this product needed?** To help students see upcoming coursework, understand weekly workload, and recognize difficult weeks before they occur.
    
*   **Who is it for?** College students.
    
*   **Is it a new product?** The requirements describe a current prototype that is still being developed.
    
*   **Integrations?** Within the prototype's scope, no external integrations are required (no database, server, authentication, or live Moodle integration). The program-requirements draft raises integration options (e.g., Moodle calendar) as possible inputs.
    

### 2.2 Assumptions and Dependencies

Assumptions and dependencies drawn directly from the requirements:

*   The current prototype operates without authentication, a database, server communication, or live Moodle integration; it therefore does not depend on these external systems.
    
*   React Native/Expo and Expo Web are relied upon as the development and web-run platforms.
    
*   The program-requirements draft flags several external factors as tentative rather than decided: the authentication approach ("simple maybe OAuth", possibly reusing an existing provider), whether a Moodle calendar is used as an input, and the handling of course reviews. These are open dependencies pending clarification and are not asserted as final in this SRS.
    

> **Note (uncertainty):** The authentication approach, the Moodle-calendar input, and the treatment of course reviews are undecided in the requirements and need clarification.

## 3. System Features and Requirements

### 3.1 Functional Requirements

#### 3.1.1 Numbered and Described

The following functional requirements are taken from the Crunch Week requirements specification:

*   **FR-01 — Semester Workload:** The system shall display the student's estimated workload for each of the 15 weeks in the semester.
    
*   **FR-02 — Weekly Capacity:** The system shall display the number of hours the student has available for schoolwork each week.
    
*   **FR-03 — Workload Comparison:** The system shall compare the estimated workload for each week with the student's available weekly capacity.
    
*   **FR-04 — Crunch Detection:** The system shall identify a week as a crunch week when the estimated workload is greater than the student's available capacity.
    
*   **FR-05 — Crunch Periods:** The system shall group consecutive crunch weeks into one crunch period.
    
*   **FR-06 — Current Week Tasks:** The system shall display outstanding tasks for the current week.
    
*   **FR-07 — Task Prioritization:** The system shall order outstanding tasks by urgency, ranked by overdue tasks first, then tasks due sooner, then larger estimated tasks, then alphabetical order when necessary.
    
*   **FR-08 — Complete Task:** The system shall allow the student to mark an assignment as completed.
    
*   **FR-09 — Update Workload:** When a task is marked complete, the system shall remove its hours from the remaining workload.
    
*   **FR-10 — Shared Data:** The Semester screen and the This Week screen shall use the same semester state.
    
*   **FR-11 — Estimated Hours:** The system shall allow a task to contain an estimated number of hours.
    
*   **FR-12 — Missing Estimates:** The system shall allow tasks to exist even if estimated hours have not been provided.
    
*   **FR-13 — Multi-Week Tasks:** The system shall allow the workload of a large assignment to be distributed across multiple weeks.
    
*   **FR-14 — Start-By Recommendation:** The system shall calculate a recommended week for starting an assignment before its due week.
    
*   **FR-15 — Attendance Information:** The system shall display remaining allowable absences for a course when an attendance policy exists.
    
*   **FR-16 — Missing Attendance Policy:** The system shall indicate when a course does not have an attendance policy.
    
*   **FR-17 — Navigation:** The system shall allow the user to navigate between the Semester view and the This Week view.
    

The following functional requirements are taken from the program-requirements draft; they are more tentative in nature and several details remain undecided:

*   **FR-18 — Login:** The system shall provide a login feature. The specific implementation is not fully decided.
    
*   **FR-19 — Authentication:** The system shall authenticate users. The draft suggests simple authentication, possibly OAuth, and raises the option of searching for an existing provider; this choice is undecided.
    
*   **FR-20 — Authorization:** The system shall support authorization.
    
*   **FR-21 — Inputs:** The system shall accept inputs, including a syllabus, possibly a Moodle calendar, and course reviews.
    
*   **FR-22 — Input Storage:** The system shall store reviews (not the syllabus).
    
*   **FR-23 — Input Processing:** The system shall process inputs by scanning the syllabus, performing calculations, and processing crowd-sourcing input.
    
*   **FR-24 — Outputs:** The system shall produce a full summary of class difficulty spikes, provide test notifications with difficulty information, and provide a visual depiction of where assignments fall on which weeks.
    

> **Note (uncertainty/conflict):** FR-18 through FR-24 describe features (login, authentication, Moodle input) that lie outside the stated scope of the current prototype, which operates without authentication, a database, server communication, or live Moodle integration. Both sets of requirements are presented as-is from their respective sources and need to be reconciled.

#### 3.1.2 EARS Format

Key requirements below are restated using the guide's EARS syntax ("When [event], the system shall [response]"):

*   When a week's estimated workload is greater than the student's available capacity, the system shall identify that week as a crunch week.
    
*   When a task is marked complete, the system shall remove the task's hours from the remaining workload.
    
*   When the student switches between the Semester view and the This Week view, the system shall present the same semester data in both views.
    
*   When the student returns to the workload display after completing a task, the system shall show the updated workload without a manual refresh.
    
*   When a course has an attendance policy, the system shall display the remaining allowable absences for that course.
    
*   When a course has no attendance policy, the system shall indicate that attendance information is unavailable.
    
*   When an assignment spans multiple weeks, the system shall distribute its workload across those weeks.
    
*   When a course receives sufficient crowd-sourcing input, the system shall process that input to contribute to difficulty estimations.
    

### 3.2 Non-Functional Requirements

#### 3.2.1 Performance

The requirements specify responsiveness rather than numeric performance targets:

*   **NFR-03 — Responsiveness:** When a student marks a task as completed, the displayed workload shall update without requiring the user to manually refresh the page.  
    No numeric performance targets (e.g., response-time percentiles) are stated in the requirements, and none have been added here.
    

#### 3.2.2 Security

The requirements do not define specific security requirements. The program-requirements draft mentions authentication and authorization as program requirements, but their details are undecided (e.g., whether OAuth or an existing provider is used). No further security requirements have been asserted.

#### 3.2.3 Usability, Reliability, Compliance

*   **NFR-08 — Usability:** The system shall present workload information in a form that a college student can understand without needing technical knowledge.
    
*   **NFR-04 — Reliability:** The application shall continue running when a task has no estimated hours or a course has no attendance policy.
    
*   **NFR-05 — Testability:** Workload calculations shall be separated from the user interface so they can be tested independently.
    
*   **NFR-06 — Maintainability:** The project shall keep data, calculation logic, and interface code in separate parts of the application.
    
*   **NFR-07 — Consistency:** Changes made on one screen shall be reflected correctly on the other screen.
    
*   **NFR-01 — Platform:** The system shall be developed using Expo and React Native.
    
*   **NFR-02 — Web Support:** The prototype shall be able to run in a web browser using Expo Web.
    
*   **NFR-09 — Prototype Scope:** The current prototype shall operate without requiring authentication, a database, server communication, or live Moodle integration.
    

No compliance-specific requirements are stated in the requirements, and none have been added here.

### 3.3 (Section omitted per instruction — External Interface Requirements is not included.)

### 3.4 System Features

*   **Semester view:** Displays the student's estimated workload across the 15-week semester, available weekly capacity, workload-versus-capacity comparison, and identified crunch periods.
    
*   **This Week view:** Displays outstanding tasks for the current week ordered by urgency (overdue first, then due sooner, then larger, then alphabetical), and allows tasks to be marked completed.
    
*   **Start-by recommendations:** Provides a suggested week for starting larger assignments that may span several weeks.
    
*   **Attendance information:** Displays remaining allowable absences for courses with attendance policies and indicates absence of such information otherwise.
    
*   **Difficulty summary (program-requirements draft):** A full summary of class difficulty spikes, notifications including difficulty, and a visual depiction of where assignments fall on which weeks.
    

### 3.5 User Story Traceability (Step 6 — Link User Stories to Requirements)

Connecting user stories to high-level functional requirements ensures traceability throughout the development lifecycle. Since no user stories were previously defined, one user story per functional requirement has been derived below. Consistent identifiers (US-01 through US-25) are used so each story maps unambiguously to a single FR.

#### 3.5.1 User Stories

*   **US-01 (FR-01):** As a student, I want to view my estimated workload for each of the 15 weeks in the semester, so that I can plan my schoolwork across the term.
    
*   **US-02 (FR-02):** As a student, I want to see how many hours I have available for schoolwork each week, so that I know my weekly capacity.
    
*   **US-03 (FR-03):** As a student, I want to compare my estimated workload against my weekly capacity, so that I can see whether my schedule is balanced.
    
*   **US-04 (FR-04):** As a student, I want to identify the weeks where my workload is greater than my available capacity, so that I can recognize difficult weeks before they happen.
    
*   **US-05 (FR-05):** As a student, I want consecutive overloaded weeks grouped into a single crunch period, so that I can understand the full extent of a heavy stretch.
    
*   **US-06 (FR-06):** As a student, I want to view the tasks I need to complete during the current week, so that I know what to focus on now.
    
*   **US-07 (FR-07):** As a student, I want my current tasks ordered by urgency, so that more urgent work appears first and I can prioritize accordingly.
    
*   **US-08 (FR-08):** As a student, I want to mark a task as completed, so that I can track what I've finished.
    
*   **US-09 (FR-09):** As a student, I want a completed task removed from my remaining workload, so that my remaining hours stay accurate.
    
*   **US-10 (FR-09):** As a student, I want the workload forecast to update when I complete a task, so that I can see my updated workload without manually refreshing.
    
*   **US-11 (FR-10):** As a student, I want the Semester and This Week views to use the same data, so that information remains consistent between screens.
    
*   **US-12 (FR-11):** As a student, I want to include an estimated number of hours on a task, so that my workload can be calculated.
    
*   **US-13 (FR-12):** As a student, I want to keep tasks that do not yet have an estimated number of hours, so that I can track them even without estimates.
    
*   **US-14 (FR-13):** As a student, I want a large assignment's workload distributed across several weeks, so that I can plan long projects.
    
*   **US-15 (FR-14):** As a student, I want a suggested week for starting a larger assignment, so that I know when to begin.
    
*   **US-16 (FR-15):** As a student, I want to see remaining allowable absences for courses that have attendance policies, so that I know my attendance status.
    
*   **US-17 (FR-16):** As a student, I want to see that attendance information is unavailable when a course has no attendance policy, so that I am not misled.
    
*   **US-18 (FR-17):** As a student, I want to move between the Semester view and the This Week view, so that I can navigate the application.
    
*   **US-19 (FR-18):** As a student, I want to log in to the application, so that I can use it.
    
*   **US-20 (FR-19):** As a student, I want to be authenticated, so that my identity is verified.
    
*   **US-21 (FR-20):** As a student, I want proper authorization, so that I only access what I should.
    
*   **US-22 (FR-21):** As a student, I want to provide inputs such as a syllabus, possibly a Moodle calendar, and course reviews, so that the system has data to work with.
    
*   **US-23 (FR-22):** As a student, I want my reviews (not the syllabus) to be stored, so that crowd-sourced data can be retained.
    
*   **US-24 (FR-23):** As a student, I want my inputs processed (syllabus scanned, calculations performed, crowd-sourcing input handled), so that I get meaningful results.
    
*   **US-25 (FR-24):** As a student, I want a full summary of class difficulty spikes, notifications with difficulty information, and a visual depiction of where assignments fall on which weeks, so that I can assess course difficulty.
    

> **Note:** US-19 through US-25 map to the tentative program requirements (FR-18 through FR-24) and inherit the scope conflict noted in Sections 1.4 and 3.1.1 — these stories fall outside the current prototype's stated scope and need reconciliation.

#### 3.5.2 Traceability Matrix

| User Story | Functional Requirement |
| --- | --- |
| US-01 | FR-01 — Semester Workload |
| US-02 | FR-02 — Weekly Capacity |
| US-03 | FR-03 — Workload Comparison |
| US-04 | FR-04 — Crunch Detection |
| US-05 | FR-05 — Crunch Periods |
| US-06 | FR-06 — Current Week Tasks |
| US-07 | FR-07 — Task Prioritization |
| US-08 | FR-08 — Complete Task |
| US-09 | FR-09 — Update Workload |
| US-10 | FR-09 — Update Workload |
| US-11 | FR-10 — Shared Data |
| US-12 | FR-11 — Estimated Hours |
| US-13 | FR-12 — Missing Estimates |
| US-14 | FR-13 — Multi-Week Tasks |
| US-15 | FR-14 — Start-By Recommendation |
| US-16 | FR-15 — Attendance Information |
| US-17 | FR-16 — Missing Attendance Policy |
| US-18 | FR-17 — Navigation |
| US-19 | FR-18 — Login |
| US-20 | FR-19 — Authentication |
| US-21 | FR-20 — Authorization |
| US-22 | FR-21 — Inputs |
| US-23 | FR-22 — Input Storage |
| US-24 | FR-23 — Input Processing |
| US-25 | FR-24 — Outputs |

## 4. Other Requirements

### 4.1 Database Requirements

The current Crunch Week prototype is specified to operate without a database. The program-requirements draft references storage of course reviews (not the syllabus) as an input-storage requirement and includes input processing of scanned syllabi, calculations, and crowd-sourcing input; however, the draft does not define a database schema, technology, or persistence design, so no database requirements are asserted beyond what is stated here.