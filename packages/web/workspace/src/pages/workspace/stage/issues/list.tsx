import { styled } from "@macaron-css/solid";
import { Row, Stack } from "$/ui/layout";
import { IconCheck, IconNoSymbol, IconExclamationTriangle } from "$/ui/icons";
import { inputFocusStyles } from "$/ui/form";
import { IconCaretRight, IconSubRight } from "$/ui/icons/custom";
import {
  utility,
  Text,
  Button,
  Histogram,
  ButtonGroup,
  SplitOptions,
  SplitOptionsOption,
} from "$/ui";
import { formatSinceTime, parseTime } from "$/common/format";
import { Link, useNavigate, useSearchParams } from "@solidjs/router";
import { theme } from "$/ui/theme";
import type { Issue } from "@console/core/issue";
import {
  For,
  Show,
  Switch,
  Match,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import {
  useIssuesContext,
  useResourcesContext,
  useStageContext,
} from "../context";
import { useReplicache } from "$/providers/replicache";
import { HeaderSlot } from "../../header";
import { DateTime, Interval } from "luxon";
import { filter, fromPairs, pipe, sortBy } from "remeda";
import { WarningStore } from "$/data/warning";
import { IssueCountStore } from "$/data/issue";
import { useCommandBar } from "../../command-bar";
import { createShortcut } from "@solid-primitives/keyboard";
import { createEventListener } from "@solid-primitives/event-listener";

const COL_COUNT_WIDTH = 260;
const COL_TIME_WIDTH = 140;

const Content = styled("div", {
  base: {
    padding: theme.space[4],
  },
});

const Warning = styled("div", {
  base: {
    ...utility.stack(3),
    padding: theme.space[3],
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.background.surface,
  },
});

const WarningIcon = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 16,
    height: 16,
    opacity: theme.iconOpacity,
    color: theme.color.text.danger.surface,
  },
});

const WarningText = styled("div", {
  base: {
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
    color: theme.color.text.danger.surface,
  },
});

const WarningMoreButton = styled("button", {
  base: {
    textDecoration: "underline",
  },
});

const WarningDetails = styled("div", {
  base: {
    ...utility.stack(4),
    borderStyle: "solid",
    borderWidth: "1px 0 0 0",
    paddingTop: theme.space[3],
    borderColor: theme.color.divider.surface,
  },
});

const WarningDetailsScroll = styled("div", {
  base: {
    overflowY: "auto",
    maxHeight: 140,
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
  },
});

const WarningDetailsTitle = styled("div", {
  base: {
    color: theme.color.text.primary.surface,
  },
});

const WarningDetailsDesc = styled("div", {
  base: {
    ...utility.text.pre,
    marginLeft: theme.space[4],
    color: theme.color.text.secondary.surface,
  },
});

const IssuesHeader = styled("div", {
  base: {
    ...utility.row(4),
    height: 54,
    alignItems: "center",
    padding: theme.space[4],
    border: `1px solid ${theme.color.divider.base}`,
    backgroundColor: theme.color.background.surface,
    borderRadius: `${theme.borderRadius} ${theme.borderRadius} 0 0`,
  },
});

const IssueCol = styled("div", {
  base: {
    minWidth: 0,
  },
  variants: {
    grow: {
      true: {
        flex: "1 1 auto",
      },
      false: {
        flex: "0 0 auto",
      },
    },
    align: {
      left: {
        textAlign: "left",
        justifyContent: "flex-start",
      },
      right: {
        textAlign: "right",
        justifyContent: "flex-end",
      },
    },
  },
  defaultVariants: {
    grow: false,
    align: "left",
  },
});

const IssuesHeaderCol = styled(IssueCol, {
  base: {
    ...utility.row(3.5),
    alignItems: "center",
  },
});

const ButtonIcon = styled("span", {
  base: {
    width: 12,
    height: 12,
    marginRight: 6,
    verticalAlign: -2,
    display: "inline-block",
    opacity: theme.iconOpacity,
  },
});

const EmptyIssuesSign = styled("div", {
  base: {
    ...utility.stack(0),
    alignItems: "center",
    justifyContent: "center",
    padding: `${theme.space[32]} ${theme.space[4]}`,
    borderStyle: "solid",
    borderWidth: "0 1px 1px 1px",
    borderColor: theme.color.divider.base,
    borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
  },
});

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pluralize(s: string, count: number) {
  return count === 1 ? s : s + "s";
}

export function List() {
  const bar = useCommandBar();
  bar.register("issues-list", async () => {
    return ["active", "ignored", "resolved"].map((view) => ({
      icon: IconSubRight,
      title: `${capitalize(view)} issues`,
      run: (control) => {
        setSearch({
          view: view,
        });
        control.hide();
      },
      disabled: search.view === view,
      category: "Issues",
    }));
  });
  bar.register("issues-bulk", async () => {
    return [
      {
        icon: IconCaretRight,
        title: `Resolve ${selected().length} ${pluralize(
          "issue",
          selected().length
        )}`,
        run: (control) => {
          rep().mutate.issue_resolve(selected());
          reset();
          control.hide();
        },
        disabled: selected().length === 0 || search.view === "resolved",
        category: "Issues",
      },
      {
        icon: IconCaretRight,
        title: `Unresolve ${selected().length} ${pluralize(
          "issue",
          selected().length
        )}`,
        run: (control) => {
          rep().mutate.issue_unresolve(selected());
          reset();
          control.hide();
        },
        disabled: selected().length === 0 || search.view !== "resolved",
        category: "Issues",
      },
      {
        icon: IconCaretRight,
        title: `Ignore ${selected().length} ${pluralize(
          "issue",
          selected().length
        )}`,
        run: (control) => {
          rep().mutate.issue_ignore(selected());
          reset();
          control.hide();
        },
        disabled: selected().length === 0 || search.view === "ignored",
        category: "Issues",
      },
      {
        icon: IconCaretRight,
        title: `Unignore ${selected().length} ${pluralize(
          "issue",
          selected().length
        )}`,
        run: (control) => {
          rep().mutate.issue_unignore(selected());
          reset();
          control.hide();
        },
        disabled: selected().length === 0 || search.view !== "ignored",
        category: "Issues",
      },
      {
        icon: IconCaretRight,
        title: "Select all issues",
        run: (control) => {
          document
            .querySelector<HTMLInputElement>("input[name='select-all']")
            ?.click();
          control.hide();
        },
        category: "Issues",
      },
    ];
  });

  const issues = useIssuesContext();
  const [search, setSearch] = useSearchParams<{
    view: "active" | "ignored" | "resolved";
  }>();
  const view = createMemo(() => search.view || "active");
  const rep = useReplicache();
  const filtered = createMemo(() =>
    pipe(
      issues(),
      filter((item) => {
        if (view() === "active") return !item.timeResolved && !item.timeIgnored;
        if (view() === "ignored") return Boolean(item.timeIgnored);
        if (view() === "resolved") return Boolean(item.timeResolved);
        return false;
      }),
      sortBy([(item) => item.timeSeen, "desc"])
    )
  );

  const stage = useStageContext();

  const subWarnings = WarningStore.forStage.watch(
    rep,
    () => [stage.stage.id],
    (warnings) =>
      warnings.filter((warning) => warning.type === "log_subscription")
  );
  const rateWarnings = WarningStore.forStage.watch(
    rep,
    () => [stage.stage.id],
    (warnings) =>
      warnings.filter((warning) => warning.type === "issue_rate_limited")
  );
  const resources = useResourcesContext();
  const fns = createMemo(() =>
    resources().flatMap((item) => (item.type === "Function" ? [item] : []))
  );

  const [selected, setSelected] = createSignal<string[]>([]);
  const [warningExpanded, setWarningExpanded] = createSignal(false);
  let form!: HTMLFormElement;

  function reset() {
    form.reset();
    setSelected([]);
  }

  createEffect(() => {
    view();
    reset();
  });

  function renderWarning() {
    return (
      <Warning>
        <Row space="4" vertical="center" horizontal="between">
          <Row flex space="2.5" vertical="center">
            <WarningIcon>
              <IconExclamationTriangle />
            </WarningIcon>
            <WarningText>
              <Show
                when={rateWarnings().length > 0}
                fallback={
                  <>
                    There was a problem enabling Issues. Check out the details
                    and try again, or contact us if you need help.{" "}
                  </>
                }
              >
                You hit a soft limit for Issues. You can re-enable it or contact
                us to have the limit lifted.{" "}
              </Show>
              <WarningMoreButton
                onClick={() => setWarningExpanded(!warningExpanded())}
              >
                <Show when={!warningExpanded()} fallback="Hide details">
                  Show details
                </Show>
              </WarningMoreButton>
              .
            </WarningText>
          </Row>
          <Button
            size="sm"
            color="secondary"
            onClick={() => {
              rep().mutate.issue_subscribe({
                stageID: stage.stage.id,
              });
            }}
          >
            {rateWarnings().length > 0 ? "Enable Issues" : "Retry"}
          </Button>
        </Row>
        <Show when={warningExpanded()}>
          <WarningDetails>
            <WarningDetailsScroll>
              <Show
                when={rateWarnings().length === 0}
                fallback={
                  <WarningDetailsTitle>
                    We temporarily paused Issues for your workspace because it
                    hit a soft limit for the number of Issues per hour. Feel
                    free to re-enable it. Or,{" "}
                    <a href="mailto:help@sst.dev">get in touch with us</a> if
                    you'd like the limit lifted.
                  </WarningDetailsTitle>
                }
              >
                <Stack space="1">
                  <WarningDetailsTitle>
                    There was a problem enabling Issues for the following
                    functions. <a href="mailto:help@sst.dev">Contact us</a> if
                    you need help.
                  </WarningDetailsTitle>
                  <WarningDetailsDesc>
                    -{" "}
                    {subWarnings()
                      .map((item) => {
                        if (item.type === "log_subscription") {
                          const reason = (function () {
                            if (item.data.error === "noisy")
                              return "Rate Limited";
                            if (item.data.error === "unknown")
                              return "Unknown error: " + item.data.message;
                            if (item.data.error === "limited")
                              return "Too many existing log subscribers";
                            if (item.data.error === "permissions")
                              return "Missing permissions to add log subscriber";
                            return "Unknown";
                          })();
                          return `${
                            resources()
                              .flatMap((x) =>
                                x.id === item.target && x.type === "Function"
                                  ? [x]
                                  : []
                              )
                              .at(0)?.metadata.handler
                          } (${reason})`;
                        }
                      })
                      .filter(Boolean)
                      .join("\n- ")}
                  </WarningDetailsDesc>
                </Stack>
              </Show>
            </WarningDetailsScroll>
          </WarningDetails>
        </Show>
      </Warning>
    );
  }

  const [index, setIndex] = createSignal(-1);
  function moveIndex(offset: -1 | 1) {
    const next = index() + offset;
    setIndex(Math.max(0, Math.min(next, filtered().length - 1)));
    const el = document.querySelector("[data-focus]");
    if (!el) return;
    if (next === 0) {
      el.scrollIntoView({
        block: "end",
      });
      return;
    }
    el.scrollIntoView({
      block: "nearest",
    });
  }

  const nav = useNavigate();
  createEventListener(window, "keypress", (e) => {
    if (e.key === "j") moveIndex(1);
    if (e.key === "k") moveIndex(-1);
    if (e.key === "Enter") {
      document.querySelector<HTMLElement>("[data-focus] a")?.click();
    }
    if (e.key === " ") {
      e.stopPropagation();
      e.preventDefault();
      document.querySelector<HTMLElement>("[data-focus] input")?.click();
    }
  });

  return (
    <>
      <HeaderSlot>
        <SplitOptions size="sm">
          <SplitOptionsOption
            onClick={() => setSearch({ view: "active" })}
            selected={view() === "active"}
          >
            Active
          </SplitOptionsOption>
          <SplitOptionsOption
            onClick={() => setSearch({ view: "ignored" })}
            selected={view() === "ignored"}
          >
            Ignored
          </SplitOptionsOption>
          <SplitOptionsOption
            onClick={() => setSearch({ view: "resolved" })}
            selected={view() === "resolved"}
          >
            Resolved
          </SplitOptionsOption>
        </SplitOptions>
      </HeaderSlot>
      <Content>
        <Stack space="4">
          <Show when={subWarnings().length > 0 || rateWarnings().length > 0}>
            {renderWarning()}
          </Show>
          <form
            ref={form}
            onSubmit={(e) => e.preventDefault()}
            onChange={(e) => {
              const issues = [
                ...e.currentTarget.querySelectorAll<HTMLInputElement>(
                  "input[name='issue']:checked"
                ),
              ].map((i) => i.value);
              setSelected(issues);
            }}
          >
            <IssuesHeader>
              <IssuesHeaderCol>
                <IssueCheckbox
                  name="select-all"
                  onChange={(e) => {
                    for (const input of form.querySelectorAll<HTMLInputElement>(
                      "input[type='checkbox']"
                    )) {
                      input.checked = e.currentTarget.checked;
                    }
                  }}
                  type="checkbox"
                />
              </IssuesHeaderCol>
              <IssuesHeaderCol grow>
                <Text
                  code
                  uppercase
                  on="surface"
                  size="mono_sm"
                  weight="medium"
                  color="dimmed"
                >
                  Error
                </Text>
                <Show when={selected().length > 0}>
                  <ButtonGroup>
                    <Button
                      active={search.view === "ignored"}
                      onClick={() => {
                        search.view === "ignored"
                          ? rep().mutate.issue_unignore(selected())
                          : rep().mutate.issue_ignore(selected());
                        reset();
                      }}
                      size="sm"
                      grouped="left"
                      color="secondary"
                    >
                      <ButtonIcon>
                        <IconNoSymbol />
                      </ButtonIcon>
                      Ignore
                    </Button>
                    <Button
                      active={search.view === "resolved"}
                      onClick={() => {
                        search.view === "resolved"
                          ? rep().mutate.issue_unresolve(selected())
                          : rep().mutate.issue_resolve(selected());
                        reset();
                      }}
                      size="sm"
                      grouped="right"
                      color="secondary"
                    >
                      <ButtonIcon>
                        <IconCheck />
                      </ButtonIcon>
                      Resolve
                    </Button>
                  </ButtonGroup>
                </Show>
              </IssuesHeaderCol>
              <IssuesHeaderCol
                align="right"
                style={{ width: `${COL_COUNT_WIDTH}px` }}
                title="Events in the last 24 hours"
              >
                <Text
                  code
                  uppercase
                  on="surface"
                  size="mono_sm"
                  color="dimmed"
                  weight="medium"
                >
                  Last 24hrs
                </Text>
              </IssuesHeaderCol>
              <IssuesHeaderCol
                align="right"
                style={{ width: `${COL_TIME_WIDTH}px` }}
                title="Latest occurrence of the error"
              >
                <Text
                  code
                  uppercase
                  on="surface"
                  color="dimmed"
                  size="mono_sm"
                  weight="medium"
                >
                  Time
                </Text>
              </IssuesHeaderCol>
            </IssuesHeader>
            <div>
              <Show
                when={filtered().length !== 0}
                fallback={
                  <EmptyIssuesSign>
                    <Text size="lg" color="dimmed">
                      <Switch>
                        <Match when={view() === "active"}>No new issues</Match>
                        <Match when={view() === "ignored"}>
                          No ignored issues
                        </Match>
                        <Match when={view() === "resolved"}>
                          No resolved issues
                        </Match>
                      </Switch>
                    </Text>
                  </EmptyIssuesSign>
                }
              >
                <For each={filtered()}>
                  {(issue, i) => {
                    const name = createMemo(() =>
                      issue.pointer?.logGroup.split("/").at(-1)
                    );
                    const fn = createMemo(() =>
                      fns().find(
                        (x) => name() && x.metadata.arn.endsWith(name()!)
                      )
                    );
                    return (
                      <IssueRow
                        issue={issue}
                        focus={index() === i()}
                        unread={view() === "active"}
                        last={i() === filtered().length - 1}
                        handler={fn()?.metadata.handler || ""}
                      />
                    );
                  }}
                </For>
              </Show>
            </div>
          </form>
        </Stack>
      </Content>
    </>
  );
}

const IssueRoot = styled("label", {
  base: {
    ...utility.row(4),
    padding: theme.space[4],
    alignItems: "center",
    borderStyle: "solid",
    borderWidth: "0 1px 1px 1px",
    borderColor: theme.color.divider.base,
    ":last-child": {
      borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
    },
  },
  variants: {
    focus: {
      true: {
        ...inputFocusStyles,
        borderRadius: theme.borderRadius,
      },
      false: {},
    },
  },
});

const IssueError = styled(Link, {
  base: {
    overflow: "hidden",
    lineHeight: "normal",
    whiteSpace: "nowrap",
    cursor: "pointer",
    textOverflow: "ellipsis",
  },
  variants: {
    weight: {
      regular: {
        fontWeight: 400,
      },
      medium: {
        fontWeight: 500,
      },
      semibold: {
        fontWeight: 600,
      },
    },
  },
  defaultVariants: {
    weight: "regular",
  },
});

const IssueCheckbox = styled("input", {
  base: {
    cursor: "pointer",
  },
});

type IssueProps = {
  last: boolean;
  handler: string;
  unread: boolean;
  issue: Issue.Info;
  focus?: boolean;
};

function IssueRow(props: IssueProps) {
  const rep = useReplicache();
  const min = DateTime.now()
    .startOf("hour")
    .minus({ hours: 24 })
    .toSQL({ includeOffset: false })!;

  const counts = IssueCountStore.forIssue.watch(
    rep,
    () => [props.issue.group],
    (items) => items.filter((item) => item.hour > min)
  );
  const histogram = createMemo(() => {
    const hours = fromPairs(
      counts().map((item) => [
        parseTime(item.hour).toSQL({ includeOffset: false })!,
        item.count,
      ])
    );
    return Interval.fromDateTimes(
      DateTime.now().toUTC().startOf("hour").minus({ hours: 23 }),
      DateTime.now().toUTC().startOf("hour").plus({ hours: 1 })
    )
      .splitBy({ hours: 1 })
      .map((interval) => interval.start!.toSQL({ includeOffset: false })!)
      .map((hour) => ({ label: hour, value: hours[hour] || 0 }));
  });

  return (
    <IssueRoot data-focus={props.focus ? true : undefined} focus={props.focus}>
      <IssueCol>
        <IssueCheckbox name="issue" value={props.issue.id} type="checkbox" />
      </IssueCol>
      <IssueCol grow>
        <Stack space="2">
          <Row horizontal="start">
            <IssueError
              href={props.issue.id}
              weight={props.unread ? "medium" : "regular"}
            >
              {props.issue.error}
            </IssueError>
          </Row>
          <Stack space="1">
            <Text line size="sm" leading="normal">
              {props.issue.message}
            </Text>

            <Text code line leading="normal" size="mono_sm" color="dimmed">
              {props.handler}
            </Text>
          </Stack>
        </Stack>
      </IssueCol>
      <IssueCol align="right" style={{ width: `${COL_COUNT_WIDTH}px` }}>
        <Histogram
          height={30}
          units="Errors"
          data={histogram()}
          width={COL_COUNT_WIDTH}
          currentTime={Date.now()}
          tooltipAlignment={props.last ? "top" : "bottom"}
        />
      </IssueCol>
      <IssueCol align="right" style={{ width: `${COL_TIME_WIDTH}px` }}>
        <Text
          line
          size="sm"
          color="dimmed"
          leading="normal"
          title={parseTime(props.issue.timeSeen).toLocaleString(
            DateTime.DATETIME_FULL
          )}
        >
          {formatSinceTime(props.issue.timeSeen)}
        </Text>
      </IssueCol>
    </IssueRoot>
  );
}
