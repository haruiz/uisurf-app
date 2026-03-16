from __future__ import annotations

import argparse
import sys

from firebase_admin import auth

from uisurf_app.core.firebase import get_firebase_app


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create or update a Firebase test user for UISurf local development.",
    )
    parser.add_argument("--email", required=True, help="Email address for the test user.")
    parser.add_argument("--password", required=True, help="Password for the test user.")
    parser.add_argument(
        "--display-name",
        default="UISurf Test User",
        help="Display name to assign to the user.",
    )
    parser.add_argument(
        "--admin",
        action="store_true",
        help="Grant the Firebase custom claim `admin=true` to the user.",
    )
    parser.add_argument(
        "--update-if-exists",
        action="store_true",
        help="Update the existing user instead of failing when the email already exists.",
    )
    return parser


def upsert_user(
    *,
    email: str,
    password: str,
    display_name: str,
    update_if_exists: bool,
) -> tuple[auth.UserRecord, bool]:
    app = get_firebase_app()

    try:
        user = auth.create_user(
            app=app,
            email=email,
            password=password,
            display_name=display_name,
            email_verified=True,
        )
        return user, True
    except auth.EmailAlreadyExistsError:
        if not update_if_exists:
            raise

        existing_user = auth.get_user_by_email(email, app=app)
        user = auth.update_user(
            existing_user.uid,
            app=app,
            password=password,
            display_name=display_name,
            email_verified=True,
        )
        return user, False


def set_admin_claims(user: auth.UserRecord) -> None:
    app = get_firebase_app()
    auth.set_custom_user_claims(user.uid, {"admin": True}, app=app)


def create_admin_user(
    *,
    email: str,
    password: str,
    display_name: str,
    update_if_exists: bool,
) -> tuple[auth.UserRecord, bool]:
    user, created = upsert_user(
        email=email,
        password=password,
        display_name=display_name,
        update_if_exists=update_if_exists,
    )
    set_admin_claims(user)
    return user, created


def main() -> int:
    args = build_parser().parse_args()

    try:
        if args.admin:
            user, created = create_admin_user(
                email=args.email,
                password=args.password,
                display_name=args.display_name,
                update_if_exists=args.update_if_exists,
            )
        else:
            user, created = upsert_user(
                email=args.email,
                password=args.password,
                display_name=args.display_name,
                update_if_exists=args.update_if_exists,
            )
    except auth.EmailAlreadyExistsError:
        print(
            (
                f"User {args.email} already exists. "
                "Re-run with --update-if-exists to update the account."
            ),
            file=sys.stderr,
        )
        return 1

    action = "Created" if created else "Updated"
    print(f"{action} Firebase user: {user.email} (uid={user.uid})")
    print(f"Admin claims enabled: {'yes' if args.admin else 'no'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
