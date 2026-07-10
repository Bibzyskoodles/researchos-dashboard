import React, { createContext, useContext } from 'react';
import { useAuth } from '../store/AuthContext';

export interface StudyType {
  id: string;
  label: string;
  respondent_label: string;
  respondent_plural: string;
  respondent_description: string;
  location_label: string;
  interview_label: string;
  duration_expectation_mins: { min: number; max: number };
  ada_focus: string;
  quality_signals: string[];
  fraud_signals: string[];
  typical_question_types: string[];
  sensitive_topics: string[];
  framework_label: string;
  framework_description: string;
  framework_examples: string[];
  report_sections: string[];
  stakeholder_label: string;
  kpi_examples: string[];
  ada_greeting: string;
  ada_analysis_focus: string;
  ada_warning_style: string;
}

export interface IndustryProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
  study_types: StudyType[];
  project_label: string;
  enumerator_label: string;
  enumerator_plural: string;
  platform_label: string;
  organisation_type: string;
}

const def = (overrides: Partial<StudyType>, base?: Partial<StudyType>): StudyType => ({
  id: '',
  label: '',
  respondent_label: 'Respondent',
  respondent_plural: 'Respondents',
  respondent_description: 'Person being interviewed',
  location_label: 'Location',
  interview_label: 'Interview',
  duration_expectation_mins: { min: 15, max: 30 },
  ada_focus: 'data quality and completeness',
  quality_signals: ['Valid GPS location', 'Appropriate duration', 'All required fields completed'],
  fraud_signals: ['GPS at home location', 'Duration under minimum', 'Recycled responses'],
  typical_question_types: ['Multiple choice', 'Likert scale', 'Open text'],
  sensitive_topics: [],
  framework_label: 'Research Framework',
  framework_description: 'Upload your research framework to align analysis to your objectives.',
  framework_examples: ['Research brief', 'Objectives document'],
  report_sections: ['Executive Summary', 'Key Findings', 'Recommendations'],
  stakeholder_label: 'Client',
  kpi_examples: ['Response rate', 'Data quality score', 'Coverage'],
  ada_greeting: "I've reviewed your field data. Here's your summary.",
  ada_analysis_focus: 'data quality and key themes',
  ada_warning_style: 'data quality concern',
  ...base,
  ...overrides,
});

export const INDUSTRY_PROFILES: IndustryProfile[] = [
  {
    id: 'fmcg',
    name: 'Consumer Goods / FMCG',
    icon: '🏪',
    description: 'Retail audits, mystery shopping, and consumer research for brands',
    project_label: 'Campaign',
    enumerator_label: 'Field Rep',
    enumerator_plural: 'Field Reps',
    platform_label: 'Field Platform',
    organisation_type: 'Brand / Manufacturer',
    study_types: [
      def({
        id: 'retail_audit',
        label: 'Retail Audit',
        respondent_label: 'Store Manager',
        respondent_plural: 'Store Managers',
        respondent_description: 'Manager of a retail outlet being audited',
        interview_label: 'Store Visit',
        location_label: 'Store',
        duration_expectation_mins: { min: 15, max: 25 },
        fraud_signals: [
          'GPS at field rep\'s home not a store',
          'Recycled photo from previous audit',
          'Duration under 8 minutes',
          'Same photo submitted for multiple stores',
        ],
        quality_signals: [
          'GPS within 100m of registered store location',
          'Photo clearly shows actual shelf/product',
          'Duration 15-25 minutes',
          'Store name matches GPS location',
        ],
        framework_label: 'Brand KPI Matrix / Planogram',
        framework_description: 'Upload your planogram or brand KPI matrix to align audits to specific distribution and compliance targets.',
        framework_examples: ['Planogram PDF', 'Brand KPI Matrix', 'Distribution list'],
        kpi_examples: ['SKU availability %', 'Shelf compliance %', 'Price compliance %', 'Share of shelf', 'Out of stock rate'],
        ada_greeting: "I've reviewed your retail audit data. Here's your compliance picture.",
        ada_warning_style: 'compliance issue flagged',
        ada_analysis_focus: 'shelf compliance, SKU availability, and pricing',
        ada_focus: 'shelf compliance and store-level KPIs',
        report_sections: ['Executive Summary', 'Coverage & Reach', 'SKU Availability', 'Shelf Compliance', 'Pricing Analysis', 'Visibility & Display', 'Store Rankings', 'Regional Breakdown', 'Recommendations'],
        stakeholder_label: 'Brand Manager',
        typical_question_types: ['Availability check', 'Photo capture', 'Price recording', 'Shelf count'],
      }),
      def({
        id: 'customer_exit_interview',
        label: 'Customer Exit Interview',
        respondent_label: 'Shopper',
        respondent_plural: 'Shoppers',
        respondent_description: 'Customer exiting a store after purchase',
        interview_label: 'Exit Interview',
        location_label: 'Store Exit',
        duration_expectation_mins: { min: 5, max: 12 },
        stakeholder_label: 'Category Manager',
        framework_label: 'Brand Tracker',
        ada_greeting: "I've reviewed your shopper exit data. Here's what customers are saying.",
        framework_description: 'Upload your brand tracker framework to measure awareness and purchase drivers.',
        kpi_examples: ['Purchase intent', 'Brand awareness', 'Satisfaction score', 'NPS'],
        report_sections: ['Executive Summary', 'Shopper Profile', 'Purchase Drivers', 'Brand Perceptions', 'Recommendations'],
      }),
      def({
        id: 'mystery_shopping',
        label: 'Mystery Shopping',
        respondent_label: 'Store',
        respondent_plural: 'Stores',
        respondent_description: 'Retail outlet being evaluated by an undercover shopper',
        interview_label: 'Mystery Shop',
        location_label: 'Store',
        duration_expectation_mins: { min: 20, max: 40 },
        stakeholder_label: 'Regional Manager',
        framework_label: 'Service Standards Checklist',
        ada_greeting: "I've reviewed your mystery shopping results. Here's the service picture.",
        kpi_examples: ['Service score', 'Product knowledge score', 'Compliance rate', 'Staff friendliness'],
        report_sections: ['Executive Summary', 'Overall Performance', 'Service Standards', 'Regional Breakdown', 'Best & Worst Performers', 'Recommendations'],
      }),
      def({
        id: 'distributor_visit',
        label: 'Distributor Visit',
        respondent_label: 'Distributor',
        respondent_plural: 'Distributors',
        respondent_description: 'Distribution partner being assessed',
        interview_label: 'Distributor Visit',
        location_label: 'Distributor Depot',
        duration_expectation_mins: { min: 20, max: 35 },
        stakeholder_label: 'Trade Marketing Manager',
        framework_label: 'Distributor Scorecard',
        ada_greeting: "I've reviewed your distributor visit data. Here's the channel picture.",
        kpi_examples: ['Stock coverage (days)', 'Order fill rate', 'Delivery compliance', 'Invoice accuracy'],
        report_sections: ['Executive Summary', 'Distributor Performance', 'Stock Levels', 'Coverage Analysis', 'Recommendations'],
      }),
      def({
        id: 'consumer_ua',
        label: 'Consumer Usage & Attitudes',
        respondent_label: 'Consumer',
        respondent_plural: 'Consumers',
        respondent_description: 'Consumer participating in a usage and attitudes study',
        interview_label: 'Interview',
        location_label: 'Home / Location',
        duration_expectation_mins: { min: 30, max: 60 },
        stakeholder_label: 'Brand Manager',
        framework_label: 'U&A Framework',
        ada_greeting: "I've reviewed your consumer insights data. Here's what the data reveals.",
        kpi_examples: ['Category penetration', 'Brand usage rate', 'Frequency of use', 'Satisfaction score'],
        report_sections: ['Executive Summary', 'Consumer Profile', 'Category Usage', 'Brand Performance', 'Attitudes & Perceptions', 'Opportunities', 'Recommendations'],
      }),
    ],
  },

  {
    id: 'ngo',
    name: 'NGO / Development Sector',
    icon: '🌍',
    description: 'Beneficiary assessments, programme monitoring, and impact evaluation',
    project_label: 'Programme',
    enumerator_label: 'Field Officer',
    enumerator_plural: 'Field Officers',
    platform_label: 'ODK / KoboToolbox',
    organisation_type: 'NGO / INGO',
    study_types: [
      def({
        id: 'beneficiary_interview',
        label: 'Beneficiary Interview',
        respondent_label: 'Beneficiary',
        respondent_plural: 'Beneficiaries',
        respondent_description: 'Programme beneficiary providing feedback on services received',
        interview_label: 'Beneficiary Interview',
        location_label: 'Community / Field Site',
        duration_expectation_mins: { min: 20, max: 45 },
        sensitive_topics: ['income', 'domestic situation', 'health status', 'displacement', 'protection issues', 'gender-based violence'],
        framework_label: 'Logframe / Theory of Change',
        framework_description: 'Upload your logframe or Theory of Change to map beneficiary responses to specific MEAL indicators',
        framework_examples: ['Logframe', 'Theory of Change', 'Results Framework', 'M&E Plan'],
        kpi_examples: ['% beneficiaries reached', '% achieving outcome targets', 'Beneficiary satisfaction score', 'MEAL compliance %'],
        ada_greeting: "I've reviewed your field data. Here's what matters for your programme outcomes.",
        ada_warning_style: 'data quality concern for MEAL reporting',
        ada_analysis_focus: 'programme outcomes, beneficiary wellbeing, and MEAL indicators',
        report_sections: ['Executive Summary', 'Programme Context', 'Beneficiary Profile', 'Key Findings by Outcome', 'Beneficiary Voices', 'Barriers & Enablers', 'Risks & Mitigation', 'Recommendations'],
        stakeholder_label: 'Donor',
        typical_question_types: ['Outcome indicator', 'Likert scale', 'Open text', 'Observation'],
      }),
      def({
        id: 'kii',
        label: 'Key Informant Interview (KII)',
        respondent_label: 'Key Informant',
        respondent_plural: 'Key Informants',
        respondent_description: 'Expert or community leader providing contextual insight',
        interview_label: 'KII',
        location_label: 'Office / Community',
        duration_expectation_mins: { min: 45, max: 90 },
        stakeholder_label: 'Programme Manager',
        framework_label: 'Interview Guide',
        ada_greeting: "I've reviewed your KII data. Here are the key themes from informants.",
        kpi_examples: ['Themes coverage', 'Informant diversity', 'Data saturation indicators'],
        report_sections: ['Executive Summary', 'Informant Profile', 'Key Themes', 'Divergent Views', 'Recommendations'],
      }),
      def({
        id: 'fgd',
        label: 'Focus Group Discussion (FGD)',
        respondent_label: 'Participant',
        respondent_plural: 'Participants',
        respondent_description: 'Community member participating in a facilitated group discussion',
        interview_label: 'FGD',
        location_label: 'Community Space',
        duration_expectation_mins: { min: 60, max: 120 },
        stakeholder_label: 'Programme Manager',
        framework_label: 'Discussion Guide',
        ada_greeting: "I've reviewed your FGD data. Here's what community voices are telling us.",
        kpi_examples: ['Themes coverage', 'Group diversity', 'Consensus indicators'],
        report_sections: ['Executive Summary', 'Participant Profile', 'Discussion Themes', 'Community Perspectives', 'Recommendations'],
      }),
      def({
        id: 'facility_assessment',
        label: 'Facility Assessment',
        respondent_label: 'Facility',
        respondent_plural: 'Facilities',
        respondent_description: 'Service delivery facility being assessed against standards',
        interview_label: 'Assessment',
        location_label: 'Facility',
        duration_expectation_mins: { min: 30, max: 60 },
        stakeholder_label: 'Donor',
        framework_label: 'Minimum Standards Checklist',
        ada_greeting: "I've reviewed your facility assessment data. Here's the service delivery picture.",
        kpi_examples: ['Facility compliance rate', 'Standards met %', 'Critical gaps'],
        report_sections: ['Executive Summary', 'Facility Profile', 'Standards Compliance', 'Critical Gaps', 'Recommendations'],
      }),
      def({
        id: 'household_survey',
        label: 'Household Survey',
        respondent_label: 'Household',
        respondent_plural: 'Households',
        respondent_description: 'Household head or representative responding to a structured survey',
        interview_label: 'Survey',
        location_label: 'Household',
        duration_expectation_mins: { min: 25, max: 50 },
        stakeholder_label: 'Donor',
        framework_label: 'Survey Framework / Indicators',
        ada_greeting: "I've reviewed your household survey data. Here are the key findings.",
        kpi_examples: ['Household coverage %', 'Data completeness %', 'Indicator achievement %'],
        report_sections: ['Executive Summary', 'Household Profile', 'Key Indicators', 'Geographic Analysis', 'Recommendations'],
      }),
    ],
  },

  {
    id: 'research_agency',
    name: 'Research Agency',
    icon: '📊',
    description: 'Multi-client quantitative and qualitative research across sectors',
    project_label: 'Study',
    enumerator_label: 'Interviewer',
    enumerator_plural: 'Interviewers',
    platform_label: 'Research Platform',
    organisation_type: 'Research Agency',
    study_types: [
      def({
        id: 'quantitative_survey',
        label: 'Quantitative Survey',
        respondent_label: 'Respondent',
        respondent_plural: 'Respondents',
        respondent_description: 'Individual completing a structured quantitative questionnaire',
        interview_label: 'Interview',
        location_label: 'Interview Location',
        duration_expectation_mins: { min: 15, max: 45 },
        framework_label: 'Research Brief / Client Objectives',
        framework_description: 'Upload your research brief or client objectives to align analysis and reporting.',
        framework_examples: ['Research brief', 'Client objectives', 'Questionnaire specification'],
        kpi_examples: ['Completion rate', 'Data quality score', 'Incidence rate', 'Average LOI'],
        ada_greeting: "I've reviewed your fieldwork quality data. Here's your data quality summary.",
        ada_analysis_focus: 'data quality, respondent consistency, and fieldwork compliance',
        stakeholder_label: 'Client',
        typical_question_types: ['Single choice', 'Multiple choice', 'Likert scale', 'Open text', 'Grid'],
        report_sections: ['Executive Summary', 'Data Quality Overview', 'Fieldwork Summary', 'Key Findings', 'Appendix'],
      }),
      def({
        id: 'idi',
        label: 'In-Depth Interview (IDI)',
        respondent_label: 'Respondent',
        respondent_plural: 'Respondents',
        respondent_description: 'Individual participating in a qualitative in-depth interview',
        interview_label: 'In-Depth Interview',
        location_label: 'Interview Location',
        duration_expectation_mins: { min: 45, max: 90 },
        stakeholder_label: 'Client',
        framework_label: 'Discussion Guide',
        ada_greeting: "I've reviewed your IDI fieldwork. Here's what the verbatims reveal.",
        ada_analysis_focus: 'qualitative themes, sentiment, and client objectives',
        kpi_examples: ['Completion rate', 'Average duration', 'Theme saturation', 'Client objectives met'],
        report_sections: ['Executive Summary', 'Respondent Profile', 'Key Themes', 'Verbatim Highlights', 'Client Implications', 'Recommendations'],
      }),
      def({
        id: 'focus_group',
        label: 'Focus Group',
        respondent_label: 'Participant',
        respondent_plural: 'Participants',
        respondent_description: 'Individual participating in a moderated focus group discussion',
        interview_label: 'Focus Group',
        location_label: 'Focus Group Venue',
        duration_expectation_mins: { min: 60, max: 120 },
        stakeholder_label: 'Client',
        framework_label: 'Discussion Guide',
        ada_greeting: "I've reviewed your focus group data. Here are the key themes.",
        ada_analysis_focus: 'group dynamics, emergent themes, and client hypotheses',
        kpi_examples: ['Group completion', 'Participant diversity', 'Theme coverage', 'Client objectives met'],
        report_sections: ['Executive Summary', 'Group Profile', 'Key Themes', 'Group Dynamics', 'Client Implications', 'Recommendations'],
      }),
    ],
  },

  {
    id: 'government',
    name: 'Government / Public Sector',
    icon: '🏛',
    description: 'Citizen satisfaction surveys, facility inspections, and service monitoring',
    project_label: 'Survey',
    enumerator_label: 'Assessor',
    enumerator_plural: 'Assessors',
    platform_label: 'Government Platform',
    organisation_type: 'Government Agency',
    study_types: [
      def({
        id: 'citizen_satisfaction',
        label: 'Citizen Satisfaction Survey',
        respondent_label: 'Citizen',
        respondent_plural: 'Citizens',
        respondent_description: 'Citizen providing feedback on government services',
        interview_label: 'Survey',
        location_label: 'Service Point',
        duration_expectation_mins: { min: 10, max: 20 },
        stakeholder_label: 'Ministry',
        framework_label: 'Service Charter',
        ada_greeting: "I've reviewed your citizen satisfaction data. Here's the service picture.",
        kpi_examples: ['Overall satisfaction %', 'NPS', 'Service quality score', 'Complaint rate'],
        report_sections: ['Executive Summary', 'Citizen Profile', 'Satisfaction Scores', 'Service Quality', 'Complaints Analysis', 'Recommendations'],
      }),
      def({
        id: 'facility_inspection',
        label: 'Facility Inspection',
        respondent_label: 'Facility',
        respondent_plural: 'Facilities',
        respondent_description: 'Public facility being inspected against regulatory standards',
        interview_label: 'Inspection',
        location_label: 'Facility',
        duration_expectation_mins: { min: 30, max: 60 },
        stakeholder_label: 'Director',
        framework_label: 'Regulatory Standards Checklist',
        ada_greeting: "I've reviewed your facility inspection data. Here's the compliance picture.",
        kpi_examples: ['Compliance rate', 'Standards met %', 'Critical violations', 'Corrective actions needed'],
        report_sections: ['Executive Summary', 'Facility Profile', 'Compliance Results', 'Critical Violations', 'Corrective Actions', 'Recommendations'],
      }),
      def({
        id: 'service_exit',
        label: 'Service Exit Survey',
        respondent_label: 'Service User',
        respondent_plural: 'Service Users',
        respondent_description: 'Citizen exiting a government service point',
        interview_label: 'Exit Interview',
        location_label: 'Service Exit',
        duration_expectation_mins: { min: 5, max: 15 },
        stakeholder_label: 'Ministry',
        framework_label: 'Service Standards Framework',
        ada_greeting: "I've reviewed your service exit survey data. Here's the user feedback picture.",
        kpi_examples: ['Wait time satisfaction', 'Staff courtesy score', 'Resolution rate', 'Overall satisfaction'],
        report_sections: ['Executive Summary', 'User Profile', 'Service Experience', 'Wait Times', 'Staff Performance', 'Recommendations'],
      }),
    ],
  },

  {
    id: 'health',
    name: 'Health / Pharmaceutical',
    icon: '🏥',
    description: 'Patient surveys, facility assessments, and community health studies',
    project_label: 'Study',
    enumerator_label: 'Data Collector',
    enumerator_plural: 'Data Collectors',
    platform_label: 'Health Platform',
    organisation_type: 'Health Organisation',
    study_types: [
      def({
        id: 'patient_interview',
        label: 'Patient Interview',
        respondent_label: 'Patient',
        respondent_plural: 'Patients',
        respondent_description: 'Patient providing feedback on healthcare services',
        interview_label: 'Patient Interview',
        location_label: 'Health Facility',
        duration_expectation_mins: { min: 15, max: 30 },
        sensitive_topics: ['diagnosis', 'treatment details', 'medication', 'mental health'],
        stakeholder_label: 'Clinical Lead',
        framework_label: 'Clinical Framework',
        ada_greeting: "I've reviewed your patient interview data. Here's the care experience picture.",
        kpi_examples: ['Patient satisfaction', 'Care quality score', 'NPS', 'Waiting time satisfaction'],
        report_sections: ['Executive Summary', 'Patient Profile', 'Care Experience', 'Satisfaction Scores', 'Clinical Feedback', 'Recommendations'],
      }),
      def({
        id: 'health_facility_assessment',
        label: 'Health Facility Assessment',
        respondent_label: 'Facility',
        respondent_plural: 'Facilities',
        respondent_description: 'Health facility being assessed against clinical standards',
        interview_label: 'Assessment',
        location_label: 'Health Facility',
        duration_expectation_mins: { min: 30, max: 60 },
        stakeholder_label: 'Programme Lead',
        framework_label: 'Health Standards Checklist',
        ada_greeting: "I've reviewed your facility assessment data. Here's the clinical picture.",
        kpi_examples: ['Standards compliance %', 'Essential medicines availability', 'Staff qualification rate', 'Infrastructure score'],
        report_sections: ['Executive Summary', 'Facility Profile', 'Clinical Standards', 'Infrastructure', 'Staffing', 'Recommendations'],
      }),
      def({
        id: 'community_health_survey',
        label: 'Community Health Survey',
        respondent_label: 'Community Member',
        respondent_plural: 'Community Members',
        respondent_description: 'Community member participating in a health survey',
        interview_label: 'Survey',
        location_label: 'Community',
        duration_expectation_mins: { min: 15, max: 30 },
        sensitive_topics: ['health conditions', 'sexual health', 'mental health', 'substance use'],
        stakeholder_label: 'Programme Lead',
        framework_label: 'Health Indicators Framework',
        ada_greeting: "I've reviewed your community health data. Here are the key health indicators.",
        kpi_examples: ['Prevalence rates', 'Coverage indicators', 'Health seeking behaviour %', 'Awareness rates'],
        report_sections: ['Executive Summary', 'Community Profile', 'Health Indicators', 'Service Access', 'Behaviours & Knowledge', 'Recommendations'],
      }),
    ],
  },

  {
    id: 'education',
    name: 'Education',
    icon: '📚',
    description: 'Student assessments, teacher interviews, and school evaluations',
    project_label: 'Assessment',
    enumerator_label: 'Assessor',
    enumerator_plural: 'Assessors',
    platform_label: 'Assessment Platform',
    organisation_type: 'Education Organisation',
    study_types: [
      def({
        id: 'student_assessment',
        label: 'Student Assessment',
        respondent_label: 'Student',
        respondent_plural: 'Students',
        respondent_description: 'Student being assessed on learning outcomes',
        interview_label: 'Assessment',
        location_label: 'School',
        duration_expectation_mins: { min: 30, max: 60 },
        stakeholder_label: 'Head Teacher',
        framework_label: 'Curriculum Standards',
        ada_greeting: "I've reviewed your student assessment data. Here are the learning outcomes.",
        kpi_examples: ['Literacy rate', 'Numeracy rate', 'Attendance rate', 'Grade-level proficiency %'],
        report_sections: ['Executive Summary', 'Student Profile', 'Learning Outcomes', 'Subject Performance', 'Gender Analysis', 'Recommendations'],
      }),
      def({
        id: 'teacher_interview',
        label: 'Teacher Interview',
        respondent_label: 'Teacher',
        respondent_plural: 'Teachers',
        respondent_description: 'Teacher providing feedback on school environment and resources',
        interview_label: 'Interview',
        location_label: 'School',
        duration_expectation_mins: { min: 20, max: 40 },
        stakeholder_label: 'Head Teacher',
        framework_label: 'Teacher Standards Framework',
        ada_greeting: "I've reviewed your teacher interview data. Here's the teaching environment picture.",
        kpi_examples: ['Teacher satisfaction', 'Resource adequacy score', 'Professional development access %', 'Attendance rate'],
        report_sections: ['Executive Summary', 'Teacher Profile', 'Teaching Environment', 'Resources & Support', 'Challenges', 'Recommendations'],
      }),
      def({
        id: 'school_assessment',
        label: 'School Assessment',
        respondent_label: 'School',
        respondent_plural: 'Schools',
        respondent_description: 'School being assessed against educational standards',
        interview_label: 'Assessment',
        location_label: 'School',
        duration_expectation_mins: { min: 45, max: 90 },
        stakeholder_label: 'Education Officer',
        framework_label: 'School Standards Checklist',
        ada_greeting: "I've reviewed your school assessment data. Here's the school performance picture.",
        kpi_examples: ['Standards compliance %', 'Infrastructure score', 'Teacher:student ratio', 'Resource availability %'],
        report_sections: ['Executive Summary', 'School Profile', 'Standards Compliance', 'Infrastructure', 'Teaching Resources', 'Recommendations'],
      }),
    ],
  },

  {
    id: 'consultancy',
    name: 'Consultancy',
    icon: '💼',
    description: 'Stakeholder interviews, organisational assessments, and advisory research',
    project_label: 'Engagement',
    enumerator_label: 'Consultant',
    enumerator_plural: 'Consultants',
    platform_label: 'Research Platform',
    organisation_type: 'Consultancy Firm',
    study_types: [
      def({
        id: 'stakeholder_interview',
        label: 'Stakeholder Interview',
        respondent_label: 'Stakeholder',
        respondent_plural: 'Stakeholders',
        respondent_description: 'Senior stakeholder providing strategic or operational insights',
        interview_label: 'Stakeholder Interview',
        location_label: 'Office / Virtual',
        duration_expectation_mins: { min: 45, max: 90 },
        stakeholder_label: 'Client',
        framework_label: 'Engagement Framework',
        framework_description: 'Upload your engagement framework, scope of work, or terms of reference to align interviews to deliverables.',
        framework_examples: ['Terms of Reference', 'Scope of Work', 'Interview Guide'],
        ada_greeting: "I've reviewed your stakeholder interview data. Here are the key insights.",
        kpi_examples: ['Stakeholder coverage %', 'Theme saturation', 'Divergent views identified', 'Client deliverables met'],
        report_sections: ['Executive Summary', 'Stakeholder Profile', 'Key Themes', 'Strategic Implications', 'Recommendations'],
      }),
      def({
        id: 'org_assessment',
        label: 'Organisational Assessment',
        respondent_label: 'Organisation',
        respondent_plural: 'Organisations',
        respondent_description: 'Organisation being assessed against a framework or standards',
        interview_label: 'Assessment',
        location_label: 'Organisation Site',
        duration_expectation_mins: { min: 60, max: 120 },
        stakeholder_label: 'Client',
        framework_label: 'Assessment Framework',
        framework_description: 'Upload your assessment framework to map findings to specific capability or performance dimensions.',
        framework_examples: ['Capability Framework', 'Maturity Model', 'Assessment Rubric'],
        ada_greeting: "I've reviewed your organisational assessment data. Here's the capability picture.",
        kpi_examples: ['Overall capability score', 'Dimension scores', 'Maturity level', 'Gap analysis'],
        report_sections: ['Executive Summary', 'Organisation Profile', 'Capability Assessment', 'Maturity Analysis', 'Gap Analysis', 'Recommendations'],
      }),
    ],
  },
];

export function getIndustry(id?: string | null): IndustryProfile {
  return INDUSTRY_PROFILES.find(i => i.id === id) || INDUSTRY_PROFILES.find(i => i.id === 'research_agency')!;
}

export function getStudyType(industry: IndustryProfile, studyTypeId?: string | null): StudyType {
  return industry.study_types.find(s => s.id === studyTypeId) || industry.study_types[0];
}

interface ResearchContextLabels {
  submission: string;
  submissions: string;
  respondent: string;
  respondents: string;
  enumerator: string;
  enumerators: string;
  project: string;
  location: string;
  stakeholder: string;
  report: string;
  interview: string;
}

interface ResearchContextValue {
  industry: IndustryProfile;
  studyType: StudyType;
  labels: ResearchContextLabels;
  isResearchAgency: boolean;
}

const ResearchCtx = createContext<ResearchContextValue | null>(null);

export function ResearchProvider({
  children,
  activeStudyTypeId,
}: {
  children: React.ReactNode;
  activeStudyTypeId?: string | null;
}) {
  const { org } = useAuth();
  const orgIndustryId = (org as any)?.industry_id;
  const orgDefaultStudyTypeId = (org as any)?.default_study_type_id;

  const industry = getIndustry(orgIndustryId);
  const studyTypeId = activeStudyTypeId || orgDefaultStudyTypeId || industry.study_types[0]?.id;
  const studyType = getStudyType(industry, studyTypeId);

  const labels: ResearchContextLabels = {
    submission: studyType.interview_label,
    submissions: studyType.interview_label + 's',
    respondent: studyType.respondent_label,
    respondents: studyType.respondent_plural,
    enumerator: industry.enumerator_label,
    enumerators: industry.enumerator_plural,
    project: industry.project_label,
    location: studyType.location_label,
    stakeholder: studyType.stakeholder_label,
    report: 'Report',
    interview: studyType.interview_label,
  };

  return (
    <ResearchCtx.Provider value={{
      industry,
      studyType,
      labels,
      isResearchAgency: industry.id === 'research_agency',
    }}>
      {children}
    </ResearchCtx.Provider>
  );
}

export function useResearchContext(): ResearchContextValue {
  const ctx = useContext(ResearchCtx);
  if (!ctx) {
    // Return defaults when used outside provider
    const industry = getIndustry('research_agency');
    const studyType = industry.study_types[0];
    return {
      industry,
      studyType,
      labels: {
        submission: 'Interview',
        submissions: 'Interviews',
        respondent: 'Respondent',
        respondents: 'Respondents',
        enumerator: 'Interviewer',
        enumerators: 'Interviewers',
        project: 'Study',
        location: 'Location',
        stakeholder: 'Client',
        report: 'Report',
        interview: 'Interview',
      },
      isResearchAgency: true,
    };
  }
  return ctx;
}
