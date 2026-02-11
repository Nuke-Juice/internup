# Internactive Matching Algorithm (v1.1)

This document describes the current matching implementation in `/Users/alex.eggertsen/projects/internactive/lib/matching.ts` and admin tooling around it.

## 1) Algorithm Structure and Execution

### Entry points
- `evaluateInternshipMatch(...)` in `/Users/alex.eggertsen/projects/internactive/lib/matching.ts`
- `rankInternships(...)` in `/Users/alex.eggertsen/projects/internactive/lib/matching.ts`
- Jobs list ranking integration in `/Users/alex.eggertsen/projects/internactive/components/jobs/JobsView.tsx`
- Job detail match panel integration in `/Users/alex.eggertsen/projects/internactive/app/jobs/[id]/page.tsx`

### Matching versioning
- `MATCHING_VERSION = 'v1.1'` in `/Users/alex.eggertsen/projects/internactive/lib/matching.ts`
- Returned on each match result via `matchingVersion`.

### Data inputs

#### Student profile signals (matching input)
- `majors` from `student_profiles.major_id` + `student_profiles.majors`
- `year` from `student_profiles.year`
- `experience_level` from `student_profiles.experience_level`
- `availability_hours_per_week` from `student_profiles.availability_hours_per_week`
- `preferred_terms`, `preferred_locations`, `preferred_work_modes`, `remote_only`, `skills` parsed from `student_profiles.interests` via `/Users/alex.eggertsen/projects/internactive/lib/student/preferenceSignals.ts`
- Canonical IDs:
  - `skill_ids` from `student_skill_items.skill_id`
  - `coursework_item_ids` from `student_coursework_items.coursework_item_id`
  - `coursework_category_ids` from `student_coursework_category_links.category_id`

#### Internship signals (matching input)
- Core fields from `internships`:
  - `majors`, `target_graduation_years`, `experience_level`, `hours_per_week`, `location`, `work_mode`, `term`, `category/role_category`, `description`
  - `required_skills`, `preferred_skills`, `recommended_coursework`
- Canonical IDs:
  - `required_skill_ids` from `internship_required_skill_items.skill_id`
  - `preferred_skill_ids` from `internship_preferred_skill_items.skill_id`
  - `coursework_item_ids` from `internship_coursework_items.coursework_item_id`
  - `coursework_category_ids` from `internship_coursework_category_links.category_id`
  - `coursework_category_names` from joined `coursework_categories.name`

### Canonical lists and enums used
- Skills catalog: `skills` table
- Coursework item catalog: `coursework_items` table
- Coursework category catalog: `coursework_categories` table
- Majors catalog: `canonical_majors` table
- Internship experience enum: `entry | mid | senior`
- Student experience enum: `none | projects | internship`
- Work modes: `remote | hybrid | on-site`
- Terms/seasons normalized to: `spring | summer | fall | winter`

### Normalization / feature engineering
- Text normalization (`trim + lowercase + delimiter cleanup`) before overlap checks.
- Term derivation fallback:
  - prefer explicit `internship.term`
  - fallback parse `Season:` line from description
- Work mode derivation fallback:
  - prefer `internship.work_mode`
  - fallback parse suffix from `location` (e.g. `(Hybrid)`)
- Location normalization strips trailing mode suffix from location.
- Skill extraction fallback parses `Required skills:` and `Preferred skills:` lines in descriptions.
- Graduation year tokens are normalized to compact form before comparison.
- Experience levels mapped to ordinal values for comparisons.

### Scoring model

Weights are defined by `DEFAULT_MATCHING_WEIGHTS` in `/Users/alex.eggertsen/projects/internactive/lib/matching.ts`:
- `skillsRequired`: 4
- `skillsPreferred`: 2
- `courseworkAlignment`: 1.5
- `majorCategoryAlignment`: 3
- `graduationYearAlignment`: 1.5
- `experienceAlignment`: 1.5
- `availability`: 2
- `locationModePreference`: 1

Total max score is dynamic:
- `maxScore = sum(active weights)` via `getMatchMaxScore(...)`
- `normalizedScore = totalScore / maxScore`

### How each dimension contributes
- Required skills: overlap ratio x `skillsRequired`
  - canonical skill IDs are primary
  - text overlap fallback if canonical IDs unavailable
- Preferred skills: overlap ratio x `skillsPreferred`
  - same canonical-first fallback pattern
- Coursework alignment:
  - category ID overlap preferred
  - fallback to coursework item ID overlap
  - fallback to text overlap
- Major/category alignment:
  - major overlap ratio preferred
  - fallback partial category text match
- Graduation year alignment:
  - hard filter if internship target years provided and mismatch
  - full points if match
- Experience alignment:
  - hard filter if required level exceeds student level
  - full points if pass
- Availability:
  - proportional closeness between required and available hours
- Location/mode preference:
  - points if mode fits preference (or no preference set)

### Hard filters / ineligibility
Early-return `eligible=false` happens for:
- remote-only student vs in-person internship
- explicit work mode mismatch
- term mismatch
- internship hours exceeding student availability
- in-person location mismatch
- graduation year mismatch
- experience mismatch

### Explanation generation (“why this match”)
`evaluateInternshipMatch(..., { explain: true })` returns:
- `breakdown.totalScore`, `breakdown.maxScore`, `breakdown.normalizedScore`
- `breakdown.perSignalContributions[]` with:
  - `signalKey`, `weight`, `rawMatchValue`, `pointsAwarded`, `evidence`
- `breakdown.reasons[]` with:
  - `reasonKey`, `humanText`, `evidence`

Top-level reasons are sorted by points and surfaced in list/detail “Why this matches” UI.

### Fallback behavior when canonical IDs are missing
Canonical-first fallback order:
- Skills: canonical IDs -> text overlap
- Coursework: category IDs -> coursework item IDs -> text overlap
- Majors/category: major overlap -> category text fallback
- Term/work mode: explicit fields -> lightweight parsing from description/location

### Edge cases handled
- Remote roles and remote-only students
- Missing optional fields (scoring is sparse, not fatal)
- Hard-filter mismatches short-circuit to ineligible
- Partial profiles still score on available signals
- Empty catalogs degrade to text-based overlap where possible
- Draft/inactive internships are excluded from public ranking and preview defaults

## 2) Quality Over Quantity Differentiation

### What Internactive does differently (employer-facing)
- Canonical, category-first matching instead of free-text-only matching.
- Explainable match reasons and explicit gap reporting.
- Verification and constraint gates reduce low-fit spam.
- Curated internship inventory and concierge posting support.
- Eligibility-first ranking (term, mode, location, hours, experience, grad year) before broad exposure.

### Signals typically not standardized on generic boards
- Canonical coursework categories and item taxonomy.
- Canonical skill IDs linked both sides.
- Structured student preference object (term/location/work mode/remote-only) applied as constraints.
- Normalized experience-level compatibility and graduation-year targeting.

### Short messaging bullets for employers
- "We optimize for qualified fit, not applicant volume."
- "Every top match is explainable with concrete reason signals."
- "Canonical tags plus verification reduce irrelevant applications."
- "You get fewer, higher-intent candidates."

### Major -> coursework category -> internship type matrix
- Computer Science
  - Suggested coursework categories: Software Engineering Fundamentals, SQL / Databases, Statistics / Probability
  - Typical internship types: Software Engineering Intern, Backend Engineer Intern, Data Engineering Intern
- Information Systems
  - Suggested coursework categories: SQL / Databases, Data Visualization (Tableau/Power BI), Product Management Fundamentals
  - Typical internship types: Business Systems Analyst Intern, Product Operations Intern, Business Intelligence Intern
- Finance
  - Suggested coursework categories: Corporate Finance / Valuation, Financial Modeling (Excel), Statistics / Probability
  - Typical internship types: Financial Analyst Intern, FP&A Intern, Investment Analyst Intern
- Accounting
  - Suggested coursework categories: Financial Accounting, Managerial Accounting, Financial Modeling (Excel)
  - Typical internship types: Audit Intern, Tax Intern, Corporate Accounting Intern
- Marketing
  - Suggested coursework categories: Marketing Analytics, Data Visualization (Tableau/Power BI), Statistics / Probability
  - Typical internship types: Growth Marketing Intern, Digital Marketing Intern, Market Research Intern
- Data Science / Statistics
  - Suggested coursework categories: Statistics / Probability, Econometrics / Regression, SQL / Databases
  - Typical internship types: Data Analyst Intern, Data Science Intern, Analytics Engineering Intern
- Business Administration
  - Suggested coursework categories: Operations / Supply Chain, Corporate Finance / Valuation, Product Management Fundamentals
  - Typical internship types: Operations Intern, Business Analyst Intern, Strategy Intern
- Economics
  - Suggested coursework categories: Econometrics / Regression, Statistics / Probability, Corporate Finance / Valuation
  - Typical internship types: Economic Research Intern, Policy Analyst Intern, Quantitative Analyst Intern

### Risks and mitigations
- Risk: missing canonical tags degrades quality toward text fallback.
  - Mitigation: admin match-coverage indicators highlight missing dimensions.
- Risk: sparse student profiles reduce ranking fidelity.
  - Mitigation: completion nudges + admin student coverage tooling.

## 3) Admin Student-View Tooling

### Admin-only routes
- `/admin/matching/report`
- `/admin/matching/preview`

Access control:
- Enforced with `requireAnyRole(ADMIN_ROLES)` (`ops_admin`, `super_admin`).

### Student View / Match Preview
- Student selector with search by name/email.
- Optional filters: category, remote-only, term.
- Internship list ranked exactly as selected student would see.
- Score chip per listing (normalized score).
- Internship detail panel shows exact score, per-signal breakdown, reasons, and gaps.
- All computation server-side using admin-only route.

### Admin table coverage indicators
- Internships table includes match coverage dimensions:
  - majors, coursework categories, skills, term, hours, location/remote, grad year, experience
- Students table now surfaces:
  - canonical selections (skills + coursework categories)
  - missing match dimensions coverage list

## 4) Security and Data Exposure
- Admin matching routes are role-gated to admin roles only.
- Preview computation occurs server-side in admin pages; not exposed on employer/public routes.
- Employer/public pages continue receiving only student-safe match outputs.

## 5) Test Coverage Added
- Breakdown structure and sum consistency.
- Expected signal keys present in explain mode.
- Preview ranking consistency with direct match score.
- Admin preview access guard behavior for non-admin roles.
- Report model section presence for required report content.
