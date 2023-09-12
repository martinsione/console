import { theme } from "$/ui/theme";
import { Link, useParams } from "@solidjs/router";
import { styled } from "@macaron-css/solid";
import {
  Show,
  Switch,
  Match,
  ComponentProps,
  createResource,
  createMemo,
  createEffect,
  For,
} from "solid-js";
import { IconCheck, IconNoSymbol, IconViewfinderCircle } from "$/ui/icons";
import { IconArrowPathSpin } from "$/ui/icons/custom";
import { utility, Tag, Row, Stack, Text, Button, ButtonGroup } from "$/ui";
import { formatNumber, formatSinceTime, parseTime } from "$/common/format";
import { IssueCountStore, IssueStore } from "$/data/issue";
import { useReplicache } from "$/providers/replicache";
import { DateTime } from "luxon";
import { StackTrace } from "../logs/error";
import { useWorkspace } from "../../context";
import { bus } from "$/providers/bus";
import { LogStore, clearLogStore } from "$/data/log";
import {
  LogEntry,
  LogEntryTime,
  LogEntryMessage,
  LogMoreIndicator,
  LogMoreIndicatorIcon,
} from "../logs";
import { sumBy } from "remeda";

const Content = styled("div", {
  base: {
    flex: "1 1 auto",
  },
});

const Sidebar = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 300,
  },
});

const StackTraceBackground = styled("div", {
  base: {
    backgroundColor: theme.color.background.surface,
    borderRadius: theme.borderRadius,
    overflow: "hidden",
  },
});

const LogsBackground = styled("div", {
  base: {
    backgroundColor: theme.color.background.surface,
    borderRadius: theme.borderRadius,
    padding: `0 ${theme.space[5]}`,
  },
});

export const LogsLoading = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    padding: `${theme.space[5]} 0`,
  },
});

export const LogsLoadingIcon = styled("div", {
  base: {
    width: 16,
    height: 16,
    opacity: theme.iconOpacity,
    color: theme.color.text.dimmed.surface,
  },
});

const FunctionLink = styled(Link, {
  base: {
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_sm,
    lineHeight: theme.font.lineHeight,
  },
});

const ButtonIcon = styled("span", {
  base: {
    width: 14,
    height: 14,
    marginRight: 6,
    verticalAlign: -2,
    display: "inline-block",
    opacity: theme.iconOpacity,
  },
});

export function Detail() {
  const params = useParams();
  const rep = useReplicache();
  const issue = IssueStore.watch.get(rep, () => params.issueID);
  const status = createMemo(() => {
    if (issue()?.timeIgnored) return "ignored";
    if (issue()?.timeResolved) return "resolved";
    return "active";
  });
  createEffect(async () => {
    if (!issue()) return;
    const result = await fetch(
      import.meta.env.VITE_API_URL +
        "/rest/log?" +
        new URLSearchParams({
          pointer: JSON.stringify(issue()!.pointer),
          stageID: issue()!.stageID,
          groupID: issue()!.id,
        }),
      {
        headers: {
          authorization: rep().auth,
          "x-sst-workspace": issue()!.workspaceID,
        },
      }
    ).then((x) => x.json());
    clearLogStore(issue()!.id);
    bus.emit("log", result);
  });

  const counts = IssueCountStore.watch.scan(
    rep,
    (item) =>
      item.group === issue()?.group && item.hour > DateTime.now().toSQLDate()!
  );
  const total = createMemo(() => sumBy(counts(), (item) => item.count));

  const invocation = createMemo(() =>
    Object.values(LogStore[issue()?.id] || {}).at(0)
  );

  return (
    <Show when={issue()}>
      <Row space="6" style={{ padding: `${theme.space[4]}` }}>
        <Content>
          <Stack space="7">
            <Stack space="2">
              <Text code size="mono_2xl" weight="medium">
                {issue().error}
              </Text>
              <Stack space="0" horizontal="start">
                <Text code leading="loose" size="mono_base">
                  {issue().message}
                </Text>
                <FunctionLink href="/link/to/logs">
                  /packages/functions/src/events/log-poller-status.handler
                </FunctionLink>
              </Stack>
            </Stack>
            <Stack space="2">
              <Text label on="surface" size="mono_sm" color="dimmed">
                Stack Trace
              </Text>
              <StackTraceBackground>
                <StackTrace stack={issue().stack || []} />
              </StackTraceBackground>
            </Stack>
            <Stack space="2">
              <Text label on="surface" size="mono_sm" color="dimmed">
                Logs
              </Text>
              <LogsBackground>
                <Show
                  when={invocation()?.logs.length}
                  fallback={
                    <LogsLoading>
                      <LogsLoadingIcon>
                        <IconArrowPathSpin />
                      </LogsLoadingIcon>
                      <Text
                        leading="normal"
                        color="dimmed"
                        size="sm"
                        on="surface"
                      >
                        Loading logs &hellip;
                      </Text>
                    </LogsLoading>
                  }
                >
                  <For each={invocation()?.logs || []}>
                    {(entry, i) => (
                      <LogEntry>
                        <LogEntryTime>
                          {entry.timestamp.toLocaleTimeString()}
                        </LogEntryTime>
                        <LogEntryMessage>{entry.message}</LogEntryMessage>
                      </LogEntry>
                    )}
                  </For>
                </Show>
              </LogsBackground>
            </Stack>
          </Stack>
        </Content>
        <Sidebar>
          <Stack space="7">
            <ButtonGroup>
              <Button
                grouped="left"
                color="secondary"
                style={{ flex: "1 1 auto" }}
                active={Boolean(issue().timeIgnored)}
                onClick={() =>
                  issue().timeIgnored
                    ? rep().mutate.issue_unignore([issue()!.id])
                    : rep().mutate.issue_ignore([issue()!.id])
                }
              >
                <ButtonIcon>
                  <IconNoSymbol />
                </ButtonIcon>
                Ignore
              </Button>
              <Button
                grouped="right"
                color="success"
                style={{ flex: "1 1 auto" }}
                active={Boolean(issue().timeResolved)}
                onClick={() =>
                  issue().timeResolved
                    ? rep().mutate.issue_unresolve([issue()!.id])
                    : rep().mutate.issue_resolve([issue()!.id])
                }
              >
                <ButtonIcon>
                  <IconCheck />
                </ButtonIcon>
                Resolve
              </Button>
            </ButtonGroup>
            <Stack space="2">
              <Text label on="surface" size="mono_sm" color="dimmed">
                Status
              </Text>
              <Row>
                <Switch>
                  <Match when={status() === "active"}>
                    <Tag level="caution">Active</Tag>
                  </Match>
                  <Match when={status() === "ignored"}>
                    <Tag level="info">Ignored</Tag>
                  </Match>
                  <Match when={status() === "resolved"}>
                    <Tag level="tip">Resolved</Tag>
                  </Match>
                </Switch>
              </Row>
            </Stack>
            <Stack space="2">
              <Text label on="surface" size="mono_sm" color="dimmed">
                Last Seen
              </Text>
              <Text
                title={parseTime(issue().timeSeen).toLocaleString(
                  DateTime.DATETIME_FULL
                )}
                color="secondary"
              >
                {formatSinceTime(issue().timeSeen, true)}
              </Text>
            </Stack>
            <Stack space="2">
              <Text label on="surface" size="mono_sm" color="dimmed">
                First Seen
              </Text>
              <Text
                title={parseTime(issue().timeCreated).toLocaleString(
                  DateTime.DATETIME_FULL
                )}
                color="secondary"
              >
                {formatSinceTime(issue().timeCreated, true)}
              </Text>
            </Stack>
            <Stack space="2">
              <Text label on="surface" size="mono_sm" color="dimmed">
                Events in last 24hrs
              </Text>
              <Text color="secondary" title={total().toString()}>
                {formatNumber(total(), true)}
              </Text>
            </Stack>
          </Stack>
        </Sidebar>
      </Row>
    </Show>
  );
}
