import generatedCatalog from '@/data/university-course-catalog.generated.json'
import manualCatalog from '@/data/university-course-catalog.manual.json'

type GeneratedCatalogShape = {
  coursework_by_university?: Record<string, string[]>
}

const GENERATED_COURSEWORK_BY_UNIVERSITY =
  ((generatedCatalog as GeneratedCatalogShape).coursework_by_university ?? {}) as Record<string, string[]>
const MANUAL_COURSEWORK_BY_UNIVERSITY =
  ((manualCatalog as GeneratedCatalogShape).coursework_by_university ?? {}) as Record<string, string[]>

const BASE_COURSEWORK = [
  'Financial Accounting',
  'Managerial Accounting',
  'Corporate Finance',
  'Investments',
  'Financial Modeling',
  'Business Analytics',
  'Business Communication',
  'Marketing Analytics',
  'Operations Management',
  'Product Management',
  'Intro to CS',
  'Object-Oriented Programming',
  'Data Structures',
  'Algorithms',
  'Database Systems',
  'Statistics',
  'Probability',
  'Machine Learning',
  'Data Visualization',
  'Technical Writing',
]

type UniversityCourseMap = Record<string, string[]>

const UNIVERSITY_COURSE_OVERRIDES: UniversityCourseMap = {
  'university of utah': [
    'ACCTG 2600 Financial Accounting',
    'ACCTG 3100 Intermediate Accounting I',
    'FINAN 3040 Principles of Finance',
    'FINAN 3200 Financial Management',
    'IS 4410 Database Design',
    'IS 4550 Data Analytics for Business',
    'CS 2420 Introduction to Algorithms and Data Structures',
    'DS 2500 Data Wrangling',
    'MKTG 3010 Marketing Management',
    'MGT 3810 Operations Management',
  ],
  'utah state university': [
    'ACCT 2010 Principles of Financial Accounting',
    'ACCT 2020 Principles of Managerial Accounting',
    'FIN 3200 Principles of Finance',
    'FIN 3400 Corporate Finance',
    'MIS 2100 Business Information Systems',
    'MIS 3200 Data Communications',
    'CS 2420 Data Structures and Algorithms',
    'STAT 2300 Business Statistics',
    'MGT 3700 Operations Management',
    'MKT 3700 Principles of Marketing',
  ],
  'brigham young university': [
    'ACC 200 Principles of Accounting',
    'ACC 310 Financial Accounting',
    'FIN 201 Financial Management',
    'FIN 453 Investment Analysis',
    'IS 201 Introduction to Management Information Systems',
    'IS 303 Database Systems',
    'CS 236 Discrete Structures',
    'CS 240 Advanced Programming Concepts',
    'STAT 121 Principles of Statistics',
    'MKTG 201 Marketing Management',
  ],
  'weber state university': [
    'ACCT 2010 Accounting Principles I',
    'ACCT 2020 Accounting Principles II',
    'FIN 3200 Corporate Finance',
    'MKTG 3010 Principles of Marketing',
    'SCM 3200 Operations and Supply Chain',
    'CIS 3100 Database Systems',
    'CS 2420 Introduction to Data Structures',
    'CS 2810 Computer Organization and Architecture',
    'DATA 3100 Data Analytics',
    'STAT 3000 Statistical Methods',
  ],
  'salt lake community college': [
    'ACCT 1110 Accounting Principles I',
    'ACCT 1120 Accounting Principles II',
    'BUS 1050 Foundations of Business',
    'BUS 2200 Business Statistics',
    'CIS 1020 Introduction to Information Systems',
    'CSIS 1400 Fundamentals of Programming',
    'CSIS 2420 Intro to Algorithms and Data Structures',
    'MKTG 1030 Principles of Marketing',
    'MGMT 2300 Human Relations in Business',
    'ECON 2010 Principles of Microeconomics',
  ],
  'westminster university': [
    'ACCT 230 Financial Accounting',
    'FIN 302 Corporate Finance',
    'MKT 300 Principles of Marketing',
    'MGT 310 Organizational Behavior',
    'BUS 355 Business Analytics',
    'CS 150 Computer Science I',
    'CS 2810 Data Structures',
    'DS 200 Intro to Data Science',
    'STAT 205 Statistics for Decision Making',
    'ENT 320 Innovation and Entrepreneurship',
  ],
  'utah valley university': [
    'ACC 2110 Principles of Accounting I',
    'ACC 2120 Principles of Accounting II',
    'FIN 3100 Principles of Finance',
    'MKTG 220G Marketing Principles',
    'MGMT 3000 Organizational Behavior',
    'IT 2600 Database Design and Development',
    'CS 2420 Introduction to Data Structures and Algorithms',
    'STAT 2040 Principles of Statistics',
    'DATA 3300 Data Science Fundamentals',
    'ECON 1010 Economics as a Social Science',
  ],
  'southern utah university': [
    'ACCT 2010 Financial Accounting',
    'ACCT 2020 Managerial Accounting',
    'FIN 3010 Principles of Finance',
    'MKTG 3010 Principles of Marketing',
    'MGT 3070 Operations Management',
    'CS 1410 Fundamentals of Programming',
    'CS 2420 Introduction to Data Structures',
    'CIS 3200 Database Management',
    'STAT 2050 Introduction to Statistics',
    'ECON 2010 Principles of Microeconomics',
  ],
  'university of southern california': [
    'BUAD 280 Accounting I',
    'BUAD 281 Accounting II',
    'BUAD 306 Business Finance',
    'BUAD 311 Marketing Fundamentals',
    'BUAD 425 Data Analysis for Decision Making',
    'CSCI 103 Introduction to Programming',
    'CSCI 170 Discrete Methods in Computer Science',
    'CSCI 201 Principles of Software Development',
    'DSCI 351 Foundations of Data Management',
    'MATH 208x Introduction to Statistics',
  ],
  'university of california, los angeles': [
    'MGMT 1A Financial Accounting',
    'MGMT 122A Intermediate Financial Accounting I',
    'MGMT 180 Introduction to Finance',
    'MGMT 120A Marketing Management',
    'MGMT 142B Operations Management',
    'COM SCI 31 Introduction to Computer Science I',
    'COM SCI 32 Introduction to Computer Science II',
    'COM SCI 180 Algorithms and Complexity',
    'STATS 20 Introduction to Statistical Programming',
    'STATS 100A Introduction to Probability',
  ],
  'university of california, berkeley': [
    'UGBA 10 Principles of Business',
    'UGBA 101A Microeconomic Analysis for Business Decisions',
    'UGBA 102A Financial Accounting',
    'UGBA 103 Introduction to Finance',
    'UGBA 104 Marketing',
    'DATA C8 Foundations of Data Science',
    'COMPSCI 61A Structure and Interpretation of Computer Programs',
    'COMPSCI 61B Data Structures',
    'COMPSCI 170 Efficient Algorithms and Intractable Problems',
    'STAT 20 Introduction to Probability and Statistics',
  ],
  'stanford university': [
    'ECON 1 Principles of Economics',
    'MS&E 111 Introduction to Optimization',
    'MS&E 120 Probabilistic Analysis',
    'CS 106A Programming Methodology',
    'CS 106B Programming Abstractions',
    'CS 161 Design and Analysis of Algorithms',
    'CS 229 Machine Learning',
    'STATS 116 Theory of Probability',
    'ENGR 108 Introduction to Matrix Methods',
    'GSBGEN 309 Financial Management',
  ],
  'arizona state university': [
    'ACC 231 Uses of Accounting Information I',
    'ACC 241 Uses of Accounting Information II',
    'FIN 300 Fundamentals of Finance',
    'MKT 300 Marketing and Society',
    'SCM 300 Global Supply Operations',
    'CIS 325 Business Data Communications',
    'CSE 205 Object-Oriented Programming and Data Structures',
    'CSE 310 Data Structures and Algorithms',
    'DAT 300 Data Science and Analytics',
    'STP 226 Elements of Statistics',
  ],
  'university of arizona': [
    'ACCT 200 Introduction to Financial Accounting',
    'ACCT 210 Introduction to Managerial Accounting',
    'FIN 360 Introduction to Finance',
    'MKTG 361 Introduction to Marketing',
    'MIS 304 Foundations of Information Systems',
    'MIS 331 Database Management',
    'CSC 210 Software Development',
    'CSC 345 Analysis of Discrete Structures',
    'ECON 200 Basic Economic Issues',
    'MATH 163 Statistics for Business and Economics',
  ],
  'university of washington': [
    'ACCTG 215 Introduction to Accounting and Financial Reporting',
    'ACCTG 225 Introduction to Managerial Accounting',
    'FIN 350 Business Finance',
    'MKTG 301 Marketing Concepts',
    'OPMGT 301 Operations Management',
    'INFO 340 Client-Side Development',
    'CSE 142 Computer Programming I',
    'CSE 373 Data Structures and Algorithms',
    'STAT 311 Elements of Statistical Methods',
    'Q SCI 381 Introduction to Mathematical Statistics',
  ],
  'oregon state university': [
    'BA 211 Financial Accounting',
    'BA 212 Managerial Accounting',
    'BA 315 Financial Management',
    'BA 302 Marketing Management',
    'BA 313 Operations Management',
    'CS 161 Intro to Computer Science I',
    'CS 162 Intro to Computer Science II',
    'CS 325 Analysis of Algorithms',
    'DS 300 Foundations of Data Science',
    'ST 351 Introduction to Statistical Methods',
  ],
  'university of colorado boulder': [
    'BCOR 2201 Financial Accounting',
    'BCOR 2202 Management Accounting and Decision Making',
    'FNCE 3010 Corporate Finance',
    'MKTG 3000 Marketing Management',
    'OPMG 3050 Operations Management',
    'CSCI 1300 Computer Science I',
    'CSCI 2270 Data Structures',
    'CSCI 3104 Algorithms',
    'STAT 3100 Applied Probability',
    'INFO 4601 Data Mining',
  ],
  'university of texas at austin': [
    'ACC 310F Foundations of Accounting',
    'FIN 357 Business Finance',
    'MKT 337 Principles of Marketing',
    'OM 235 Operations Management',
    'MIS 301 Introduction to Information Technology Management',
    'SDS 322E Elements of Data Science',
    'CS 312 Introduction to Programming',
    'CS 314 Data Structures',
    'CS 331 Algorithms and Complexity',
    'STA 235 Introductory Statistics for Business',
  ],
  'texas a&m university': [
    'ACCT 209 Survey of Accounting Principles',
    'FINC 341 Business Finance',
    'MKTG 321 Principles of Marketing',
    'SCMT 364 Operations and Supply Chain Management',
    'ISTM 209 Fundamentals of Information Systems',
    'STAT 211 Principles of Statistics',
    'CSCE 121 Introduction to Program Design and Concepts',
    'CSCE 221 Data Structures and Algorithms',
    'ECON 202 Principles of Economics',
    'MGMT 309 Survey of Management',
  ],
  'university of michigan': [
    'ACC 300 Financial Accounting',
    'ACC 312 Intermediate Financial Accounting',
    'FIN 302 Making Financial Decisions',
    'MKT 302 Marketing Management',
    'TO 301 Operations Management',
    'SI 330 Data Manipulation',
    'EECS 183 Elementary Programming Concepts',
    'EECS 281 Data Structures and Algorithms',
    'STATS 250 Introduction to Statistics and Data Analysis',
    'IOE 316 Engineering Statistics and Quality Control',
  ],
  'university of illinois urbana-champaign': [
    'ACCY 201 Accounting and Accountancy I',
    'ACCY 202 Accounting and Accountancy II',
    'FIN 221 Corporate Finance',
    'BADM 320 Principles of Marketing',
    'BADM 310 Management and Organizational Behavior',
    'CS 124 Intro to Computer Science I',
    'CS 128 Intro to Computer Science II',
    'CS 374 Introduction to Algorithms and Models of Computation',
    'STAT 107 Data Science Discovery',
    'IS 477 Data Management, Curation and Reproducibility',
  ],
  'new york university': [
    'ACCT-UB 1 Financial Accounting and Reporting',
    'ACCT-UB 3 Managerial Accounting',
    'FINC-UB 7 Corporate Finance',
    'MKTG-UB 1 Foundations of Marketing',
    'OPMG-UB 1 Operations Management',
    'INFO-UB 1 Information Technology in Business and Society',
    'CSCI-UA 2 Introduction to Computer Programming',
    'CSCI-UA 102 Data Structures',
    'STAT-UB 103 Statistics for Business Control and Regression Models',
    'DATA-UB 2 Data Analysis for Business',
  ],
  'university of florida': [
    'ACG 2021 Introduction to Financial Accounting',
    'ACG 2071 Introduction to Managerial Accounting',
    'FIN 3403 Business Finance',
    'MAR 3023 Principles of Marketing',
    'MAN 3504 Operations and Supply Chain Management',
    'ISM 3013 Introduction to Information Systems',
    'COP 3502 Programming Fundamentals I',
    'COP 3530 Data Structures and Algorithms',
    'STA 2023 Introduction to Statistics',
    'QMB 3250 Statistics for Business Decisions',
  ],
  'university of north carolina at chapel hill': [
    'BUSI 102 Financial Accounting',
    'BUSI 104 Managerial and Cost Accounting',
    'BUSI 408 Corporate Finance',
    'BUSI 406 Data Analytics',
    'BUSI 409 Operations Management',
    'BUSI 403 Introduction to Marketing',
    'COMP 110 Introduction to Programming and Data Science',
    'COMP 210 Data Structures and Analysis',
    'STOR 155 Introduction to Data Models and Inference',
    'ECON 101 Introduction to Economics',
  ],
}

function normalizeUniversityKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getUniversityCourseCatalog(universityName: string | null | undefined) {
  const key = normalizeUniversityKey(universityName ?? '')
  const generated = key
    ? GENERATED_COURSEWORK_BY_UNIVERSITY[Object.keys(GENERATED_COURSEWORK_BY_UNIVERSITY).find(
        (name) => normalizeUniversityKey(name) === key
      ) ?? ''] ?? []
    : []
  const manual = key
    ? MANUAL_COURSEWORK_BY_UNIVERSITY[Object.keys(MANUAL_COURSEWORK_BY_UNIVERSITY).find(
        (name) => normalizeUniversityKey(name) === key
      ) ?? ''] ?? []
    : []
  const scoped = key ? UNIVERSITY_COURSE_OVERRIDES[key] ?? [] : []
  return Array.from(new Set([...manual, ...generated, ...scoped, ...BASE_COURSEWORK]))
}

export function hasUniversitySpecificCourses(universityName: string | null | undefined) {
  const key = normalizeUniversityKey(universityName ?? '')
  const hasGenerated = Object.keys(GENERATED_COURSEWORK_BY_UNIVERSITY).some(
    (name) => normalizeUniversityKey(name) === key && (GENERATED_COURSEWORK_BY_UNIVERSITY[name]?.length ?? 0) > 0
  )
  const hasManual = Object.keys(MANUAL_COURSEWORK_BY_UNIVERSITY).some(
    (name) => normalizeUniversityKey(name) === key && (MANUAL_COURSEWORK_BY_UNIVERSITY[name]?.length ?? 0) > 0
  )
  return hasManual || hasGenerated || key in UNIVERSITY_COURSE_OVERRIDES
}
