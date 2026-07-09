# Multi-Source Response Analytics

## Overview

The multi-source analytics system provides comprehensive response analytics that account for multiple data collection sources (FieldScore Direct and KoboToolbox). It enables detailed analysis of response patterns, completion rates, device usage, and drop-off analysis across sources.

## Features

### 1. **Source-Aware Analytics**
- Counts responses by source (FieldScore Direct, KoboToolbox)
- Calculates separate completion rates per source
- Compares metrics across sources
- Provides source distribution visualization

### 2. **Device Tracking**
- Tracks device split across sources
- Identifies primary device types (mobile, web, tablet)
- Device-specific recommendations based on usage patterns
- Analyzes device adoption by source

### 3. **Per-Question Analytics**
- Question-level metrics by source
- Answer distribution tracking
- Skip rate analysis
- Rating calculations for Likert-scale questions
- Device breakdown for each question

### 4. **Drop-Off Analysis**
- Identifies where respondents abandon questionnaires
- Calculates drop-off rates between consecutive questions
- Per-source drop-off breakdown
- Helps identify problematic questions

### 5. **Completion Time Analysis**
- Average completion time by source
- Median completion time tracking
- Time-based recommendations (mobile vs web collection method)
- Identifies slow vs. fast collection channels

### 6. **Response Timeline**
- Daily response counts
- First and last response timestamps
- Response rate trends over time
- Helps identify collection patterns

## Architecture

### Backend Components

#### `multi_source_analytics.py`
Core analytics calculation engine with the following classes:

**AnalyticsCalculator**
- Main class for building analytics reports
- Accepts responses from multiple sources
- Calculates all metrics

```python
calculator = AnalyticsCalculator()

# Add responses
calculator.add_response(
    response_id="resp_123",
    source="fieldscore_direct",
    device_type="mobile",
    answers={"q1": "Yes", "q2": 5},
    completion_time_seconds=180,
    timestamp="2026-07-09T10:30:00Z",
    is_completed=True
)

# Generate report
report = calculator.generate_report(questionnaire_id="quest_123")
```

**Data Classes**
- `SourceMetrics`: Per-source statistics
- `QuestionMetrics`: Per-question analysis
- `DropOffAnalysis`: Drop-off analysis per question
- `SourceDistribution`: Overall source distribution
- `AnalyticsReport`: Complete analytics report

#### `analytics_endpoints.py`
Flask blueprint providing REST API endpoints:

**Available Endpoints**

1. **GET /api/questionnaires/{id}/analytics**
   - Main analytics endpoint
   - Query params: `group_by=source`
   - Returns complete analytics report with per-source breakdown

2. **GET /api/questionnaires/{id}/analytics/summary**
   - Quick summary statistics
   - Returns key metrics by source
   - Lightweight endpoint for dashboards

3. **GET /api/questionnaires/{id}/analytics/sources**
   - Detailed source metrics
   - Device distribution per source
   - Completion rates and timing
   - Device recommendations

4. **GET /api/questionnaires/{id}/analytics/drop-off**
   - Drop-off analysis across questions
   - Per-source drop-off breakdown
   - Identifies question-level issues

5. **GET /api/questionnaires/{id}/analytics/questions**
   - Per-question analytics
   - Query param: `source` (optional)
   - Answer distribution, skip rates, ratings

6. **GET /api/analytics/health**
   - Health check endpoint
   - Verifies analytics service availability

### Frontend Components

#### Analytics Components (`src/components/analytics/`)

**AnalyticsDashboard**
Main dashboard component that:
- Fetches analytics data from API
- Displays comprehensive metrics
- Shows charts and visualizations
- Integrates source filtering

```tsx
import { AnalyticsDashboard } from './components/analytics';

<AnalyticsDashboard
  questionnaireId="quest_123"
  onDataLoad={(data) => console.log('Analytics loaded', data)}
/>
```

**SourceSegmentControl**
Segment control for filtering by source:
- "All sources" - combined analytics
- "FieldScore only" - FieldScore Direct metrics
- "KoboTools only" - KoboToolbox metrics
- Disables unavailable sources

**SourceDistributionBadge**
Visual badge showing:
- Source distribution percentages
- Response counts per source
- Color-coded by source type

#### Analytics Hook (`src/hooks/useAnalytics.ts`)

Custom hook for analytics data fetching:

```tsx
import { useAnalytics } from '../hooks/useAnalytics';

function MyComponent() {
  const { data, summary, loading, error, refetch } = useAnalytics('quest_123');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>Total responses: {data?.total_responses}</div>;
}
```

## API Integration

### Setting Up Analytics Endpoints

1. Import the blueprint in your Flask app:
```python
from analytics_endpoints import analytics_bp

app.register_blueprint(analytics_bp)
```

2. Ensure models are available:
```python
from models import Response, Question, Questionnaire
```

Required model attributes:
- `Response`: id, questionnaire_id, source, device_type, answers, completion_time_seconds, submitted_at, is_completed, user_agent
- `Question`: id, questionnaire_id, text
- `Questionnaire`: id, organization_id, title

### Authentication

All endpoints require JWT authentication:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.example.com/api/questionnaires/quest_123/analytics
```

### Response Format

All successful responses follow this format:
```json
{
  "status": "success",
  "questionnaire_id": "quest_123",
  "analytics": {
    "questionnaire_id": "quest_123",
    "generated_at": "2026-07-09T10:30:00Z",
    "total_responses": 150,
    "source_distribution": {
      "total_responses": 150,
      "source_counts": {
        "fieldscore_direct": 100,
        "kobotools": 50
      },
      "source_percentages": {
        "fieldscore_direct": 66.67,
        "kobotools": 33.33
      }
    },
    "source_metrics": { ... },
    "completion_rate_by_source": { ... },
    "avg_time_by_source": { ... }
  }
}
```

## Usage Examples

### React Component

```tsx
import { AnalyticsDashboard } from './components/analytics';

export function QuestionnaireAnalyticsPage() {
  const { id } = useParams();

  return (
    <div>
      <h1>Questionnaire Analytics</h1>
      <AnalyticsDashboard questionnaireId={id} />
    </div>
  );
}
```

### Using the Hook

```tsx
import { useAnalytics } from '../hooks/useAnalytics';

export function AnalyticsSummary({ questionnaireId }) {
  const { data, loading } = useAnalytics(questionnaireId);

  if (loading) return <Loading />;

  return (
    <div>
      <h3>Source Distribution</h3>
      <p>FieldScore: {data?.source_distribution.source_percentages.fieldscore_direct}%</p>
      <p>KoboTools: {data?.source_distribution.source_percentages.kobotools}%</p>
    </div>
  );
}
```

### Python Usage

```python
from multi_source_analytics import AnalyticsCalculator, serialize_report

# Create calculator
calc = AnalyticsCalculator()

# Add question mappings
calc.add_question_mapping("q1", "What is your name?")

# Add responses from database
for response in database.responses:
    calc.add_response(
        response_id=response.id,
        source=response.source,
        device_type=response.device_type,
        answers=response.parsed_answers,
        completion_time_seconds=response.completion_time,
        timestamp=response.submitted_at.isoformat(),
        is_completed=response.is_completed
    )

# Generate report
report = calc.generate_report(questionnaire_id)

# Serialize for JSON
report_dict = serialize_report(report)
```

## Data Source Integration

### FieldScore Direct

Source key: `fieldscore_direct`

Typical flow:
1. Mobile app submits response
2. Device type detected from user agent: usually "mobile"
3. Completion time tracked from form start to submission
4. Answers stored in database

### KoboToolbox

Source key: `kobotools`

Typical flow:
1. Web form or mobile app submission
2. Device type may vary (web > mobile > tablet)
3. Completion time calculated from timestamps
4. Answers imported from KoboToolbox API

## Metrics Explained

### Completion Rate
Percentage of responses marked as complete:
```
completion_rate = completed_responses / total_responses * 100
```

### Skip Rate
Percentage of respondents who didn't answer a question:
```
skip_rate = skip_count / total_responses * 100
```

### Drop-Off Rate
Percentage of respondents who didn't proceed to the next question:
```
drop_off_rate = (responses_at_q - responses_at_next_q) / responses_at_q * 100
```

### Device Distribution
Count and percentage of responses by device type:
- Mobile: phones (iOS, Android)
- Web: desktop browsers
- Tablet: iPad, Android tablets
- Unknown: cannot be determined

## Recommendations

The system generates automatic recommendations based on:

### Device Recommendations

**FieldScore Direct** with >70% mobile usage:
- "Mobile-first approach is effective for direct collection"

**KoboToolbox** with >50% mobile usage:
- "Strong mobile adoption in KoboToolbox deployments"

**Web-heavy** deployment (>50%):
- "Web-based access is preferred; ensure responsive design"

## Performance Considerations

### Optimization Tips

1. **Large Datasets**: For questionnaires with 10,000+ responses
   - Use source filtering (`source` query param) to reduce calculations
   - Cache reports if analytics don't change frequently
   - Consider pagination for question-level metrics

2. **Real-Time Analytics**: For continuous data collection
   - Use summary endpoint for quick updates
   - Refetch every 30-60 seconds for live dashboards
   - Cache at application level

3. **Database Queries**
   - Index on: `questionnaire_id`, `source`, `is_completed`
   - Consider materialized views for frequently accessed analytics

## Extending the System

### Adding Custom Metrics

Extend `AnalyticsCalculator`:

```python
class CustomAnalyticsCalculator(AnalyticsCalculator):
    def calculate_custom_metric(self):
        # Your custom calculation
        pass
```

### Custom Visualizations

Create new chart components:

```tsx
import { AnalyticsReport } from '../types';

interface CustomChartProps {
  data: AnalyticsReport;
}

export function CustomChart({ data }: CustomChartProps) {
  // Your visualization
}
```

## Troubleshooting

### No data returned
1. Verify questionnaire exists and user has access
2. Check if responses exist in database
3. Ensure source values are correct (`fieldscore_direct`, `kobotools`)

### Missing device information
1. Check if `device_type` is stored in Response model
2. Verify user agent is being captured
3. Device inference may return "unknown" for some cases

### Performance issues
1. Use source filtering to reduce dataset
2. Check database indexes on questionnaire_id
3. Consider caching analytics if not updating frequently

## API Response Examples

### Full Analytics Report

```json
{
  "status": "success",
  "analytics": {
    "questionnaire_id": "quest_123",
    "generated_at": "2026-07-09T15:30:00Z",
    "total_responses": 150,
    "source_distribution": {
      "total_responses": 150,
      "source_counts": {
        "fieldscore_direct": 100,
        "kobotools": 50
      },
      "source_percentages": {
        "fieldscore_direct": 66.67,
        "kobotools": 33.33
      }
    },
    "completion_rate_by_source": {
      "fieldscore_direct": 0.95,
      "kobotools": 0.88
    },
    "avg_time_by_source": {
      "fieldscore_direct": 240,
      "kobotools": 300
    },
    "device_recommendations": {
      "fieldscore_direct": "Mobile-first approach is effective for direct collection",
      "kobotools": "Strong mobile adoption in KoboToolbox deployments"
    }
  }
}
```

## License

Analytics system is part of ResearchOS Dashboard.
