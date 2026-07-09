"""
KoboToolbox and FieldScore Data Merge Logic

Handles merging responses from KoboToolbox and FieldScore with comprehensive
duplicate detection, conflict resolution, and data type conversion.
"""

import logging
import json
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import re


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ConflictType(Enum):
    """Types of conflicts that can occur during merge."""
    CONTRADICTORY_ANSWERS = "contradictory_answers"
    DIFFERENT_TIMESTAMPS = "different_timestamps"
    DIFFERENT_SOURCE_DATA = "different_source_data"


@dataclass
class MergeConflict:
    """Represents a conflict detected during merge."""
    question_id: str
    response_id: str
    kobo_value: Any
    fieldscore_value: Any
    kobo_timestamp: datetime
    fieldscore_timestamp: datetime
    conflict_type: ConflictType
    resolution: str


@dataclass
class MergeResult:
    """Result of a merge operation."""
    new_responses: int
    updated_responses: int
    conflicts: int
    errors: List[str]
    mapping_issues: List[str]
    conflicts_log: List[MergeConflict]


class DataTypeConverter:
    """Handles conversion of various data types from KoboToolbox format."""

    @staticmethod
    def parse_gps_coordinate(value: Any) -> Optional[Dict[str, float]]:
        """
        Parse GPS coordinates from various formats.

        Handles formats like:
        - "9.0765, 38.7469 0 500"
        - {"latitude": 9.0765, "longitude": 38.7469}
        - "9.0765 38.7469"
        """
        if not value:
            return None

        try:
            if isinstance(value, dict):
                return {
                    "latitude": float(value.get("latitude")),
                    "longitude": float(value.get("longitude")),
                    "altitude": float(value.get("altitude", 0)),
                    "accuracy": float(value.get("accuracy", 0))
                }

            if isinstance(value, str):
                # Remove extra spaces and parse
                parts = value.strip().split()
                if len(parts) >= 2:
                    return {
                        "latitude": float(parts[0]),
                        "longitude": float(parts[1]),
                        "altitude": float(parts[2]) if len(parts) > 2 else 0,
                        "accuracy": float(parts[3]) if len(parts) > 3 else 0
                    }
        except (ValueError, IndexError, TypeError) as e:
            logger.warning(f"Failed to parse GPS coordinate: {value}. Error: {e}")
            return None

        return None

    @staticmethod
    def parse_date(value: Any) -> Optional[datetime]:
        """
        Parse date from various formats.

        Handles ISO 8601, timestamps, and common date formats.
        """
        if not value:
            return None

        if isinstance(value, datetime):
            return value

        if isinstance(value, (int, float)):
            try:
                return datetime.fromtimestamp(value)
            except (ValueError, OSError):
                pass

        if isinstance(value, str):
            date_formats = [
                "%Y-%m-%dT%H:%M:%S.%fZ",  # ISO 8601 with Z
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
                "%d/%m/%Y",
                "%m/%d/%Y"
            ]

            for fmt in date_formats:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue

            logger.warning(f"Could not parse date: {value}")

        return None

    @staticmethod
    def parse_select_one(value: Any, options: Optional[List[str]] = None) -> Optional[str]:
        """Parse select_one field, validating against allowed options if provided."""
        if not value:
            return None

        if isinstance(value, dict):
            # Handle nested select format
            return value.get("name") or list(value.values())[0] if value else None

        value_str = str(value).strip()

        if options and value_str not in options:
            logger.warning(f"Invalid select option: {value_str}. Allowed: {options}")
            return None

        return value_str

    @staticmethod
    def parse_select_multiple(value: Any) -> Optional[List[str]]:
        """Parse select_multiple field."""
        if not value:
            return None

        if isinstance(value, list):
            return [str(v).strip() for v in value if v]

        if isinstance(value, str):
            # Split on common delimiters
            return [v.strip() for v in re.split(r'[,;|]', value) if v.strip()]

        return None

    @staticmethod
    def parse_integer(value: Any) -> Optional[int]:
        """Parse integer value."""
        if value is None:
            return None

        try:
            return int(value)
        except (ValueError, TypeError):
            logger.warning(f"Could not parse integer: {value}")
            return None

    @staticmethod
    def parse_decimal(value: Any) -> Optional[float]:
        """Parse decimal/float value."""
        if value is None:
            return None

        try:
            return float(value)
        except (ValueError, TypeError):
            logger.warning(f"Could not parse decimal: {value}")
            return None

    @staticmethod
    def parse_text(value: Any) -> Optional[str]:
        """Parse text field."""
        if value is None:
            return None

        return str(value).strip()


class DuplicateDetector:
    """Detects duplicate responses based on multiple criteria."""

    @staticmethod
    def calculate_submission_hash(kobo_id: str, device_id: str, timestamp: datetime) -> str:
        """Generate a hash for duplicate detection."""
        hash_input = f"{kobo_id}:{device_id}:{timestamp.isoformat()}".encode()
        return hashlib.sha256(hash_input).hexdigest()

    @staticmethod
    def find_duplicate(
        kobo_response: Dict[str, Any],
        existing_responses: List[Dict[str, Any]],
        match_threshold: float = 0.95
    ) -> Optional[Dict[str, Any]]:
        """
        Find a matching response in existing_responses.

        Returns the matching response or None if no match found.
        """
        kobo_id = kobo_response.get("kobo_submission_uuid")
        device_id = kobo_response.get("device_id")
        timestamp = kobo_response.get("timestamp")

        if not timestamp:
            return None

        # Primary check: exact submission UUID match
        for existing in existing_responses:
            if existing.get("kobo_submission_uuid") == kobo_id and kobo_id:
                return existing

        # Secondary check: device + timestamp match (within 1 minute)
        if device_id and timestamp:
            for existing in existing_responses:
                existing_timestamp = existing.get("timestamp")
                existing_device = existing.get("device_id")

                if existing_device == device_id and existing_timestamp:
                    time_diff = abs((timestamp - existing_timestamp).total_seconds())
                    if time_diff < 60:  # Within 1 minute
                        return existing

        return None


class ResponseMerger:
    """Orchestrates the merging of KoboToolbox and FieldScore responses."""

    def __init__(self, field_mapping: Dict[str, str]):
        """
        Initialize the merger.

        Args:
            field_mapping: Dict mapping KoboToolbox field names to FieldScore question IDs
        """
        self.field_mapping = field_mapping
        self.converter = DataTypeConverter()
        self.detector = DuplicateDetector()
        self.conflicts: List[MergeConflict] = []
        self.errors: List[str] = []
        self.mapping_issues: List[str] = []

    def convert_response_data(
        self,
        response: Dict[str, Any],
        field_type_map: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Convert KoboToolbox response data to standardized format.

        Args:
            response: KoboToolbox response dict
            field_type_map: Optional mapping of field names to their types
                           (e.g., {"location": "geopoint", "age": "integer"})

        Returns:
            Converted response dict
        """
        converted = response.copy()

        if not field_type_map:
            return converted

        for field_name, field_type in field_type_map.items():
            if field_name not in converted:
                continue

            value = converted[field_name]

            try:
                if field_type == "geopoint":
                    converted[field_name] = self.converter.parse_gps_coordinate(value)
                elif field_type == "date":
                    converted[field_name] = self.converter.parse_date(value)
                elif field_type == "select_one":
                    converted[field_name] = self.converter.parse_select_one(value)
                elif field_type == "select_multiple":
                    converted[field_name] = self.converter.parse_select_multiple(value)
                elif field_type == "integer":
                    converted[field_name] = self.converter.parse_integer(value)
                elif field_type == "decimal":
                    converted[field_name] = self.converter.parse_decimal(value)
                elif field_type == "text":
                    converted[field_name] = self.converter.parse_text(value)
            except Exception as e:
                self.errors.append(
                    f"Error converting {field_name} ({field_type}): {str(e)}"
                )
                logger.error(f"Conversion error: {e}")

        return converted

    def detect_conflict(
        self,
        response_id: str,
        question_id: str,
        kobo_value: Any,
        fieldscore_value: Any,
        kobo_timestamp: datetime,
        fieldscore_timestamp: datetime
    ) -> Optional[MergeConflict]:
        """
        Detect if values conflict and determine conflict type.

        Returns None if no conflict, otherwise MergeConflict object.
        """
        # Convert to comparable types
        kobo_str = str(kobo_value).lower().strip() if kobo_value else ""
        fieldscore_str = str(fieldscore_value).lower().strip() if fieldscore_value else ""

        # No conflict if both empty
        if not kobo_str and not fieldscore_str:
            return None

        # No conflict if values match
        if kobo_str == fieldscore_str:
            return None

        # Conflict detected - determine type and resolution
        conflict_type = ConflictType.CONTRADICTORY_ANSWERS

        # Determine which value to keep (most recent)
        resolution = "kept_kobo" if kobo_timestamp >= fieldscore_timestamp else "kept_fieldscore"

        conflict = MergeConflict(
            question_id=question_id,
            response_id=response_id,
            kobo_value=kobo_value,
            fieldscore_value=fieldscore_value,
            kobo_timestamp=kobo_timestamp,
            fieldscore_timestamp=fieldscore_timestamp,
            conflict_type=conflict_type,
            resolution=resolution
        )

        self.conflicts.append(conflict)
        logger.warning(
            f"Conflict detected in response {response_id}, question {question_id}: "
            f"KoboToolbox={kobo_value}, FieldScore={fieldscore_value}, "
            f"Resolution: {resolution}"
        )

        return conflict

    def merge_metadata(
        self,
        existing_response: Dict[str, Any],
        new_response: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge metadata from new_response into existing_response.

        Keeps timestamps from both sources for audit trail.
        """
        merged = existing_response.copy()

        # Add/update metadata
        if "metadata" not in merged:
            merged["metadata"] = {}

        metadata = merged["metadata"]

        # Preserve both timestamps
        if "device_id" in new_response:
            metadata["device_id_kobo"] = new_response.get("device_id")

        if "timestamp" in new_response:
            metadata["timestamp_kobo"] = new_response.get("timestamp")

        if "user_id" in new_response:
            metadata["user_id_kobo"] = new_response.get("user_id")

        # Update source tracking
        if "sources" not in metadata:
            metadata["sources"] = []

        if "kobotools" not in metadata["sources"]:
            metadata["sources"].append("kobotools")

        # Update last merge time
        metadata["last_merged"] = datetime.utcnow().isoformat()

        return merged

    def merge_responses(
        self,
        kobo_response: Dict[str, Any],
        fieldscore_response: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge a matched pair of KoboToolbox and FieldScore responses.

        Returns the merged response with conflict detection.
        """
        merged = fieldscore_response.copy()
        kobo_timestamp = self.converter.parse_date(kobo_response.get("timestamp"))
        fieldscore_timestamp = self.converter.parse_date(fieldscore_response.get("timestamp"))

        if not kobo_timestamp:
            kobo_timestamp = datetime.utcnow()
        if not fieldscore_timestamp:
            fieldscore_timestamp = datetime.utcnow()

        # Check for conflicts in mapped fields
        for kobo_field, question_id in self.field_mapping.items():
            if kobo_field in kobo_response and question_id in fieldscore_response:
                kobo_value = kobo_response[kobo_field]
                fieldscore_value = fieldscore_response[question_id]

                self.detect_conflict(
                    response_id=kobo_response.get("kobo_submission_uuid", "unknown"),
                    question_id=question_id,
                    kobo_value=kobo_value,
                    fieldscore_value=fieldscore_value,
                    kobo_timestamp=kobo_timestamp,
                    fieldscore_timestamp=fieldscore_timestamp
                )

                # Keep most recent value
                if kobo_timestamp > fieldscore_timestamp:
                    merged[question_id] = kobo_value

        # Merge metadata
        merged = self.merge_metadata(merged, kobo_response)

        return merged

    def validate_field_mapping(
        self,
        kobo_responses: List[Dict[str, Any]],
        fieldscore_responses: List[Dict[str, Any]]
    ) -> None:
        """Validate that field mapping is appropriate for the data."""
        if not kobo_responses or not fieldscore_responses:
            return

        sample_kobo = kobo_responses[0]
        sample_fieldscore = fieldscore_responses[0]

        for kobo_field, question_id in self.field_mapping.items():
            if kobo_field not in sample_kobo:
                self.mapping_issues.append(
                    f"KoboToolbox field '{kobo_field}' not found in sample response"
                )

            if question_id not in sample_fieldscore:
                self.mapping_issues.append(
                    f"FieldScore question ID '{question_id}' not found in sample response"
                )

        if self.mapping_issues:
            logger.warning(f"Field mapping validation issues: {self.mapping_issues}")


def merge_kobo_responses(
    kobo_responses: List[Dict[str, Any]],
    fieldscore_responses: List[Dict[str, Any]],
    field_mapping: Dict[str, str],
    field_type_map: Optional[Dict[str, str]] = None,
    existing_responses: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Merge KoboToolbox and FieldScore responses with comprehensive conflict handling.

    Args:
        kobo_responses: List of responses from KoboToolbox
        fieldscore_responses: List of responses from FieldScore
        field_mapping: Dict mapping KoboToolbox field names to FieldScore question IDs
        field_type_map: Optional dict mapping field names to their types for data conversion
        existing_responses: Optional list of existing merged responses for duplicate detection

    Returns:
        Dict with merge results including statistics and conflict log
    """
    merger = ResponseMerger(field_mapping)
    detector = DuplicateDetector()

    new_responses = []
    updated_responses = []
    processed_responses = set()

    if existing_responses is None:
        existing_responses = []

    # Validate field mapping
    merger.validate_field_mapping(kobo_responses, fieldscore_responses)

    # Process each KoboToolbox response
    for kobo_resp in kobo_responses:
        try:
            # Convert data types
            converted_kobo = merger.convert_response_data(kobo_resp, field_type_map)
            kobo_id = converted_kobo.get("kobo_submission_uuid")

            if kobo_id in processed_responses:
                logger.warning(f"Skipping duplicate submission UUID: {kobo_id}")
                continue

            # Check for existing duplicate
            existing_match = detector.find_duplicate(
                converted_kobo,
                existing_responses
            )

            # Look for corresponding FieldScore response
            fieldscore_match = None
            for fs_resp in fieldscore_responses:
                # Match by external ID or device info if available
                if (fs_resp.get("kobo_submission_uuid") == kobo_id or
                    (kobo_resp.get("device_id") == fs_resp.get("device_id") and
                     abs((merger.converter.parse_date(kobo_resp.get("timestamp")) or
                          datetime.utcnow()) -
                         (merger.converter.parse_date(fs_resp.get("timestamp")) or
                          datetime.utcnow())).total_seconds() < 60)):
                    fieldscore_match = fs_resp
                    break

            if existing_match and fieldscore_match:
                # Update existing response
                merged = merger.merge_responses(converted_kobo, fieldscore_match)
                merged["id"] = existing_match.get("id")
                merged["kobo_submission_uuid"] = kobo_id
                merged["source"] = "merged"
                updated_responses.append(merged)
                processed_responses.add(kobo_id)

            elif fieldscore_match:
                # Create new merged response
                merged = merger.merge_responses(converted_kobo, fieldscore_match)
                merged["kobo_submission_uuid"] = kobo_id
                merged["source"] = "merged"
                merged["created_at"] = datetime.utcnow().isoformat()
                new_responses.append(merged)
                processed_responses.add(kobo_id)

            elif not existing_match:
                # New standalone KoboToolbox response
                new_resp = converted_kobo.copy()
                new_resp["kobo_submission_uuid"] = kobo_id
                new_resp["source"] = "kobotools"
                new_resp["created_at"] = datetime.utcnow().isoformat()
                new_responses.append(new_resp)
                processed_responses.add(kobo_id)

        except Exception as e:
            error_msg = f"Error processing KoboToolbox response: {str(e)}"
            merger.errors.append(error_msg)
            logger.error(error_msg, exc_info=True)

    # Log conflicts for Ada review
    if merger.conflicts:
        logger.warning(
            f"Total conflicts detected: {len(merger.conflicts)}. "
            f"Review needed by Ada."
        )
        for conflict in merger.conflicts:
            logger.warning(
                f"Conflict in response {conflict.response_id}: "
                f"Question {conflict.question_id} - "
                f"KoboToolbox={conflict.kobo_value}, FieldScore={conflict.fieldscore_value}, "
                f"Resolution={conflict.resolution}"
            )

    # Prepare result
    result = {
        "new_responses": len(new_responses),
        "updated_responses": len(updated_responses),
        "conflicts": len(merger.conflicts),
        "errors": merger.errors,
        "mapping_issues": merger.mapping_issues,
        "merged_data": {
            "new": new_responses,
            "updated": updated_responses
        },
        "timestamp": datetime.utcnow().isoformat()
    }

    # Serialize conflicts for logging
    if merger.conflicts:
        result["conflicts_log"] = [
            {
                "response_id": c.response_id,
                "question_id": c.question_id,
                "kobo_value": str(c.kobo_value),
                "fieldscore_value": str(c.fieldscore_value),
                "kobo_timestamp": c.kobo_timestamp.isoformat(),
                "fieldscore_timestamp": c.fieldscore_timestamp.isoformat(),
                "conflict_type": c.conflict_type.value,
                "resolution": c.resolution,
                "requires_review": True
            }
            for c in merger.conflicts
        ]

    logger.info(
        f"Merge complete: {len(new_responses)} new, "
        f"{len(updated_responses)} updated, {len(merger.conflicts)} conflicts, "
        f"{len(merger.errors)} errors"
    )

    return result


if __name__ == "__main__":
    # Example usage
    sample_kobo = [
        {
            "kobo_submission_uuid": "uuid-001",
            "device_id": "device-123",
            "timestamp": "2026-01-15T10:30:00Z",
            "name": "John Doe",
            "age": "28",
            "location": "9.0765 38.7469",
            "survey_date": "2026-01-15"
        }
    ]

    sample_fieldscore = [
        {
            "id": "fs-001",
            "device_id": "device-123",
            "timestamp": "2026-01-15T10:31:00Z",
            "q_name": "John Doe",
            "q_age": "28",
            "q_location": "9.0765, 38.7469 0 500"
        }
    ]

    mapping = {
        "name": "q_name",
        "age": "q_age",
        "location": "q_location"
    }

    field_types = {
        "location": "geopoint",
        "age": "integer",
        "survey_date": "date"
    }

    result = merge_kobo_responses(
        sample_kobo,
        sample_fieldscore,
        mapping,
        field_types
    )

    print(json.dumps(result, indent=2, default=str))
