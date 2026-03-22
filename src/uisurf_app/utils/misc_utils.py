from urllib.parse import urljoin, urlparse, urlunparse


def get_remote_agents_base_url_from_vnc(vnc_url: str | None) -> str | None:
    """
    Extract the base A2A URL from a VNC URL.

    Example:
        http://host:6080/vnc.html  ->  http://host:6080/
    """
    if not vnc_url:
        return None

    parsed = urlparse(vnc_url)

    if not parsed.scheme or not parsed.netloc:
        return None

    base_path = parsed.path or "/"

    # Remove VNC entry point
    if base_path.endswith("/vnc.html"):
        base_path = base_path[: -len("/vnc.html")]
    elif base_path.endswith("vnc.html"):
        base_path = base_path[: -len("vnc.html")]

    # Normalize to root or cleaned base
    base_path = base_path.rstrip("/") + "/"

    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            base_path,
            "",
            "",
            "",
        )
    )


def get_remote_agent_url_from_vnc(vnc_url: str | None, agent_name: str) -> str | None:
    base_url = get_remote_agents_base_url_from_vnc(vnc_url=vnc_url)
    if not base_url:
        return None

    normalized_agent_name = agent_name.strip("/")
    if not normalized_agent_name:
        return base_url

    return urljoin(base_url, f"{normalized_agent_name}/")


def get_remote_browser_agent_url_from_vnc(vnc_url: str | None) -> str | None:
    return get_remote_agent_url_from_vnc(vnc_url=vnc_url, agent_name="browser")


def get_remote_desktop_agent_url_from_vnc(vnc_url: str | None) -> str | None:
    return get_remote_agent_url_from_vnc(vnc_url=vnc_url, agent_name="desktop")
