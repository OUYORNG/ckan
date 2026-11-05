"""Serve the React portal using CKAN's own users, sessions, and authorization."""

from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_wtf.csrf import generate_csrf, validate_csrf
from wtforms.validators import ValidationError as CsrfError

import ckan.plugins as plugins
import ckan.plugins.toolkit as toolkit
from ckan.common import config, current_user, login_user, logout_user, session
from ckan.lib.authenticator import ckan_authenticator
from ckan.logic import NotAuthorized, NotFound, ValidationError
from ckan.views.user import regenerate_session, rotate_token


PUBLIC = Path(__file__).resolve().parent / "public"
READ_ACTIONS = {
    "package_search", "package_show", "resource_show", "organization_list",
    "organization_show", "organization_list_for_user", "group_list", "group_show",
    "license_list", "datastore_search", "status_show", "resource_view_list",
    "member_roles_list", "api_token_list",
}
WRITE_ACTIONS = {
    "package_create", "package_patch", "resource_create", "resource_update",
    "organization_create", "organization_patch", "organization_member_create",
    "organization_member_delete", "user_create", "user_update",
    "api_token_create", "api_token_revoke",
}


def context():
    return {"user": current_user.name, "auth_user_obj": current_user}


def permission(action, data=None):
    try:
        toolkit.check_access(action, context(), data or {})
        return True
    except (NotAuthorized, NotFound):
        return False


def error(message, status=400, details=None):
    return jsonify(success=False, error={"message": message, "details": details}), status


def safe_user(user):
    return {"id": user.id, "name": user.name, "fullname": user.fullname or user.name,
            "email": user.email, "sysadmin": bool(user.sysadmin)}


def session_data():
    user = safe_user(current_user) if current_user.is_authenticated else None
    organizations = []
    if user:
        organizations = toolkit.get_action("organization_list_for_user")(
            context(), {"permission": "read", "include_dataset_count": True})
    return {"user": user, "csrf_token": generate_csrf(), "organizations": organizations,
            "can_create_organizations": permission("organization_create"),
            "site_title": config.get("ckan.site_title", "NIS Data Portal")}


def protect_write():
    try:
        validate_csrf(request.headers.get("X-CSRFToken"))
    except CsrfError:
        return error("Your session has expired. Refresh the page and try again.", 400)
    return None


def shell():
    response = send_from_directory(PUBLIC, "index.html")
    response.headers["Cache-Control"] = "no-store"
    return response


def make_blueprint():
    blueprint = Blueprint("nis_portal", __name__)

    @blueprint.after_request
    def private_responses(response):
        if request.path.startswith("/portal/api/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Vary"] = "Cookie"
            response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @blueprint.before_app_request
    def react_pages():
        if request.method != "GET":
            return None
        path = request.path
        if "/download/" in path or "/resource/" in path and "/view/" in path:
            return None
        prefixes = ("/dataset", "/organization", "/group", "/dashboard", "/ckan-admin")
        exact = {"/", "/about", "/login", "/account", "/workspace", "/api-guide", "/user/login", "/user/me", "/user/logged_out_redirect", "/user/logged_in", "/user/logged_out", "/user/register", "/user/edit"}
        if path in exact or path.startswith("/user/edit/") or path.startswith("/user/") and path.endswith("/api-tokens") or any(path == prefix or path.startswith(prefix + "/") for prefix in prefixes):
            return shell()
        return None

    @blueprint.route("/portal/static/<path:filename>")
    def static_file(filename):
        return send_from_directory(PUBLIC, filename, max_age=31536000 if filename.startswith("assets/") else 3600)

    @blueprint.route("/portal/api/session")
    def get_session():
        return jsonify(success=True, result=session_data())

    @blueprint.route("/portal/api/login", methods=["POST"])
    def login():
        failure = protect_write()
        if failure:
            return failure
        data = request.get_json(silent=True) or {}
        if current_user.is_authenticated:
            return jsonify(success=True, result=session_data())
        user = ckan_authenticator({"login": data.get("login", ""), "password": data.get("password", "")})
        if not user:
            return error("The username or password is incorrect.", 401)
        regenerate_session()
        login_user(user)
        rotate_token()
        return jsonify(success=True, result=session_data())

    @blueprint.route("/portal/api/logout", methods=["POST"])
    def logout():
        failure = protect_write()
        if failure:
            return failure
        logout_user()
        session.pop(config.get("WTF_CSRF_FIELD_NAME", "csrf_token"), None)
        return jsonify(success=True, result=session_data())

    @blueprint.route("/portal/api/action/<action>", methods=["GET", "POST"])
    def action_api(action):
        if request.method == "GET":
            if action not in READ_ACTIONS:
                return error("This action requires a supported POST request.", 405)
            data = request.args.to_dict()
            for key in ("filters", "facet.field"):
                if key in data:
                    from json import loads
                    try:
                        data[key] = loads(data[key])
                    except ValueError:
                        return error("Invalid query parameters.")
        else:
            if action not in WRITE_ACTIONS:
                return error("This action is not available in the portal.", 404)
            failure = protect_write()
            if failure:
                return failure
            if not current_user.is_authenticated:
                return error("Sign in to make changes.", 403)
            if request.mimetype == "multipart/form-data":
                data = request.form.to_dict()
                data.update(request.files)
            else:
                data = request.get_json(silent=True) or {}
        try:
            result = toolkit.get_action(action)(context(), data)
            if action in {"user_create", "user_update"}:
                result = {key: result.get(key) for key in ("id", "name", "fullname", "email", "state")}
            return jsonify(success=True, result=result)
        except NotAuthorized:
            return error("You do not have permission to perform this action.", 403)
        except NotFound:
            return error("This item was not found or is not available to your account.", 404)
        except ValidationError as exception:
            return error("Please check the highlighted information and try again.", 409, exception.error_dict)
        except (ValueError, KeyError):
            return error("The request contains invalid information.")
        except Exception:
            current_app.logger.exception("NIS portal action failed: %s", action)
            return error("The request could not be completed. Please try again.", 500)

    @blueprint.route("/portal/api/organizations/<id>/members")
    def members(id):
        if not permission("group_edit_permissions", {"id": id}):
            return error("Organization administrator access is required.", 403)
        try:
            memberships = toolkit.get_action("member_list")(context(), {"id": id, "object_type": "user"})
            result = []
            for user_id, _, capacity in memberships:
                user = toolkit.get_action("user_show")(context(), {"id": user_id})
                result.append({"id": user["id"], "name": user["name"], "fullname": user.get("fullname") or user["name"], "capacity": capacity})
            return jsonify(success=True, result=result)
        except (NotFound, NotAuthorized):
            return error("The organization's members are not available.", 403)

    @blueprint.route("/portal/api/users")
    def users():
        if not current_user.is_authenticated or not current_user.sysadmin:
            return error("System administrator access is required.", 403)
        result = toolkit.get_action("user_list")(context(), {"q": request.args.get("q", ""), "all_fields": True})
        return jsonify(success=True, result=[{key: user.get(key) for key in ("id", "name", "fullname", "email", "sysadmin", "state")} for user in result])

    @blueprint.route("/portal/api/dataset/<id>/permissions")
    def dataset_permissions(id):
        try:
            toolkit.check_access("package_show", context(), {"id": id})
            return jsonify(success=True, result={"edit": permission("package_update", {"id": id})})
        except (NotAuthorized, NotFound):
            return error("This dataset is not available to your account.", 403)

    for path in ("/login", "/account", "/workspace", "/api-guide"):
        blueprint.add_url_rule(path, "page_" + path[1:].replace("-", "_"), shell)
    return blueprint


class NisPortalPlugin(plugins.SingletonPlugin):
    plugins.implements(plugins.IBlueprint)

    def get_blueprint(self):
        return make_blueprint()
