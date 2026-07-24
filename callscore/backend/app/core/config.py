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
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
# Spitch — Nigerian-language STT specialist (Yoruba/Igbo/Hausa/Nigerian
# English). Endpoint kept configurable because their API is young; verify
# against docs.spitch.app when the key is provisioned.
SPITCH_API_KEY = os.getenv("SPITCH_API_KEY")
SPITCH_API_URL = os.getenv("SPITCH_API_URL", "https://api.spi-tch.com/v1/transcriptions")
SPITCH_LANGUAGE = os.getenv("SPITCH_LANGUAGE", "en")  # en|yo|ig|ha per Spitch codes

# Intron Sahara — African-accent STT (500+ accents, 57 languages,
# benchmarked above the global engines on African speech). Endpoint
# configurable: their API is enterprise-provisioned; confirm the exact
# URL/shape with the key at intron.io.
INTRON_API_KEY = os.getenv("INTRON_API_KEY")
INTRON_API_URL = os.getenv("INTRON_API_URL", "https://api.intron.io/v1/transcribe")
CONSENT_ENCRYPTION_KEY = os.getenv("CONSENT_ENCRYPTION_KEY")

# Late-start / early-stop detection threshold (Bible Part 6.5): a gap
# between Device 1's BLE-reported call state and CallScore's own
# Start/Stop timestamps larger than this flags the session for review.
TIMING_DISCREPANCY_THRESHOLD_SECONDS = int(
    os.getenv("TIMING_DISCREPANCY_THRESHOLD_SECONDS", "90")
)

# Near-duplicate transcript threshold for the Similarity & Fabrication
# agent (Bible 4.2 Tier 3): sequence-similarity ratio above this against a
# prior interview raises a 'similarity' finding.
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.7"))
