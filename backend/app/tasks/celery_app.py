from celery import Celery

from app.config import settings

celery_app = Celery("herbal_hub", broker=settings.REDIS_URL, backend=settings.REDIS_URL, include=["app.tasks.payout_tasks"])
celery_app.conf.update(
    task_serializer="json", result_serializer="json", accept_content=["json"], timezone="Asia/Colombo",
    task_acks_late=True, worker_prefetch_multiplier=1,
    beat_schedule={"process-pending-payouts": {"task": "payouts.process_pending", "schedule": 60.0}},
)
