import asyncio
import time
from ipaddress import ip_address
from collections import OrderedDict, deque


def client_key(request, source: str) -> str:
    peer = request.client.host if request.client else 'unknown'
    if source == 'railway':
        # Explicit deployment opt-in. Only Railway HTTP ingress may reach this service.
        # Do not parse client-supplied X-Forwarded-For chains or use this for authentication.
        values = request.headers.getlist('x-real-ip')
        if len(values) == 1:
            try:
                return str(ip_address(values[0]))
            except ValueError:
                pass
    return peer


class RateLimiter:
    """Single-process sliding window; no forwarded IP headers are trusted."""
    def __init__(self, limit: int, max_clients: int = 10000):
        self.limit = limit
        self.clients: OrderedDict[str, deque] = OrderedDict()
        self.max_clients = max_clients

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        entries = self.clients.setdefault(key, deque())
        self.clients.move_to_end(key)
        while entries and entries[0] <= now - 60:
            entries.popleft()
        allowed = len(entries) < self.limit
        if allowed:
            entries.append(now)
        while len(self.clients) > self.max_clients:
            self.clients.popitem(last=False)
        return allowed


class ResponseCache:
    def __init__(self, ttl: int, max_entries: int = 512):
        self.ttl = ttl
        self.max_entries = max_entries
        self.entries: OrderedDict[str, tuple] = OrderedDict()
        self.lock = asyncio.Lock()

    async def get_or_load(self, key, loader):
        # A slow unrelated miss must not block already cached Dashboard/Meta data.
        cached = self.entries.get(key)
        if cached and cached[0] > time.monotonic():
            self.entries.move_to_end(key)
            return cached[1]
        # Coalesce loads and bound upstream concurrency for the single-process deployment.
        async with self.lock:
            cached = self.entries.get(key)
            if cached and cached[0] > time.monotonic():
                self.entries.move_to_end(key)
                return cached[1]
            value = await loader()
            self.entries[key] = (time.monotonic() + self.ttl, value)
            self.entries.move_to_end(key)
            while len(self.entries) > self.max_entries:
                self.entries.popitem(last=False)
            return value
