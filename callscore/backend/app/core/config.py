"""
App configuration. Loaded from environment - see .env.example.

data residency note (Bible Part 5.4): DATABASE_URL should be selected per
organization.region in a multi-region deployment, not a single global value.
This single-value config is the MVP starting point only.
"""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
CONSENT_ENCRYPTION_KEY = os.getenv("CONSENT_ENCRYPTION_KEY")

# Late-start / early-stop detection threshold (Bible Part 6.5): a gap
# between Device 1's BLE-reported call state and CallScore's own
# Start/Stop timestamps larger than this flags the session for review.
TIMING_DISCREPANCY_THRESHOLD_SECONDS = int(
    os.getenv("TIMING_DISCREPANCY_THRESHOLD_SECONDS", "90")
)
