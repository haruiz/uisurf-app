from __future__ import annotations

import json
import logging
from typing import AsyncGenerator
from urllib.parse import urlparse, urlunparse

from a2a.client.client import ClientConfig as A2AClientConfig
from a2a.client.client_factory import ClientFactory as A2AClientFactory
from a2a.types import TransportProtocol as A2ATransport
from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.agents.remote_a2a_agent import (
    AGENT_CARD_WELL_KNOWN_PATH,
    RemoteA2aAgent,
)
from google.adk.events.event import Event
from google.adk.events.event_actions import EventActions
from google.adk.utils.context_utils import Aclosing
from google.genai import types as genai_types

from uisurf_app.core.config import get_settings

logger = logging.getLogger(__name__)

WEB_BROWSER_AGENT_NAME = "web_browser_agent"
DESKTOP_AGENT_NAME = "desktop_agent"

PLANNING_AGENT_NAME = "planning_agent"
AUTOMATION_AGENT_NAME = "automation_agent"
SUMMARIZATION_AGENT_NAME = "summarization_agent"

TASK_PLAN_STATE_KEY = "task_plan"
AUTOMATION_REPORT_STATE_KEY = "automation_report"
FINAL_RESPONSE_STATE_KEY = "final_response"


def _resolve_live_agent_model() -> str:
    settings = get_settings()
    configured_model = settings.live_agent_model
    if "native-audio" in configured_model:
        text_model = settings.live_agent_text_model
        logger.info(
            "Using text live model %s instead of audio-native model %s for websocket text chat",
            text_model,
            configured_model,
        )
        return text_model
    return configured_model


def _build_a2a_url(vnc_url: str | None, path: str) -> str | None:
    if not vnc_url:
        return None
    parsed = urlparse(vnc_url)
    if not parsed.scheme or not parsed.netloc:
        return None
    base_path = parsed.path or "/"
    if base_path.endswith("/vnc.html"):
        base_path = base_path[: -len("/vnc.html")]
    elif base_path.endswith("vnc.html"):
        base_path = base_path[: -len("vnc.html")]
    agent_path = f"{base_path.rstrip('/')}/{path.strip('/')}/"
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            agent_path,
            "",
            "",
            "",
        )
    )


def _build_remote_ui_agents(vnc_url: str | None) -> list[RemoteA2aAgent]:
    remote_agents: list[RemoteA2aAgent] = []
    a2a_client_factory = A2AClientFactory(
        config=A2AClientConfig(
            streaming=True,
            polling=False,
            supported_transports=[A2ATransport.jsonrpc],
        )
    )

    browser_a2a_url = _build_a2a_url(vnc_url, "browser")
    if browser_a2a_url:
        remote_agents.append(
            RemoteA2aAgent(
                name=WEB_BROWSER_AGENT_NAME,
                description=(
                    "Specialized browser automation agent for interacting with websites and web applications. "
                    "Use this agent for tasks such as opening pages, searching the web, clicking elements, "
                    "filling forms, navigating multi-step workflows, and extracting information from browser-based interfaces."
                ),
                agent_card=f"{browser_a2a_url.rstrip('/')}{AGENT_CARD_WELL_KNOWN_PATH}",
                a2a_client_factory=a2a_client_factory,
            )
        )

    desktop_a2a_url = _build_a2a_url(vnc_url, "desktop")
    if desktop_a2a_url:
        remote_agents.append(
            RemoteA2aAgent(
                name=DESKTOP_AGENT_NAME,
                description=(
                    "Specialized desktop automation agent for interacting with native desktop environments. "
                    "Use this agent for tasks such as opening desktop applications, clicking UI elements, "
                    "typing text, navigating system dialogs, and completing multi-step workflows outside the browser."
                ),
                agent_card=f"{desktop_a2a_url.rstrip('/')}{AGENT_CARD_WELL_KNOWN_PATH}",
                a2a_client_factory=a2a_client_factory,
            )
        )

    return remote_agents


def _build_tool_availability_summary(remote_agents: list[RemoteA2aAgent]) -> str:
    available_agents = {agent.name for agent in remote_agents}
    lines = ["Available UI automation agents:"]

    if WEB_BROWSER_AGENT_NAME in available_agents:
        lines.append("- web_browser_agent: available for websites and browser-based applications.")
    else:
        lines.append("- web_browser_agent: unavailable in this session.")

    if DESKTOP_AGENT_NAME in available_agents:
        lines.append("- desktop_agent: available for native desktop applications and OS dialogs.")
    else:
        lines.append("- desktop_agent: unavailable in this session.")

    lines.append("- Never claim to have used an unavailable agent.")
    return "\n".join(lines)


class OrchestratedAutomationAgent(BaseAgent):
    task_plan_state_key: str = TASK_PLAN_STATE_KEY
    automation_report_state_key: str = AUTOMATION_REPORT_STATE_KEY

    async def _run_async_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        task_plan = self._read_state_text(ctx, self.task_plan_state_key)
        user_request = self._extract_latest_user_request(ctx)
        execution_sequence = self._resolve_execution_sequence(task_plan, user_request)

        execution_summaries: list[tuple[str, str]] = []
        if not execution_sequence:
            report = self._build_report(
                user_request=user_request,
                execution_summaries=[],
                note="No browser or desktop execution was required for this task.",
            )
            yield self._build_report_event(ctx, report)
            return

        queue = list(execution_sequence)
        index = 0
        while index < len(queue):
            agent_name = queue[index]
            sub_agent = self.find_sub_agent(agent_name)
            if sub_agent is None:
                execution_summaries.append(
                    (agent_name, f"Error: required sub-agent `{agent_name}` is unavailable.")
                )
                index += 1
                continue

            handoff_event = await self._append_stage_handoff_event(
                ctx,
                agent_name=agent_name,
                user_request=user_request,
                task_plan=task_plan,
                execution_summaries=execution_summaries,
            )
            start_index = len(ctx.session.events)
            try:
                async with Aclosing(sub_agent.run_async(ctx)) as agen:
                    async for event in agen:
                        yield event
                        if ctx.should_pause_invocation(event):
                            return
            finally:
                self._remove_internal_event(ctx, handoff_event)

            agent_summary = self._summarize_sub_agent_events(ctx, start_index, agent_name)
            execution_summaries.append((agent_name, agent_summary))
            self._append_follow_up_stage(
                queue,
                completed_agent_name=agent_name,
                task_plan=task_plan,
                user_request=user_request,
                latest_summary=agent_summary,
            )
            index += 1

        report = self._build_report(
            user_request=user_request,
            execution_summaries=execution_summaries,
        )
        yield self._build_report_event(ctx, report)

    async def _run_live_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        async with Aclosing(self._run_async_impl(ctx)) as agen:
            async for event in agen:
                yield event

    def _resolve_execution_sequence(self, task_plan: str, user_request: str) -> list[str]:
        if "no ui automation is required" in task_plan.lower():
            return []

        available_agent_names = {agent.name for agent in self.sub_agents}
        sequence: list[str] = []
        for line in task_plan.splitlines():
            for agent_name in (WEB_BROWSER_AGENT_NAME, DESKTOP_AGENT_NAME):
                if agent_name not in available_agent_names:
                    continue
                if agent_name in line and (not sequence or sequence[-1] != agent_name):
                    sequence.append(agent_name)

        if sequence:
            return sequence

        lowered = f"{task_plan}\n{user_request}".lower()
        browser_keywords = ("browser", "web", "website", "page", "url", "search", "form", "site")
        desktop_keywords = (
            "desktop",
            "app",
            "application",
            "folder",
            "file",
            "download",
            "save",
            "terminal",
            "dialog",
            "window",
            "native",
        )

        if WEB_BROWSER_AGENT_NAME in available_agent_names and any(
            keyword in lowered for keyword in browser_keywords
        ):
            sequence.append(WEB_BROWSER_AGENT_NAME)
        if DESKTOP_AGENT_NAME in available_agent_names and any(
            keyword in lowered for keyword in desktop_keywords
        ):
            if not sequence or sequence[-1] != DESKTOP_AGENT_NAME:
                sequence.append(DESKTOP_AGENT_NAME)

        if not sequence:
            if WEB_BROWSER_AGENT_NAME in available_agent_names:
                sequence.append(WEB_BROWSER_AGENT_NAME)
            elif DESKTOP_AGENT_NAME in available_agent_names:
                sequence.append(DESKTOP_AGENT_NAME)
        elif (
            sequence == [WEB_BROWSER_AGENT_NAME]
            and self._should_run_desktop_after_browser(task_plan, user_request, "")
            and DESKTOP_AGENT_NAME in available_agent_names
        ):
            sequence.append(DESKTOP_AGENT_NAME)

        return sequence

    async def _append_stage_handoff_event(
        self,
        ctx: InvocationContext,
        *,
        agent_name: str,
        user_request: str,
        task_plan: str,
        execution_summaries: list[tuple[str, str]],
    ) -> Event:
        handoff_text = self._build_stage_handoff_text(
            agent_name=agent_name,
            user_request=user_request,
            task_plan=task_plan,
            execution_summaries=execution_summaries,
        )
        handoff_event = Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            branch=ctx.branch,
            content=genai_types.Content(
                role="model",
                parts=[genai_types.Part(text=handoff_text)],
            ),
            custom_metadata={
                "internal_handoff": True,
                "target_agent": agent_name,
            },
        )
        return await ctx.session_service.append_event(ctx.session, handoff_event)

    def _build_stage_handoff_text(
        self,
        *,
        agent_name: str,
        user_request: str,
        task_plan: str,
        execution_summaries: list[tuple[str, str]],
    ) -> str:
        prior_steps = ["None yet."]
        if execution_summaries:
            prior_steps = [
                f"- {completed_agent_name}: {summary}"
                for completed_agent_name, summary in execution_summaries
            ]

        stage_guidance = [
            f"You are now executing the `{agent_name}` stage of a multi-stage UI automation workflow.",
            "Complete only the work that belongs to your environment.",
        ]
        if agent_name == WEB_BROWSER_AGENT_NAME:
            stage_guidance.extend(
                [
                    "Handle website and browser-based steps only.",
                    "If the task will continue on the desktop, leave the workflow in a clear handoff state and report what the desktop stage should do next.",
                    "Do not claim native desktop actions were completed.",
                ]
            )
        elif agent_name == DESKTOP_AGENT_NAME:
            stage_guidance.extend(
                [
                    "Continue from the browser stage output when relevant.",
                    "Handle native applications, OS dialogs, downloads, and filesystem steps.",
                    "Do not repeat browser work unless it is strictly necessary to complete the task.",
                ]
            )

        lines = [
            *stage_guidance,
            "",
            "Overall user request:",
            user_request or "No user request was captured.",
            "",
            "Planner handoff:",
            task_plan or "No task plan was captured.",
            "",
            "Completed stages so far:",
            *prior_steps,
            "",
            "When you finish, clearly describe what you completed and what remains.",
        ]
        return "\n".join(lines)

    def _append_follow_up_stage(
        self,
        queue: list[str],
        *,
        completed_agent_name: str,
        task_plan: str,
        user_request: str,
        latest_summary: str,
    ) -> None:
        available_agent_names = {agent.name for agent in self.sub_agents}
        if (
            completed_agent_name == WEB_BROWSER_AGENT_NAME
            and DESKTOP_AGENT_NAME in available_agent_names
            and DESKTOP_AGENT_NAME not in queue
            and self._should_run_desktop_after_browser(task_plan, user_request, latest_summary)
        ):
            queue.append(DESKTOP_AGENT_NAME)

    def _should_run_desktop_after_browser(
        self,
        task_plan: str,
        user_request: str,
        latest_summary: str,
    ) -> bool:
        lowered = f"{task_plan}\n{user_request}\n{latest_summary}".lower()

        explicit_desktop_signals = (
            DESKTOP_AGENT_NAME,
            "desktop_agent",
            "desktop",
            "native app",
            "native application",
            "system dialog",
            "file picker",
            "save dialog",
            "download",
            "downloads",
            "folder",
            "filesystem",
            "terminal",
        )
        return any(signal in lowered for signal in explicit_desktop_signals)

    def _remove_internal_event(self, ctx: InvocationContext, event: Event) -> None:
        try:
            ctx.session.events.remove(event)
        except ValueError:
            logger.debug("Internal handoff event was not present when cleanup ran.")

    def _summarize_sub_agent_events(
        self,
        ctx: InvocationContext,
        start_index: int,
        agent_name: str,
    ) -> str:
        new_events = ctx.session.events[start_index:]
        error_messages = [
            event.error_message
            for event in new_events
            if event.author == agent_name and event.error_message
        ]
        if error_messages:
            return f"Error: {error_messages[-1]}"

        text_snippets: list[str] = []
        for event in new_events:
            if event.author != agent_name or not event.content or not event.content.parts:
                continue
            for part in event.content.parts:
                if not part.text or part.thought:
                    continue
                normalized = self._normalize_text_snippet(part.text)
                if normalized and (not text_snippets or text_snippets[-1] != normalized):
                    text_snippets.append(normalized)

        if text_snippets:
            return text_snippets[-1]
        return "Completed without a usable text summary."

    def _normalize_text_snippet(self, text: str) -> str:
        stripped = text.strip()
        if not stripped:
            return ""

        try:
            payload = json.loads(stripped)
        except json.JSONDecodeError:
            return stripped

        if isinstance(payload, dict):
            event_payload = payload.get("payload")
            if isinstance(event_payload, dict):
                if isinstance(event_payload.get("text"), str):
                    return event_payload["text"].strip()
                if isinstance(event_payload.get("response"), str):
                    return event_payload["response"].strip()
            if isinstance(payload.get("error_message"), str):
                return f"Error: {payload['error_message'].strip()}"

        return stripped

    def _build_report(
        self,
        *,
        user_request: str,
        execution_summaries: list[tuple[str, str]],
        note: str | None = None,
    ) -> str:
        blockers = [
            f"{agent_name}: {summary}"
            for agent_name, summary in execution_summaries
            if summary.lower().startswith("error:")
        ]

        lines = [
            "## Objective",
            user_request or "Complete the user's request.",
            "",
            "## Actions Taken",
        ]

        if execution_summaries:
            for agent_name, summary in execution_summaries:
                lines.append(f"- {agent_name}: {summary}")
        else:
            lines.append(f"- {note or 'No UI automation steps were executed.'}")

        lines.extend(
            [
                "",
                "## Outcome",
                (
                    "Execution completed for all invoked automation stages."
                    if not blockers
                    else "Execution was only partially completed."
                ),
                "",
                "## Blockers",
            ]
        )

        if blockers:
            lines.extend(f"- {blocker}" for blocker in blockers)
        else:
            lines.append("- None.")

        lines.extend(
            [
                "",
                "## Next Step",
                (
                    "Summarize the completed work for the user."
                    if not blockers
                    else "Explain the blocker clearly and tell the user what remains to be done."
                ),
            ]
        )

        return "\n".join(lines)

    def _build_report_event(self, ctx: InvocationContext, report: str) -> Event:
        return Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            branch=ctx.branch,
            actions=EventActions(
                state_delta={self.automation_report_state_key: report}
            ),
        )

    def _read_state_text(self, ctx: InvocationContext, key: str) -> str:
        value = ctx.session.state.get(key)
        if value is None:
            return ""
        return str(value)

    def _extract_latest_user_request(self, ctx: InvocationContext) -> str:
        for event in reversed(ctx.session.events):
            if event.author != "user" or not event.content or not event.content.parts:
                continue
            text = "\n".join(part.text for part in event.content.parts if part.text)
            if text.strip():
                return text.strip()
        return ""


def get_uisurf_agent(vnc_url: str | None) -> SequentialAgent:
    model = _resolve_live_agent_model()
    remote_agents = _build_remote_ui_agents(vnc_url)
    tool_availability_summary = _build_tool_availability_summary(remote_agents)

    planning_agent = LlmAgent(
        name=PLANNING_AGENT_NAME,
        model=model,
        description="Creates a detailed execution plan for the user's task before any UI automation runs.",
        instruction=(
            "You are the planning stage in a deterministic UI automation workflow.\n\n"
            f"{tool_availability_summary}\n\n"
            "Read the user's latest request and create a detailed internal plan for how to complete it.\n"
            "The plan must be action-oriented and specific enough for another agent to execute.\n\n"
            "Your plan must include:\n"
            "1. Objective\n"
            "2. Assumptions or missing information\n"
            "3. Ordered execution steps\n"
            "4. Which agent to use for each step: web_browser_agent, desktop_agent, or no UI agent\n"
            "5. Success criteria\n\n"
            "Rules:\n"
            "- Prefer web_browser_agent for websites and browser-based applications.\n"
            "- Prefer desktop_agent for native desktop applications, system settings, and OS dialogs.\n"
            "- If a required agent is unavailable, call that out explicitly in the plan.\n"
            "- If the task is purely conversational, say no UI automation is required.\n"
            "- Do not claim any step has already been completed.\n"
            "- This is an internal handoff for the automation agent, not the final user-facing reply."
        ),
        output_key=TASK_PLAN_STATE_KEY,
    )
    automation_agent = OrchestratedAutomationAgent(
        name=AUTOMATION_AGENT_NAME,
        description="Executes the planner's task plan by orchestrating browser and desktop sub-agents in code.",
        sub_agents=remote_agents,
    )

    summarization_agent = LlmAgent(
        name=SUMMARIZATION_AGENT_NAME,
        model=model,
        description="Produces the final concise, friendly response for the user from the automation results.",
        instruction=(
            "You are the final user-facing summarization stage.\n\n"
            "Internal task plan:\n"
            f"{TASK_PLAN_STATE_KEY}: {{{TASK_PLAN_STATE_KEY}?}}\n\n"
            "Automation report:\n"
            f"{AUTOMATION_REPORT_STATE_KEY}: {{{AUTOMATION_REPORT_STATE_KEY}?}}\n\n"
            "Write a friendly, concise Markdown response for the user that:\n"
            "- summarizes what was done,\n"
            "- states the result clearly,\n"
            "- mentions blockers or limitations when present,\n"
            "- gives the next step when the task is not fully complete.\n\n"
            "Rules:\n"
            "- Be clear, warm, and concise.\n"
            "- Do not expose the internal plan verbatim unless it materially helps the user.\n"
            "- Do not expose raw tool output, protocol messages, JSON, or traces.\n"
            "- Never say something was completed unless the automation report shows that it actually happened.\n"
            "- If the automation report is empty, explain that the execution stage did not return a usable report."
        ),
        output_key=FINAL_RESPONSE_STATE_KEY,
    )

    return SequentialAgent(
        name="root_agent",
        sub_agents=[
            planning_agent,
            automation_agent,
            summarization_agent,
        ],
    )
