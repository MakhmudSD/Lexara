"""Tests for workspace name validation helper."""
import pytest
from app.core.exceptions import AppError
from app.routes.workspaces import _validate_workspace_name


class TestValidateWorkspaceName:
    def test_valid_name(self):
        assert _validate_workspace_name("valid-name") == "valid-name"

    def test_strips_whitespace(self):
        assert _validate_workspace_name("  padded  ") == "padded"

    def test_minimum_length(self):
        assert _validate_workspace_name("ab") == "ab"

    def test_maximum_length(self):
        name = "a" * 40
        assert _validate_workspace_name(name) == name

    def test_too_short_raises(self):
        with pytest.raises(AppError) as exc_info:
            _validate_workspace_name("x")
        assert exc_info.value.status_code == 400
        assert exc_info.value.code == "invalid_workspace_name"

    def test_too_long_raises(self):
        with pytest.raises(AppError):
            _validate_workspace_name("a" * 41)

    @pytest.mark.parametrize("char", ['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
    def test_forbidden_chars_raise(self, char):
        with pytest.raises(AppError):
            _validate_workspace_name(f"bad{char}name")

    def test_whitespace_only_raises(self):
        with pytest.raises(AppError):
            _validate_workspace_name("   ")

    def test_unicode_allowed(self):
        assert _validate_workspace_name("проект-альфа") == "проект-альфа"
