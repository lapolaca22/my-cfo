"""
Entry point for the CFO Finance Automation System.

Usage:
    python main.py                      # run full daily cycle
    python main.py --cycle monthly      # run month-end closing
    python main.py --cycle ap           # run AP Agent only
    python main.py --cycle ar           # run AR Agent only
    python main.py --period 2026-02     # specify period for monthly close

Environment:
    Copy .env.example to .env and fill in your credentials before running.
"""

import argparse
import logging
import sys
from pathlib import Path

# ── Ensure the project root is on sys.path when running directly ──────────
sys.path.insert(0, str(Path(__file__).parent))

from config import load_config
from orchestrator import Orchestrator

# ── Logging setup ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="CFO Finance Automation System",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--cycle",
        choices=["daily", "monthly", "ap", "ar"],
        default="daily",
        help="Which automation cycle to run.",
    )
    parser.add_argument(
        "--period",
        default=None,
        help="Period for monthly close, format: YYYY-MM (default: previous month).",
    )
    parser.add_argument(
        "--recipients",
        default=None,
        help="Comma-separated report recipient emails (overrides config).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    logger.info("Starting CFO Finance Automation System")
    logger.info("Cycle: %s | Period: %s", args.cycle, args.period or "auto")

    try:
        config = load_config()
    except EnvironmentError as exc:
        logger.error("Configuration error: %s", exc)
        logger.error(
            "Tip: copy .env.example to .env and fill in your credentials, "
            "or set the required environment variables."
        )
        sys.exit(1)

    recipients = (
        [r.strip() for r in args.recipients.split(",") if r.strip()]
        if args.recipients
        else None
    )

    orchestrator = Orchestrator(config)

    if args.cycle == "daily":
        orchestrator.run_daily(report_recipients=recipients)
    elif args.cycle == "monthly":
        orchestrator.run_monthly_close(period=args.period, report_recipients=recipients)
    elif args.cycle == "ap":
        orchestrator.run_ap_only()
    elif args.cycle == "ar":
        orchestrator.run_ar_only()

    logger.info("CFO Finance Automation System completed successfully")


if __name__ == "__main__":
    main()
