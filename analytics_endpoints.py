"""
Multi-Source Analytics API Endpoints

Flask blueprint providing REST endpoints for response analytics across multiple sources.
"""

import logging
from typing import Optional, Dict, Any
from flask import Blueprint, request, jsonify, current_app, g
from functools import wraps
import jwt

from multi_source_analytics import (
    AnalyticsCalculator,
    serialize_report,
    DataSource,
)

logger = logging.getLogger(__name__)

# Create blueprint
analytics_bp = Blueprint(
    'analytics',
    __name__,
    url_prefix='/api'
)


# =============================================================================
# Authentication Middleware
# =============================================================================

def require_auth(f):
    """Decorator: Verify JWT token and extract org_id"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            logger.warning(f"Missing Authorization header from {request.remote_addr}")
            return jsonify({'error': 'Missing Authorization header'}), 401

        try:
            parts = auth_header.split()
            if len(parts) != 2 or parts[0].lower() != 'bearer':
                return jsonify({'error': 'Invalid Authorization header format'}), 401

            token = parts[1]
            secret = current_app.config.get('JWT_SECRET_KEY')

            if not secret:
                logger.error("JWT_SECRET_KEY not configured")
                return jsonify({'error': 'Server configuration error'}), 500

            payload = jwt.decode(token, secret, algorithms=['HS256'])
            g.user_id = payload.get('user_id')
            g.org_id = payload.get('org_id')

            if not g.org_id:
                logger.warning(f"Token missing org_id for user {g.user_id}")
                return jsonify({'error': 'Invalid token: missing org_id'}), 401

        except jwt.ExpiredSignatureError:
            logger.warning(f"Expired token from {request.remote_addr}")
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token from {request.remote_addr}: {str(e)}")
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            logger.error(f"Auth verification error: {str(e)}", exc_info=True)
            return jsonify({'error': 'Authentication error'}), 500

        return f(*args, **kwargs)

    return decorated_function


# =============================================================================
# Helper Functions
# =============================================================================

def get_db():
    """Get SQLAlchemy session from app context"""
    return current_app.db.session


def build_analytics(
    questionnaire_id: str,
    db_session: Any,
    source_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build analytics report for a questionnaire.

    Args:
        questionnaire_id: Questionnaire ID
        db_session: Database session
        source_filter: Optional source to filter by (fieldscore_direct, kobotools)

    Returns:
        Analytics report dictionary
    """
    try:
        from sqlalchemy.orm import Session
        from sqlalchemy import and_, or_

        # Import models - adjust based on your project structure
        # These are placeholder imports; adjust to match your actual models
        try:
            from .models import Response, Question, Questionnaire
        except ImportError:
            # Fallback for testing
            logger.warning("Could not import models, returning mock data")
            return {
                "status": "error",
                "message": "Database models not available",
                "questionnaire_id": questionnaire_id,
            }

        # Verify questionnaire exists and user has access
        questionnaire = db_session.query(Questionnaire).filter(
            and_(
                Questionnaire.id == questionnaire_id,
                Questionnaire.organization_id == g.org_id,
            )
        ).first()

        if not questionnaire:
            return {
                "status": "error",
                "message": "Questionnaire not found",
            }

        # Build analytics calculator
        calculator = AnalyticsCalculator()

        # Get all responses for this questionnaire
        responses_query = db_session.query(Response).filter(
            Response.questionnaire_id == questionnaire_id
        )

        # Apply source filter if specified
        if source_filter:
            responses_query = responses_query.filter(
                Response.source == source_filter
            )

        responses = responses_query.all()

        # Get all questions for the questionnaire
        questions = db_session.query(Question).filter(
            Question.questionnaire_id == questionnaire_id
        ).all()

        # Add question mappings
        for question in questions:
            calculator.add_question_mapping(
                question_id=question.id,
                question_text=question.text or f"Question {question.id}",
            )

        # Add responses to calculator
        for response in responses:
            # Parse answers (assuming stored as JSON)
            answers = {}
            try:
                if isinstance(response.answers, dict):
                    answers = response.answers
                elif isinstance(response.answers, str):
                    import json
                    answers = json.loads(response.answers)
            except Exception as e:
                logger.warning(f"Failed to parse answers for response {response.id}: {e}")

            # Determine device type from user agent or metadata
            device_type = response.device_type or "unknown"
            if not device_type or device_type.lower() == "unknown":
                # Try to infer from user agent if available
                device_type = infer_device_type(response.user_agent or "")

            calculator.add_response(
                response_id=response.id,
                source=response.source or DataSource.FIELDSCORE_DIRECT.value,
                device_type=device_type,
                answers=answers,
                completion_time_seconds=response.completion_time_seconds or 0,
                timestamp=response.submitted_at.isoformat() if response.submitted_at else "",
                is_completed=response.is_completed or True,
            )

        # Generate report
        report = calculator.generate_report(questionnaire_id)
        summary = calculator.get_summary_stats()

        return {
            "status": "success",
            "questionnaire_id": questionnaire_id,
            "questionnaire_title": questionnaire.title,
            "analytics": serialize_report(report),
            "summary": summary,
        }

    except Exception as e:
        logger.error(f"Error building analytics: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Failed to generate analytics: {str(e)}",
        }


def infer_device_type(user_agent: str) -> str:
    """
    Infer device type from user agent string.

    Args:
        user_agent: User agent string from request

    Returns:
        Device type: mobile, tablet, web, or unknown
    """
    if not user_agent:
        return "unknown"

    user_agent_lower = user_agent.lower()

    # Check for mobile
    if any(x in user_agent_lower for x in ["mobile", "android", "iphone", "ipod", "blackberry"]):
        return "mobile"

    # Check for tablet
    if any(x in user_agent_lower for x in ["tablet", "ipad", "kindle", "playbook"]):
        return "tablet"

    # Check for desktop/web
    if any(x in user_agent_lower for x in ["windows", "mac", "linux", "x11"]):
        return "web"

    return "unknown"


# =============================================================================
# API Endpoints
# =============================================================================

@analytics_bp.route('/questionnaires/<questionnaire_id>/analytics', methods=['GET'])
@require_auth
def get_questionnaire_analytics(questionnaire_id: str):
    """
    Get analytics for a questionnaire, optionally filtered by source.

    Query Parameters:
        group_by (str): Optional. Set to 'source' to group analytics by data source.
                        Can also filter by specific source: 'fieldscore_direct' or 'kobotools'.
        source (str): Optional. Specific source to filter by.

    Returns:
        JSON response with analytics data
    """
    try:
        db = get_db()
        group_by = request.args.get('group_by', 'all')
        source_filter = request.args.get('source')

        # Build analytics
        analytics_data = build_analytics(
            questionnaire_id=questionnaire_id,
            db_session=db,
            source_filter=source_filter,
        )

        if analytics_data.get("status") == "error":
            return jsonify(analytics_data), 404

        logger.info(
            f"Analytics retrieved for questionnaire {questionnaire_id} "
            f"(group_by={group_by}, source_filter={source_filter})"
        )

        return jsonify(analytics_data), 200

    except Exception as e:
        logger.error(f"Error in get_questionnaire_analytics: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve analytics",
            "error_details": str(e),
        }), 500


@analytics_bp.route('/questionnaires/<questionnaire_id>/analytics/summary', methods=['GET'])
@require_auth
def get_analytics_summary(questionnaire_id: str):
    """
    Get quick summary statistics for a questionnaire.

    Returns:
        JSON response with summary statistics by source
    """
    try:
        db = get_db()

        # Build analytics
        analytics_data = build_analytics(
            questionnaire_id=questionnaire_id,
            db_session=db,
        )

        if analytics_data.get("status") == "error":
            return jsonify(analytics_data), 404

        # Return only summary
        summary_response = {
            "status": "success",
            "questionnaire_id": questionnaire_id,
            "summary": analytics_data.get("summary"),
            "source_distribution": analytics_data.get("analytics", {}).get("source_distribution"),
        }

        return jsonify(summary_response), 200

    except Exception as e:
        logger.error(f"Error in get_analytics_summary: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve summary",
        }), 500


@analytics_bp.route('/questionnaires/<questionnaire_id>/analytics/sources', methods=['GET'])
@require_auth
def get_source_metrics(questionnaire_id: str):
    """
    Get detailed metrics for each data source.

    Returns:
        JSON response with per-source metrics
    """
    try:
        db = get_db()

        # Build analytics
        analytics_data = build_analytics(
            questionnaire_id=questionnaire_id,
            db_session=db,
        )

        if analytics_data.get("status") == "error":
            return jsonify(analytics_data), 404

        analytics = analytics_data.get("analytics", {})

        source_response = {
            "status": "success",
            "questionnaire_id": questionnaire_id,
            "source_distribution": analytics.get("source_distribution"),
            "source_metrics": analytics.get("source_metrics"),
            "completion_rate_by_source": analytics.get("completion_rate_by_source"),
            "avg_time_by_source": analytics.get("avg_time_by_source"),
            "device_recommendations": analytics.get("device_recommendations"),
        }

        return jsonify(source_response), 200

    except Exception as e:
        logger.error(f"Error in get_source_metrics: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve source metrics",
        }), 500


@analytics_bp.route('/questionnaires/<questionnaire_id>/analytics/drop-off', methods=['GET'])
@require_auth
def get_drop_off_analysis(questionnaire_id: str):
    """
    Get drop-off analysis across sources.

    Returns:
        JSON response with drop-off analysis by question
    """
    try:
        db = get_db()

        # Build analytics
        analytics_data = build_analytics(
            questionnaire_id=questionnaire_id,
            db_session=db,
        )

        if analytics_data.get("status") == "error":
            return jsonify(analytics_data), 404

        analytics = analytics_data.get("analytics", {})

        drop_off_response = {
            "status": "success",
            "questionnaire_id": questionnaire_id,
            "drop_off_analysis": analytics.get("drop_off_analysis"),
            "total_responses": analytics_data.get("analytics", {}).get("total_responses"),
        }

        return jsonify(drop_off_response), 200

    except Exception as e:
        logger.error(f"Error in get_drop_off_analysis: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve drop-off analysis",
        }), 500


@analytics_bp.route('/questionnaires/<questionnaire_id>/analytics/questions', methods=['GET'])
@require_auth
def get_question_analytics(questionnaire_id: str):
    """
    Get per-question analytics, optionally by source.

    Query Parameters:
        source (str): Optional. Filter by specific source.

    Returns:
        JSON response with question-level metrics
    """
    try:
        db = get_db()
        source_filter = request.args.get('source')

        # Build analytics
        analytics_data = build_analytics(
            questionnaire_id=questionnaire_id,
            db_session=db,
            source_filter=source_filter,
        )

        if analytics_data.get("status") == "error":
            return jsonify(analytics_data), 404

        analytics = analytics_data.get("analytics", {})

        if source_filter:
            # Return per-source metrics if source is specified
            question_metrics = analytics.get("per_source_question_metrics", {}).get(
                source_filter, []
            )
        else:
            # Return overall metrics
            question_metrics = analytics.get("question_metrics", [])

        question_response = {
            "status": "success",
            "questionnaire_id": questionnaire_id,
            "source_filter": source_filter,
            "question_metrics": question_metrics,
        }

        return jsonify(question_response), 200

    except Exception as e:
        logger.error(f"Error in get_question_analytics: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve question analytics",
        }), 500


# =============================================================================
# Health Check
# =============================================================================

@analytics_bp.route('/analytics/health', methods=['GET'])
def analytics_health():
    """Health check endpoint for analytics service."""
    return jsonify({
        "status": "healthy",
        "service": "multi-source-analytics",
        "version": "1.0.0",
    }), 200
