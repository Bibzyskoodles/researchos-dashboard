"""
Kobo Data Sync Orchestrator
Real-time sync management and background task scheduling for KoboToolbox integration
"""

import logging
import traceback
from datetime import datetime, timedelta
from functools import wraps
from typing import Dict, Any, List, Optional, Tuple

from flask import Blueprint, request, jsonify, current_app, g
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
import jwt

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create blueprint
kobo_sync_bp = Blueprint(
    'kobo_sync',
    __name__,
    url_prefix='/api'
)

# Global scheduler instance
_scheduler: Optional[BackgroundScheduler] = None


# =============================================================================
# Authentication & Authorization Middleware
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

            # Verify and decode token
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            g.user_id = payload.get('user_id')
            g.org_id = payload.get('org_id')

            if not g.org_id:
                logger.warning(f"Token missing org_id for user {g.user_id}")
                return jsonify({'error': 'Invalid token: missing org_id'}), 401

            logger.debug(f"Auth verified for user {g.user_id} in org {g.org_id}")

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


def verify_org_access(questionnaire_id: str) -> Tuple[bool, Optional[str], Optional[int]]:
    """
    Verify user's organization has access to the questionnaire
    Returns: (is_valid, error_message, http_status_code)
    """
    try:
        from .models import Questionnaire, QuestionnaireKoboSync

        # Get database session
        db: Session = current_app.db.session

        # Fetch questionnaire with org validation
        questionnaire = db.query(Questionnaire).filter(
            and_(
                Questionnaire.id == questionnaire_id,
                Questionnaire.organization_id == g.org_id
            )
        ).first()

        if not questionnaire:
            logger.warning(
                f"Org {g.org_id} attempted access to questionnaire {questionnaire_id}"
            )
            return False, 'Questionnaire not found or access denied', 404

        return True, None, None

    except Exception as e:
        logger.error(f"Error verifying org access: {str(e)}", exc_info=True)
        return False, 'Internal server error', 500


# =============================================================================
# Helper Functions
# =============================================================================

def get_db() -> Session:
    """Get SQLAlchemy session from app context"""
    return current_app.db.session


def format_sync_response(
    status: str,
    responses_synced: int = 0,
    conflicts: int = 0,
    errors: List[str] = None,
    sync_id: str = None,
    duration_seconds: float = None
) -> Dict[str, Any]:
    """Format standardized sync response"""
    return {
        'status': status,
        'responses_synced': responses_synced,
        'conflicts': conflicts,
        'errors': errors or [],
        'error_count': len(errors or []),
        'sync_id': sync_id,
        'duration_seconds': round(duration_seconds, 2) if duration_seconds else None,
        'timestamp': datetime.utcnow().isoformat()
    }


def log_sync_event(
    questionnaire_id: str,
    org_id: str,
    status: str,
    responses_synced: int = 0,
    conflicts: int = 0,
    errors: List[str] = None,
    duration_seconds: float = None
):
    """Log sync event to database and logger"""
    try:
        from .models import QuestionnaireKoboSyncHistory

        db = get_db()

        history_record = QuestionnaireKoboSyncHistory(
            questionnaire_id=questionnaire_id,
            organization_id=org_id,
            status=status,
            responses_synced=responses_synced,
            conflicts=conflicts,
            errors=errors or [],
            duration_seconds=duration_seconds,
            synced_at=datetime.utcnow()
        )

        db.add(history_record)
        db.commit()

        logger.info(
            f"Sync recorded - Questionnaire: {questionnaire_id}, "
            f"Status: {status}, Responses: {responses_synced}, "
            f"Conflicts: {conflicts}, Errors: {len(errors or [])}"
        )

        return history_record.id

    except Exception as e:
        logger.error(
            f"Error logging sync event for questionnaire {questionnaire_id}: {str(e)}",
            exc_info=True
        )
        return None


# =============================================================================
# Endpoints
# =============================================================================

@kobo_sync_bp.route('/questionnaires/<questionnaire_id>/sync-kobo', methods=['POST'])
@require_auth
def trigger_manual_sync(questionnaire_id: str):
    """
    POST /api/questionnaires/{id}/sync-kobo
    Manually trigger Kobo sync for a questionnaire

    Returns:
        {
            status: "success|partial|error",
            responses_synced: int,
            conflicts: int,
            errors: [str],
            error_count: int,
            sync_id: str,
            duration_seconds: float,
            timestamp: ISO8601
        }
    """
    try:
        logger.info(f"Manual sync triggered for questionnaire {questionnaire_id} by {g.user_id}")

        # Verify org access
        is_valid, error_msg, status_code = verify_org_access(questionnaire_id)
        if not is_valid:
            return jsonify({'error': error_msg}), status_code

        from .models import QuestionnaireKoboSync
        from . import kobo_sync_scheduler

        db = get_db()

        # Check if Kobo sync is configured
        kobo_sync = db.query(QuestionnaireKoboSync).filter(
            QuestionnaireKoboSync.questionnaire_id == questionnaire_id
        ).first()

        if not kobo_sync or not kobo_sync.is_active:
            logger.warning(
                f"Kobo sync not configured or inactive for questionnaire {questionnaire_id}"
            )
            return jsonify({
                'error': 'Kobo sync not configured for this questionnaire'
            }), 400

        # Execute sync
        start_time = datetime.utcnow()
        try:
            sync_result = kobo_sync_scheduler.sync_questionnaire(questionnaire_id)
            duration = (datetime.utcnow() - start_time).total_seconds()

            responses_synced = sync_result.get('responses_synced', 0)
            conflicts = sync_result.get('conflicts', 0)
            errors = sync_result.get('errors', [])
            status = sync_result.get('status', 'error')

        except Exception as e:
            logger.error(
                f"Error during sync execution for {questionnaire_id}: {str(e)}",
                exc_info=True
            )
            duration = (datetime.utcnow() - start_time).total_seconds()
            status = 'error'
            responses_synced = 0
            conflicts = 0
            errors = [f"Sync execution error: {str(e)}"]

        # Log the sync event
        sync_id = log_sync_event(
            questionnaire_id=questionnaire_id,
            org_id=g.org_id,
            status=status,
            responses_synced=responses_synced,
            conflicts=conflicts,
            errors=errors,
            duration_seconds=duration
        )

        response = format_sync_response(
            status=status,
            responses_synced=responses_synced,
            conflicts=conflicts,
            errors=errors,
            sync_id=sync_id,
            duration_seconds=duration
        )

        http_status = 200 if status in ['success', 'partial'] else 500
        return jsonify(response), http_status

    except Exception as e:
        logger.error(
            f"Unexpected error in manual sync endpoint: {str(e)}",
            exc_info=True
        )
        return jsonify({'error': 'Internal server error', 'detail': str(e)}), 500


@kobo_sync_bp.route('/questionnaires/<questionnaire_id>/kobo-status', methods=['GET'])
@require_auth
def get_kobo_status(questionnaire_id: str):
    """
    GET /api/questionnaires/{id}/kobo-status
    Get current Kobo sync status for a questionnaire

    Returns:
        {
            questionnaire_id: str,
            is_configured: bool,
            is_active: bool,
            last_sync: ISO8601 or null,
            last_sync_status: "success|partial|error" or null,
            responses_synced_last: int,
            conflicts_last: int,
            next_sync_scheduled: ISO8601,
            api_token_valid: bool,
            error_message: str or null
        }
    """
    try:
        logger.info(f"Status check for questionnaire {questionnaire_id}")

        # Verify org access
        is_valid, error_msg, status_code = verify_org_access(questionnaire_id)
        if not is_valid:
            return jsonify({'error': error_msg}), status_code

        from .models import QuestionnaireKoboSync, QuestionnaireKoboSyncHistory

        db = get_db()

        kobo_sync = db.query(QuestionnaireKoboSync).filter(
            QuestionnaireKoboSync.questionnaire_id == questionnaire_id
        ).first()

        if not kobo_sync:
            return jsonify({
                'questionnaire_id': questionnaire_id,
                'is_configured': False,
                'is_active': False,
                'last_sync': None,
                'last_sync_status': None,
                'responses_synced_last': 0,
                'conflicts_last': 0,
                'next_sync_scheduled': None,
                'api_token_valid': False,
                'error_message': 'Kobo sync not configured'
            }), 200

        # Get last sync record
        last_sync = db.query(QuestionnaireKoboSyncHistory).filter(
            QuestionnaireKoboSyncHistory.questionnaire_id == questionnaire_id
        ).order_by(desc(QuestionnaireKoboSyncHistory.synced_at)).first()

        # Calculate next scheduled sync (every 5 minutes)
        if last_sync:
            next_sync = last_sync.synced_at + timedelta(minutes=5)
        else:
            next_sync = datetime.utcnow() + timedelta(minutes=5)

        # Validate API token (if needed - implement token validation logic)
        api_token_valid = bool(kobo_sync.kobo_api_token)

        return jsonify({
            'questionnaire_id': questionnaire_id,
            'is_configured': True,
            'is_active': kobo_sync.is_active,
            'kobo_asset_uid': kobo_sync.kobo_asset_uid,
            'last_sync': last_sync.synced_at.isoformat() if last_sync else None,
            'last_sync_status': last_sync.status if last_sync else None,
            'responses_synced_last': last_sync.responses_synced if last_sync else 0,
            'conflicts_last': last_sync.conflicts if last_sync else 0,
            'next_sync_scheduled': next_sync.isoformat(),
            'api_token_valid': api_token_valid,
            'error_message': kobo_sync.last_error if hasattr(kobo_sync, 'last_error') else None,
            'synced_at': datetime.utcnow().isoformat()
        }), 200

    except Exception as e:
        logger.error(
            f"Error retrieving status for questionnaire {questionnaire_id}: {str(e)}",
            exc_info=True
        )
        return jsonify({'error': 'Internal server error'}), 500


@kobo_sync_bp.route('/questionnaires/<questionnaire_id>/sync-history', methods=['GET'])
@require_auth
def get_sync_history(questionnaire_id: str):
    """
    GET /api/questionnaires/{id}/sync-history
    Get last 20 sync events with details

    Returns:
        {
            questionnaire_id: str,
            total_syncs: int,
            history: [
                {
                    sync_id: str,
                    status: "success|partial|error",
                    responses_synced: int,
                    conflicts: int,
                    error_count: int,
                    errors: [str],
                    duration_seconds: float,
                    synced_at: ISO8601
                }
            ]
        }
    """
    try:
        logger.info(f"History requested for questionnaire {questionnaire_id}")

        # Verify org access
        is_valid, error_msg, status_code = verify_org_access(questionnaire_id)
        if not is_valid:
            return jsonify({'error': error_msg}), status_code

        from .models import QuestionnaireKoboSyncHistory

        db = get_db()

        # Query last 20 sync records
        history_records = db.query(QuestionnaireKoboSyncHistory).filter(
            QuestionnaireKoboSyncHistory.questionnaire_id == questionnaire_id
        ).order_by(
            desc(QuestionnaireKoboSyncHistory.synced_at)
        ).limit(20).all()

        history_data = [
            {
                'sync_id': str(record.id),
                'status': record.status,
                'responses_synced': record.responses_synced,
                'conflicts': record.conflicts,
                'error_count': len(record.errors or []),
                'errors': record.errors or [],
                'duration_seconds': record.duration_seconds,
                'synced_at': record.synced_at.isoformat()
            }
            for record in history_records
        ]

        return jsonify({
            'questionnaire_id': questionnaire_id,
            'total_syncs': len(history_records),
            'history': history_data,
            'queried_at': datetime.utcnow().isoformat()
        }), 200

    except Exception as e:
        logger.error(
            f"Error retrieving sync history for {questionnaire_id}: {str(e)}",
            exc_info=True
        )
        return jsonify({'error': 'Internal server error'}), 500


@kobo_sync_bp.route('/questionnaires/<questionnaire_id>/kobo/disconnect', methods=['POST'])
@require_auth
def disconnect_kobo(questionnaire_id: str):
    """
    POST /api/questionnaires/{id}/kobo/disconnect
    Remove KoboToolbox link and stop syncing for this questionnaire

    Returns:
        {
            status: "success",
            message: str,
            questionnaire_id: str
        }
    """
    try:
        logger.info(
            f"Disconnect requested for questionnaire {questionnaire_id} by {g.user_id}"
        )

        # Verify org access
        is_valid, error_msg, status_code = verify_org_access(questionnaire_id)
        if not is_valid:
            return jsonify({'error': error_msg}), status_code

        from .models import QuestionnaireKoboSync

        db = get_db()

        kobo_sync = db.query(QuestionnaireKoboSync).filter(
            QuestionnaireKoboSync.questionnaire_id == questionnaire_id
        ).first()

        if not kobo_sync:
            return jsonify({
                'error': 'Kobo sync not configured for this questionnaire'
            }), 404

        # Mark as inactive and clear sensitive data
        kobo_sync.is_active = False
        kobo_sync.kobo_api_token = None
        kobo_sync.kobo_asset_uid = None
        kobo_sync.disconnected_at = datetime.utcnow()
        kobo_sync.disconnected_by_user_id = g.user_id

        db.commit()

        logger.info(
            f"Successfully disconnected Kobo for questionnaire {questionnaire_id}"
        )

        return jsonify({
            'status': 'success',
            'message': f'Kobo sync disconnected for questionnaire {questionnaire_id}',
            'questionnaire_id': questionnaire_id,
            'timestamp': datetime.utcnow().isoformat()
        }), 200

    except Exception as e:
        logger.error(
            f"Error disconnecting Kobo for {questionnaire_id}: {str(e)}",
            exc_info=True
        )
        return jsonify({'error': 'Internal server error'}), 500


@kobo_sync_bp.route('/kobo/test-connection', methods=['POST'])
@require_auth
def test_connection():
    """
    POST /api/kobo/test-connection
    Test KoboToolbox API connection before saving

    Request body:
        {
            kobo_api_token: str,
            kobo_server_url: str (optional, defaults to production)
        }

    Returns:
        {
            status: "success|error",
            message: str,
            valid: bool,
            asset_count: int (if valid)
        }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body required'}), 400

        api_token = data.get('kobo_api_token', '').strip()
        server_url = data.get('kobo_server_url', 'https://kf.kobotoolbox.org').strip()

        if not api_token:
            return jsonify({
                'status': 'error',
                'valid': False,
                'message': 'API token is required'
            }), 400

        logger.info(f"Testing Kobo connection for org {g.org_id}")

        from . import kobo_api_client

        try:
            # Test API connection
            is_valid, asset_count = kobo_api_client.validate_token(
                api_token,
                server_url
            )

            if is_valid:
                logger.info(
                    f"Kobo connection test successful for org {g.org_id}. "
                    f"Assets found: {asset_count}"
                )
                return jsonify({
                    'status': 'success',
                    'valid': True,
                    'message': 'Connection successful',
                    'asset_count': asset_count,
                    'timestamp': datetime.utcnow().isoformat()
                }), 200
            else:
                logger.warning(f"Kobo connection test failed for org {g.org_id}")
                return jsonify({
                    'status': 'error',
                    'valid': False,
                    'message': 'Invalid API token or connection failed',
                    'timestamp': datetime.utcnow().isoformat()
                }), 400

        except Exception as e:
            logger.error(
                f"Error testing Kobo connection: {str(e)}",
                exc_info=True
            )
            return jsonify({
                'status': 'error',
                'valid': False,
                'message': f'Connection test failed: {str(e)}',
                'timestamp': datetime.utcnow().isoformat()
            }), 400

    except Exception as e:
        logger.error(
            f"Unexpected error in test-connection endpoint: {str(e)}",
            exc_info=True
        )
        return jsonify({'error': 'Internal server error'}), 500


# =============================================================================
# Background Task Scheduling
# =============================================================================

def sync_job_callback(app_context):
    """
    Background job: Sync all active Kobo questionnaires
    Runs every 5 minutes via APScheduler
    """
    with app_context.app_context():
        try:
            from .models import QuestionnaireKoboSync
            from . import kobo_sync_scheduler

            logger.info("Starting background Kobo sync job")

            db = get_db()

            # Query all active Kobo syncs
            active_syncs = db.query(QuestionnaireKoboSync).filter(
                QuestionnaireKoboSync.is_active == True
            ).all()

            logger.info(f"Found {len(active_syncs)} active Kobo syncs to process")

            successful = 0
            partial = 0
            failed = 0

            for sync_config in active_syncs:
                questionnaire_id = sync_config.questionnaire_id
                org_id = sync_config.organization_id

                try:
                    logger.debug(f"Syncing questionnaire {questionnaire_id}")

                    start_time = datetime.utcnow()
                    sync_result = kobo_sync_scheduler.sync_questionnaire(
                        questionnaire_id
                    )
                    duration = (datetime.utcnow() - start_time).total_seconds()

                    status = sync_result.get('status', 'error')
                    responses_synced = sync_result.get('responses_synced', 0)
                    conflicts = sync_result.get('conflicts', 0)
                    errors = sync_result.get('errors', [])

                    # Log to history
                    log_sync_event(
                        questionnaire_id=questionnaire_id,
                        org_id=org_id,
                        status=status,
                        responses_synced=responses_synced,
                        conflicts=conflicts,
                        errors=errors,
                        duration_seconds=duration
                    )

                    if status == 'success':
                        successful += 1
                    elif status == 'partial':
                        partial += 1
                    else:
                        failed += 1

                    logger.info(
                        f"Sync completed for {questionnaire_id}: {status} "
                        f"({responses_synced} responses, {conflicts} conflicts, "
                        f"{len(errors)} errors)"
                    )

                except Exception as e:
                    failed += 1
                    logger.error(
                        f"Error syncing questionnaire {questionnaire_id}: {str(e)}",
                        exc_info=True
                    )

                    # Log the error
                    log_sync_event(
                        questionnaire_id=questionnaire_id,
                        org_id=org_id,
                        status='error',
                        responses_synced=0,
                        conflicts=0,
                        errors=[str(e)]
                    )

            logger.info(
                f"Background sync job completed: "
                f"{successful} successful, {partial} partial, {failed} failed"
            )

        except Exception as e:
            logger.error(
                f"Critical error in background sync job: {str(e)}",
                exc_info=True
            )


def start_background_scheduler(app):
    """
    Initialize and start APScheduler for background Kobo syncs
    Call this during Flask app initialization

    Usage in your Flask app initialization:
        from kobo_sync_orchestrator import start_background_scheduler
        start_background_scheduler(app)
    """
    global _scheduler

    if _scheduler is not None:
        logger.warning("Scheduler already running")
        return

    try:
        _scheduler = BackgroundScheduler(daemon=True)

        # Add job to run every 5 minutes
        _scheduler.add_job(
            func=sync_job_callback,
            trigger=IntervalTrigger(minutes=5),
            args=[app],
            id='kobo_sync_job',
            name='Kobo Sync Scheduler',
            replace_existing=True,
            coalesce=True,
            max_instances=1
        )

        _scheduler.start()
        logger.info("Background Kobo sync scheduler started (interval: 5 minutes)")

    except Exception as e:
        logger.error(f"Error starting background scheduler: {str(e)}", exc_info=True)
        raise


def stop_background_scheduler():
    """Stop the background scheduler"""
    global _scheduler

    if _scheduler is None:
        logger.warning("Scheduler not running")
        return

    try:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Background scheduler stopped")
    except Exception as e:
        logger.error(f"Error stopping scheduler: {str(e)}", exc_info=True)


# =============================================================================
# Error Handlers
# =============================================================================

@kobo_sync_bp.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    logger.warning(f"404 error for path {request.path}")
    return jsonify({'error': 'Endpoint not found'}), 404


@kobo_sync_bp.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 errors"""
    logger.warning(f"405 error for path {request.path}: {request.method}")
    return jsonify({'error': 'Method not allowed'}), 405


@kobo_sync_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {str(error)}", exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500


# =============================================================================
# Module Initialization
# =============================================================================

def init_kobo_sync(app):
    """
    Initialize Kobo sync orchestrator with Flask app
    Call this during application setup

    Usage:
        from kobo_sync_orchestrator import init_kobo_sync

        app = Flask(__name__)
        app.config['JWT_SECRET_KEY'] = 'your-secret-key'

        init_kobo_sync(app)
        app.register_blueprint(kobo_sync_bp)
    """
    app.register_blueprint(kobo_sync_bp)
    start_background_scheduler(app)

    logger.info("Kobo sync orchestrator initialized")


# Export public API
__all__ = [
    'kobo_sync_bp',
    'init_kobo_sync',
    'start_background_scheduler',
    'stop_background_scheduler',
    'require_auth',
    'verify_org_access'
]
