"""Interactive bootstrap never puts credentials into output or command arguments."""

import warnings
from contextlib import nullcontext
from unittest.mock import Mock

import pytest

from app import cli


def _inputs(monkeypatch, password="private-password", confirmation="private-password"):
    inputs = iter([" admin ", " 管理者 "])
    monkeypatch.setattr("builtins.input", lambda _: next(inputs))
    passwords = iter([password, confirmation])
    getpass = Mock(side_effect=lambda _: next(passwords))
    monkeypatch.setattr(cli.getpass, "getpass", getpass)
    return getpass


def test_create_admin_uses_hidden_confirmation_and_service(monkeypatch, capsys):
    getpass = _inputs(monkeypatch)
    session = Mock()
    monkeypatch.setattr(cli, "get_session_factory", lambda: lambda: nullcontext(session))
    service = Mock()
    monkeypatch.setattr(cli, "build_auth_service", lambda *args: service)
    assert cli.main(["create-admin"]) == 0
    assert getpass.call_count == 2
    service.bootstrap_admin.assert_called_once_with(
        username="admin", name="管理者", password="private-password"
    )
    captured = capsys.readouterr()
    assert "private-password" not in captured.out + captured.err


@pytest.mark.parametrize(
    "password,confirmation", [("private-password", "different-password"), ("short", "short")]
)
def test_invalid_confirmation_or_password_does_not_write(
    monkeypatch, capsys, password, confirmation
):
    _inputs(monkeypatch, password, confirmation)
    database = Mock()
    monkeypatch.setattr(cli, "get_session_factory", database)
    assert cli.main(["create-admin"]) == 1
    database.assert_not_called()
    captured = capsys.readouterr()
    assert password not in captured.out + captured.err


def test_getpass_fallback_aborts_before_reading_or_writing(monkeypatch, capsys):
    _inputs(monkeypatch)

    def unsafe_getpass(_):
        warnings.warn("fallback", cli.getpass.GetPassWarning, stacklevel=2)
        pytest.fail("warning must abort before echoed input")

    monkeypatch.setattr(cli.getpass, "getpass", unsafe_getpass)
    database = Mock()
    monkeypatch.setattr(cli, "get_session_factory", database)
    assert cli.main(["create-admin"]) == 1
    database.assert_not_called()
    captured = capsys.readouterr()
    assert "無法隱藏密碼輸入" in captured.err
    assert "private-password" not in captured.out + captured.err
