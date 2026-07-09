# Multi-Source Analytics Integration Guide

## Quick Start

This guide explains how to integrate the multi-source analytics system into your ResearchOS Dashboard project.

## Files Created

### Backend (Python)

#### 1. `multi_source_analytics.py`
Core analytics calculation engine.

**Key Classes:**
- `AnalyticsCalculator`: Main analytics processor
- `SourceMetrics`, `QuestionMetrics`, `DropOffAnalysis`: Data classes
- `serialize_report()`: JSON serialization function

**Usage:**
```python
from multi_source_analytics import AnalyticsCalculator

calculator = AnalyticsCalculator()
calculator.add_response(...)
report = calculator.generate_report(questionnaire_id)
```

#### 2. `analytics_endpoints.py`
Flask blueprint with REST API endpoints.

**Endpoints:**
- `GET /api/questionnaires/{id}/analytics` - Full analytics
- `GET /api/questionnaires/{id}/analytics/summary` - Quick stats
- `GET /api/questionnaires/{id}/analytics/sources` - Source metrics
- `GET /api/questionnaires/{id}/analytics/drop-off` - Drop-off analysis
- `GET /api/questionnaires/{id}/analytics/questions` - Question metrics
- `GET /api/analytics/health` - Health check

**Setup:**
```python
from analytics_endpoints import analytics_bp
from flask import Flask

app = Flask(__name__)
app.register_blueprint(analytics_bp)
```

### Frontend (React/TypeScript)

#### 3. `src/components/analytics/AnalyticsDashboard.tsx`
Main dashboard component with charts and visualizations.

**Features:**
- Real-time data fetching
- Source filtering controls
- Multiple chart types (bar, pie, line)
- Device distribution visualization
- Source-specific metrics cards

#### 4. `src/components/analytics/SourceDistributionBadge.tsx`
Visual badge showing source distribution percentages.

#### 5. `src/components/analytics/SourceSegmentControl.tsx`
Segment control for filtering by data source.

#### 6. `src/components/analytics/AnalyticsDemo.tsx`
Demo components showing different usage patterns:
- Full analytics dashboard
- Summary statistics
- Source metrics detailed view
- Drop-off analysis view
- Full page integration

#### 7. `src/components/analytics/index.ts`
Component exports.

#### 8. `src/hooks/useAnalytics.ts`
Custom React hooks for analytics data fetching:
- `useAnalytics()` - Main analytics data
- `useSourceMetrics()` - Source-specific metrics
- `useDropOffAnalysis()` - Drop-off analysis

#### 9. `src/services/api.ts` (UPDATED)
Added `analyticsApi` object with API methods.

#### 10. `src/types/index.ts` (UPDATED)
Added TypeScript interfaces:
- `AnalyticsReport`
- `SourceMetrics`
- `QuestionMetrics`
- `DropOffAnalysis`
- `SourceDistribution`
- `Questionnaire`

## Integration Steps

### Step 1: Add Backend Analytics

1. Copy `multi_source_analytics.py` to your project root:
```bash
cp multi_source_analytics.py /path/to/researchos-dashboard/
```

2. Copy `analytics_endpoints.py` to your project root:
```bash
cp analytics_endpoints.py /path/to/researchos-dashboard/
```

3. Register the Flask blueprint in your main app file:
```python
# app.py or main.py
from analytics_endpoints import analytics_bp

# Add to your Flask app
app.register_blueprint(analytics_bp)
```

4. Ensure your database models have these attributes:
```python
class Response(Base):
    # ... existing fields
    source: str  # fieldscore_direct or kobotools
    device_type: str  # mobile, web, tablet, unknown
    answers: JSON  # question_id -> answer mapping
    completion_time_seconds: int
    submitted_at: datetime
    is_completed: bool
    user_agent: str  # for device detection

class Question(Base):
    # ... existing fields
    id: str
    questionnaire_id: str
    text: str

class Questionnaire(Base):
    # ... existing fields
    id: str
    organization_id: str
    title: str
```

### Step 2: Add Frontend Components

1. Copy analytics components:
```bash
cp -r src/components/analytics /path/to/src/components/
```

2. Update API service (already done in provided api.ts):
```typescript
export const analyticsApi = {
  getQuestionnaireAnalytics: (questionnaireId: string, groupBy?: string) =>
    api.get(`/questionnaires/${questionnaireId}/analytics`, ...),
  // ... other endpoints
};
```

3. Update types (already done in provided types/index.ts):
- Analytics-related TypeScript interfaces added

4. Add the hook:
```bash
cp src/hooks/useAnalytics.ts /path/to/src/hooks/
```

### Step 3: Use in Your Application

#### Option A: Full Dashboard Component

```tsx
import { AnalyticsDashboard } from './components/analytics';

export function QuestionnaireAnalyticsPage() {
  const { id } = useParams();

  return (
    <div>
      <h1>Analytics</h1>
      <AnalyticsDashboard questionnaireId={id} />
    </div>
  );
}
```

#### Option B: Using the Hook

```tsx
import { useAnalytics } from '../hooks/useAnalytics';

export function AnalyticsSummary({ questionnaireId }) {
  const { data, loading, error } = useAnalytics(questionnaireId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Total Responses: {data?.total_responses}</h2>
      {/* Display analytics data */}
    </div>
  );
}
```

#### Option C: Using Demo Components

```tsx
import { AnalyticsPageDemoView } from './components/analytics/AnalyticsDemo';

export function AnalyticsPage() {
  const { questionnaireId } = useRouteParams();

  return <AnalyticsPageDemoView questionnaireId={questionnaireId} />;
}
```

## API Examples

### Get Full Analytics

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.example.com/api/questionnaires/quest_123/analytics?group_by=source
```

Response:
```json
{
  "status": "success",
  "analytics": {
    "questionnaire_id": "quest_123",
    "total_responses": 150,
    "source_distribution": {
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
    }
    // ... more fields
  }
}
```

### Get Quick Summary

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.example.com/api/questionnaires/quest_123/analytics/summary
```

### Get Source Metrics

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.example.com/api/questionnaires/quest_123/analytics/sources
```

### Get Drop-Off Analysis

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.example.com/api/questionnaires/quest_123/analytics/drop-off
```

## Configuration

### Database Model Updates

Update your Response model to include analytics fields:

```python
class Response(Base):
    __tablename__ = 'responses'

    id = Column(String, primary_key=True)
    questionnaire_id = Column(String, ForeignKey('questionnaire.id'))
    organization_id = Column(String, ForeignKey('organization.id'))
    source = Column(String, default='fieldscore_direct')  # NEW
    device_type = Column(String, default='unknown')  # NEW
    answers = Column(JSON)
    completion_time_seconds = Column(Integer, default=0)  # NEW
    submitted_at = Column(DateTime)
    is_completed = Column(Boolean, default=True)  # NEW
    user_agent = Column(String)  # NEW - for device detection
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes for analytics queries
    __table_args__ = (
        Index('idx_response_questionnaire', 'questionnaire_id'),
        Index('idx_response_source', 'source'),
        Index('idx_response_completed', 'is_completed'),
    )
```

### Environment Variables (if needed)

```bash
# .env
ANALYTICS_CACHE_TTL=300  # Cache analytics for 5 minutes
ANALYTICS_MAX_RESPONSES=50000  # Limit query size
```

## Data Populating

### From KoboToolbox

When importing KoboToolbox responses:
```python
from multi_source_analytics import DataSource

response = Response(
    source=DataSource.KOBOTOOLS.value,  # "kobotools"
    device_type=infer_device_type(user_agent),
    answers=kobo_response.answers,
    completion_time_seconds=calculate_duration(kobo_response),
    submitted_at=kobo_response.submission_time,
)
```

### From FieldScore Direct

When receiving FieldScore Direct responses:
```python
response = Response(
    source=DataSource.FIELDSCORE_DIRECT.value,  # "fieldscore_direct"
    device_type="mobile",  # Usually mobile for direct collection
    answers=fieldscore_response.answers,
    completion_time_seconds=fieldscore_response.duration,
    submitted_at=fieldscore_response.timestamp,
)
```

## Testing

### Python Tests

```python
from multi_source_analytics import AnalyticsCalculator

def test_analytics():
    calc = AnalyticsCalculator()
    
    # Add responses
    calc.add_response(
        response_id="resp_1",
        source="fieldscore_direct",
        device_type="mobile",
        answers={"q1": "Yes", "q2": 5},
        completion_time_seconds=120,
        timestamp="2026-07-09T10:00:00Z",
    )
    
    # Generate report
    report = calc.generate_report("quest_123")
    
    assert report.total_responses == 1
    assert report.source_distribution.total_responses == 1
```

### React Tests

```tsx
import { render, screen } from '@testing-library/react';
import { AnalyticsDashboard } from './components/analytics';

test('renders analytics dashboard', async () => {
  render(<AnalyticsDashboard questionnaireId="quest_123" />);
  
  await screen.findByText(/Response Analytics/i);
  expect(screen.getByText(/Response Analytics/i)).toBeInTheDocument();
});
```

## Troubleshooting

### No analytics data showing

1. **Check database**: Ensure responses exist with correct source values
   ```python
   db.query(Response).filter(Response.questionnaire_id == "quest_123").count()
   ```

2. **Verify authentication**: Check JWT token in API requests
   ```bash
   curl -v -H "Authorization: Bearer YOUR_TOKEN" ...
   ```

3. **Check model fields**: Ensure Response model has source, device_type, etc.

### Slow analytics queries

1. **Add database indexes**:
   ```sql
   CREATE INDEX idx_response_questionnaire ON response(questionnaire_id);
   CREATE INDEX idx_response_source ON response(source);
   ```

2. **Use source filtering**:
   ```typescript
   const { data } = useAnalytics(questionnaireId, {
     sourceFilter: 'fieldscore_direct',
   });
   ```

3. **Cache analytics**: Implement caching for frequently accessed questionnaires

## Performance Tips

1. **Lazy load analytics**: Don't load on every page view
2. **Use summary endpoint**: For quick metrics, use `/summary` instead of full report
3. **Filter by source**: Use `?source=fieldscore_direct` to reduce dataset
4. **Pagination**: For large question sets, implement pagination
5. **Memoization**: Wrap components with `React.memo()` to prevent re-renders

## Next Steps

1. **Implement analytics caching** - Cache reports in Redis for 5-10 minutes
2. **Add real-time updates** - Use WebSockets for live analytics
3. **Export functionality** - Add PDF/CSV export for analytics reports
4. **Custom metrics** - Extend with domain-specific calculations
5. **Alerts** - Alert users when drop-off exceeds thresholds

## Documentation

- **ANALYTICS.md** - Comprehensive analytics documentation
- **Component JSDoc** - Inline documentation in component files
- **API docstrings** - Detailed endpoint documentation

## Support

For issues or questions:
1. Check ANALYTICS.md for detailed documentation
2. Review AnalyticsDemo.tsx for usage examples
3. Check browser console for error messages
4. Verify database models have required fields
