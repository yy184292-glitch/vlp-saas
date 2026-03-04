from slowapi import Limiter
from slowapi.util import get_remote_address

# シングルトン limiter - main.py と routes/*.py 双方で共有
limiter = Limiter(key_func=get_remote_address)
