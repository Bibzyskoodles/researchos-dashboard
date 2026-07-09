"""
Multi-Source Response Analytics

Handles analytics across multiple data sources (FieldScore Direct, KoboToolbox).
Provides source-specific metrics, cross-source analysis, and device/completion tracking.
"""

import logging
from dataclasses import dataclass, asdict, field
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


class DataSource(Enum):
    """Supported data sources for responses."""
    FIELDSCORE_DIRECT = "fieldscore_direct"
    KOBOTOOLS = "kobotools"


class DeviceType(Enum):
    """Device types used for data collection."""
    MOBILE = "mobile"
    WEB = "web"
    TABLET = "tablet"
    UNKNOWN = "unknown"


@dataclass
class SourceMetrics:
    """Metrics for a specific data source."""
    source: str
    total_responses: int = 0
    completed_responses: int = 0
    incomplete_responses: int = 0
    completion_rate: float = 0.0
    device_distribution: Dict[str, int] = field(default_factory=lambda: {
        "mobile": 0, "web": 0, "tablet": 0, "unknown": 0
    })
    avg_completion_time_seconds: float = 0.0
    median_completion_time_seconds: float = 0.0
    response_rate_per_day: List[Dict[str, Any]] = field(default_factory=list)
    last_response_time: Optional[str] = None
    first_response_time: Optional[str] = None


@dataclass
class QuestionMetrics:
    """Metrics for a specific question across all sources or per-source."""
    question_id: str
    question_text: str
    source: Optional[str] = None
    response_count: int = 0
    skip_count: int = 0
    skip_rate: float = 0.0
    answer_distribution: Dict[str, int] = field(default_factory=dict)
    most_common_answer: Optional[str] = None
    avg_rating: Optional[float] = None
    device_breakdown: Dict[str, int] = field(default_factory=dict)


@dataclass
class DropOffAnalysis:
    """Drop-off analysis across sources."""
    question_position: int
    question_id: str
    question_text: str
    responses_at_question: int
    responses_at_next_question: int
    drop_off_count: int
    drop_off_rate: float
    source_breakdown: Dict[str, Dict[str, int]] = field(default_factory=dict)


@dataclass
class SourceDistribution:
    """Distribution of responses across sources."""
    total_responses: int
    source_counts: Dict[str, int] = field(default_factory=dict)
    source_percentages: Dict[str, float] = field(default_factory=dict)


@dataclass
class AnalyticsReport:
    """Complete analytics report for a questionnaire."""
    questionnaire_id: str
    generated_at: str
    total_responses: int
    source_distribution: SourceDistribution
    source_metrics: Dict[str, SourceMetrics] = field(default_factory=dict)
    question_metrics: List[QuestionMetrics] = field(default_factory=list)
    per_source_question_metrics: Dict[str, List[QuestionMetrics]] = field(default_factory=dict)
    drop_off_analysis: List[DropOffAnalysis] = field(default_factory=list)
    completion_rate_by_source: Dict[str, float] = field(default_factory=dict)
    avg_time_by_source: Dict[str, float] = field(default_factory=dict)
    device_recommendations: Dict[str, str] = field(default_factory=dict)


class AnalyticsCalculator:
    """
    Calculates analytics across multiple data sources.

    Handles:
    - Counting responses by source
    - Completion rate calculations per source
    - Device split tracking across sources
    - Per-question analytics by source
    - Drop-off analysis combining both sources
    - Time estimates based on collection method
    """

    def __init__(self):
        """Initialize the analytics calculator."""
        self.source_data: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.questions: Dict[str, str] = {}
        self.completion_times: Dict[str, List[float]] = defaultdict(list)

    def add_response(
        self,
        response_id: str,
        source: str,
        device_type: str,
        answers: Dict[str, Any],
        completion_time_seconds: float,
        timestamp: str,
        is_completed: bool = True
    ) -> None:
        """
        Add a response to the analytics calculator.

        Args:
            response_id: Unique response identifier
            source: Data source (fieldscore_direct or kobotools)
            device_type: Type of device used (mobile, web, tablet)
            answers: Dictionary of question_id -> answer value
            completion_time_seconds: Time taken to complete the questionnaire
            timestamp: ISO timestamp of response submission
            is_completed: Whether the response is complete
        """
        response_data = {
            "response_id": response_id,
            "source": source,
            "device_type": device_type,
            "answers": answers,
            "completion_time_seconds": completion_time_seconds,
            "timestamp": timestamp,
            "is_completed": is_completed,
            "question_sequence": list(answers.keys()),
        }

        self.source_data[source].append(response_data)
        self.completion_times[source].append(completion_time_seconds)

        # Track questions
        for question_id, answer in answers.items():
            if question_id not in self.questions:
                self.questions[question_id] = f"Question {question_id}"

    def add_question_mapping(
        self,
        question_id: str,
        question_text: str
    ) -> None:
        """
        Add or update question text mapping.

        Args:
            question_id: Unique question identifier
            question_text: Human-readable question text
        """
        self.questions[question_id] = question_text

    def _calculate_source_metrics(self, source: str) -> SourceMetrics:
        """Calculate metrics for a specific source."""
        responses = self.source_data.get(source, [])

        if not responses:
            return SourceMetrics(source=source)

        total = len(responses)
        completed = sum(1 for r in responses if r.get("is_completed", True))
        incomplete = total - completed

        # Device distribution
        device_dist = defaultdict(int)
        for resp in responses:
            device = resp.get("device_type", "unknown").lower()
            device_dist[device] += 1

        # Completion times
        times = self.completion_times.get(source, [])
        avg_time = statistics.mean(times) if times else 0.0
        median_time = statistics.median(times) if times else 0.0

        # Response timeline (daily)
        daily_responses = self._get_daily_response_count(responses)

        # First and last response times
        sorted_responses = sorted(
            responses,
            key=lambda r: r.get("timestamp", "")
        )
        first_time = sorted_responses[0].get("timestamp") if sorted_responses else None
        last_time = sorted_responses[-1].get("timestamp") if sorted_responses else None

        return SourceMetrics(
            source=source,
            total_responses=total,
            completed_responses=completed,
            incomplete_responses=incomplete,
            completion_rate=completed / total if total > 0 else 0.0,
            device_distribution=dict(device_dist),
            avg_completion_time_seconds=avg_time,
            median_completion_time_seconds=median_time,
            response_rate_per_day=daily_responses,
            last_response_time=last_time,
            first_response_time=first_time,
        )

    def _get_daily_response_count(
        self,
        responses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Calculate daily response counts."""
        daily_counts = defaultdict(int)

        for resp in responses:
            timestamp_str = resp.get("timestamp", "")
            if timestamp_str:
                try:
                    dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                    date_str = dt.date().isoformat()
                    daily_counts[date_str] += 1
                except (ValueError, AttributeError):
                    pass

        return [
            {"date": date, "count": count}
            for date, count in sorted(daily_counts.items())
        ]

    def _calculate_question_metrics(
        self,
        question_id: str,
        source: Optional[str] = None
    ) -> QuestionMetrics:
        """
        Calculate metrics for a specific question.

        Args:
            question_id: The question to analyze
            source: If specified, only analyze responses from this source
        """
        if source:
            responses = self.source_data.get(source, [])
        else:
            responses = []
            for source_list in self.source_data.values():
                responses.extend(source_list)

        answer_distribution = defaultdict(int)
        device_breakdown = defaultdict(int)
        ratings = []
        skipped_count = 0

        for response in responses:
            answers = response.get("answers", {})
            answer = answers.get(question_id)

            if answer is None:
                skipped_count += 1
            else:
                answer_str = str(answer)
                answer_distribution[answer_str] += 1

                # Try to parse as numeric rating
                try:
                    rating = float(answer)
                    if 0 <= rating <= 10:
                        ratings.append(rating)
                except (ValueError, TypeError):
                    pass

                # Track device type for this answer
                device = response.get("device_type", "unknown")
                device_breakdown[device] += 1

        total_responses = len(responses)
        response_count = total_responses - skipped_count
        skip_rate = skipped_count / total_responses if total_responses > 0 else 0.0

        # Most common answer
        most_common = None
        if answer_distribution:
            most_common = max(answer_distribution.items(), key=lambda x: x[1])[0]

        # Average rating if applicable
        avg_rating = statistics.mean(ratings) if ratings else None

        return QuestionMetrics(
            question_id=question_id,
            question_text=self.questions.get(question_id, f"Question {question_id}"),
            source=source,
            response_count=response_count,
            skip_count=skipped_count,
            skip_rate=skip_rate,
            answer_distribution=dict(answer_distribution),
            most_common_answer=most_common,
            avg_rating=avg_rating,
            device_breakdown=dict(device_breakdown),
        )

    def _calculate_drop_off_analysis(self) -> List[DropOffAnalysis]:
        """
        Analyze drop-off rates across questionnaires.

        Returns:
            List of drop-off analysis for each question position.
        """
        all_responses = []
        for source_list in self.source_data.values():
            all_responses.extend(source_list)

        if not all_responses:
            return []

        # Get common question sequence
        question_sequences = [r.get("question_sequence", []) for r in all_responses]
        max_sequence = max(question_sequences, key=len) if question_sequences else []

        drop_off_results = []

        for i, question_id in enumerate(max_sequence[:-1]):
            next_question_id = max_sequence[i + 1]

            responses_at_q = sum(
                1 for r in all_responses if question_id in r.get("question_sequence", [])
            )
            responses_at_next = sum(
                1 for r in all_responses if next_question_id in r.get("question_sequence", [])
            )
            drop_off_count = responses_at_q - responses_at_next
            drop_off_rate = drop_off_count / responses_at_q if responses_at_q > 0 else 0.0

            # Per-source breakdown
            source_breakdown = {}
            for source in self.source_data.keys():
                source_responses = self.source_data[source]
                source_at_q = sum(
                    1 for r in source_responses if question_id in r.get("question_sequence", [])
                )
                source_at_next = sum(
                    1 for r in source_responses if next_question_id in r.get("question_sequence", [])
                )
                source_breakdown[source] = {
                    "responses_at_question": source_at_q,
                    "responses_at_next": source_at_next,
                    "drop_off": source_at_q - source_at_next,
                }

            drop_off_results.append(
                DropOffAnalysis(
                    question_position=i + 1,
                    question_id=question_id,
                    question_text=self.questions.get(question_id, f"Question {question_id}"),
                    responses_at_question=responses_at_q,
                    responses_at_next_question=responses_at_next,
                    drop_off_count=drop_off_count,
                    drop_off_rate=drop_off_rate,
                    source_breakdown=source_breakdown,
                )
            )

        return drop_off_results

    def _get_source_distribution(self) -> SourceDistribution:
        """Calculate source distribution."""
        source_counts = {
            source: len(responses)
            for source, responses in self.source_data.items()
        }
        total = sum(source_counts.values())

        source_percentages = {
            source: (count / total * 100) if total > 0 else 0.0
            for source, count in source_counts.items()
        }

        return SourceDistribution(
            total_responses=total,
            source_counts=source_counts,
            source_percentages=source_percentages,
        )

    def _get_device_recommendations(self) -> Dict[str, str]:
        """
        Generate recommendations based on device usage patterns.

        Returns:
            Dictionary of recommendations indexed by source.
        """
        recommendations = {}

        for source in self.source_data.keys():
            metrics = self._calculate_source_metrics(source)
            device_dist = metrics.device_distribution

            if not device_dist:
                recommendations[source] = "Insufficient data for device recommendation"
                continue

            total_devices = sum(device_dist.values())
            mobile_pct = (device_dist.get("mobile", 0) / total_devices * 100) if total_devices > 0 else 0

            if source == DataSource.FIELDSCORE_DIRECT.value:
                if mobile_pct > 70:
                    recommendations[source] = "Mobile-first approach is effective for direct collection"
                else:
                    recommendations[source] = "Consider mobile optimization for direct collection"
            elif source == DataSource.KOBOTOOLS.value:
                if mobile_pct > 50:
                    recommendations[source] = "Strong mobile adoption in KoboToolbox deployments"
                else:
                    recommendations[source] = "Web-based access is preferred; ensure responsive design"

        return recommendations

    def generate_report(self, questionnaire_id: str) -> AnalyticsReport:
        """
        Generate comprehensive analytics report across all sources.

        Args:
            questionnaire_id: The questionnaire being analyzed

        Returns:
            Complete AnalyticsReport with all metrics
        """
        # Calculate source metrics
        source_metrics = {
            source: self._calculate_source_metrics(source)
            for source in self.source_data.keys()
        }

        # Calculate overall question metrics (across all sources)
        question_metrics = [
            self._calculate_question_metrics(q_id)
            for q_id in self.questions.keys()
        ]

        # Calculate per-source question metrics
        per_source_metrics = {}
        for source in self.source_data.keys():
            per_source_metrics[source] = [
                self._calculate_question_metrics(q_id, source=source)
                for q_id in self.questions.keys()
            ]

        # Calculate completion rates
        completion_rates = {
            source: metrics.completion_rate
            for source, metrics in source_metrics.items()
        }

        # Calculate average times
        avg_times = {
            source: metrics.avg_completion_time_seconds
            for source, metrics in source_metrics.items()
        }

        return AnalyticsReport(
            questionnaire_id=questionnaire_id,
            generated_at=datetime.utcnow().isoformat(),
            total_responses=self._get_source_distribution().total_responses,
            source_distribution=self._get_source_distribution(),
            source_metrics=source_metrics,
            question_metrics=question_metrics,
            per_source_question_metrics=per_source_metrics,
            drop_off_analysis=self._calculate_drop_off_analysis(),
            completion_rate_by_source=completion_rates,
            avg_time_by_source=avg_times,
            device_recommendations=self._get_device_recommendations(),
        )

    def get_summary_stats(self) -> Dict[str, Any]:
        """
        Get summary statistics for quick overview.

        Returns:
            Dictionary with key statistics by source.
        """
        summary = {
            "total_responses": sum(
                len(responses) for responses in self.source_data.values()
            ),
            "by_source": {},
        }

        for source in self.source_data.keys():
            metrics = self._calculate_source_metrics(source)
            summary["by_source"][source] = {
                "total": metrics.total_responses,
                "completed": metrics.completed_responses,
                "completion_rate": round(metrics.completion_rate * 100, 2),
                "avg_time_minutes": round(metrics.avg_completion_time_seconds / 60, 2),
                "primary_device": self._get_primary_device(metrics.device_distribution),
            }

        return summary

    @staticmethod
    def _get_primary_device(device_dist: Dict[str, int]) -> str:
        """Get the most commonly used device type."""
        if not device_dist:
            return "unknown"
        return max(device_dist.items(), key=lambda x: x[1])[0]


def serialize_report(report: AnalyticsReport) -> Dict[str, Any]:
    """
    Serialize AnalyticsReport to JSON-compatible dictionary.

    Args:
        report: The report to serialize

    Returns:
        Dictionary representation suitable for JSON serialization
    """
    return {
        "questionnaire_id": report.questionnaire_id,
        "generated_at": report.generated_at,
        "total_responses": report.total_responses,
        "source_distribution": asdict(report.source_distribution),
        "source_metrics": {
            source: asdict(metrics)
            for source, metrics in report.source_metrics.items()
        },
        "question_metrics": [asdict(q) for q in report.question_metrics],
        "per_source_question_metrics": {
            source: [asdict(q) for q in metrics]
            for source, metrics in report.per_source_question_metrics.items()
        },
        "drop_off_analysis": [asdict(d) for d in report.drop_off_analysis],
        "completion_rate_by_source": report.completion_rate_by_source,
        "avg_time_by_source": report.avg_time_by_source,
        "device_recommendations": report.device_recommendations,
    }
