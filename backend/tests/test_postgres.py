import os
import secrets

import pytest
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.core.database import engine
from app.models.account import Account
from app.repositories import accounts
from app.services.identity import STEAM_BASE


@pytest.mark.skipif(os.getenv('RUN_POSTGRES_TESTS') != '1', reason='Requires migrated PostgreSQL; set RUN_POSTGRES_TESTS=1')
def test_postgres_schema_and_transactional_account_lifecycle():
    assert engine.dialect.name == 'postgresql'
    assert {'accounts', 'sessions', 'login_states', 'alembic_version'} <= set(inspect(engine).get_table_names())
    with engine.connect() as connection:
        outer = connection.begin()
        try:
            with Session(bind=connection, join_transaction_mode='create_savepoint') as db:
                state = accounts.create_login_state(db)
                assert accounts.consume_login_state(db, state)
                assert not accounts.consume_login_state(db, state)
                steam_id = STEAM_BASE + secrets.randbelow(4294967294) + 1
                token = accounts.create_session(db, steam_id)
                assert accounts.find_session(db, token).steam_id == steam_id
                accounts.remove_account(db, steam_id)
                assert accounts.find_session(db, token) is None
        finally:
            # Even repository commits remain inside the outer transaction/savepoints.
            outer.rollback()


@pytest.mark.skipif(os.getenv('RUN_POSTGRES_TESTS') != '1', reason='Requires migrated PostgreSQL; set RUN_POSTGRES_TESTS=1')
def test_concurrent_first_logins_share_an_account():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    steam_id = STEAM_BASE + secrets.randbelow(4294967294) + 1
    with Session(engine) as db:
        if db.get(Account, steam_id) is not None:
            pytest.skip('Random integration-test ID already exists; no user record was changed.')
    gate = Barrier(2)
    def login():
        with Session(engine) as db:
            gate.wait(timeout=10)
            return accounts.create_session(db, steam_id)
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            first = executor.submit(login)
            second = executor.submit(login)
            tokens = [first.result(timeout=20), second.result(timeout=20)]
        assert tokens[0] != tokens[1]
        with Session(engine) as db:
            assert all(accounts.find_session(db, token).steam_id == steam_id for token in tokens)
    finally:
        with Session(engine) as db:
            accounts.remove_account(db, steam_id)
