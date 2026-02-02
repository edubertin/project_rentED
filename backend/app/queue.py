import os
from typing import Callable, Optional

from redis import Redis
from rq import Queue


def get_redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://redis:6379/0")


def get_queue() -> Queue:
    redis_url = get_redis_url()
    return Queue(connection=Redis.from_url(redis_url))


def is_inline_mode() -> bool:
    return os.getenv("QUEUE_MODE", "redis").lower() == "inline"


def try_enqueue(func: Callable, *args) -> Optional[str]:
    if is_inline_mode():
        return None
    queue = get_queue()
    job = queue.enqueue(func, *args)
    return job.id
