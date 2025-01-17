import { Row, Stack, AvatarInitialsIcon, Text, theme } from "$/ui";
import { IconChevronUpDown, IconMagnifyingGlass } from "$/ui/icons";
import { utility } from "$/ui/utility";
import { TextButton } from "$/ui/button";
import { styled } from "@macaron-css/solid";
import { Link } from "@solidjs/router";
import { useWorkspace } from "./context";
import { useCommandBar } from "./command-bar";
import {
  JSX,
  ParentProps,
  Show,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";
import { createInitializedContext } from "$/common/context";
import { dropAllDatabases } from "replicache";

const Root = styled("div", {
  base: {
    top: "0",
    zIndex: 1,
    position: "sticky",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    backgroundColor: theme.color.background.navbar,
    borderBottom: `1px solid ${theme.color.divider.base}`,
    padding: `0 ${theme.space[4]}`,
    height: theme.headerHeight.root,
  },
});

const WorkspaceLogoLink = styled(Link, {
  base: {
    display: "flex",
  },
});

const StageSwitcher = styled("button", {
  base: {
    flexShrink: 0,
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    borderLeft: `1px solid ${theme.color.divider.base}`,
    paddingLeft: theme.space[4],
    gap: theme.space[3],
    font: theme.font.family.heading,
  },
});

const StageSwitcherCopyMain = styled("span", {
  base: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.medium,
    color: theme.color.text.secondary.base,
  },
});

const SwitcherIcon = styled(IconChevronUpDown, {
  base: {
    color: theme.color.text.dimmed.base,
    width: 28,
    height: 28,
  },
});

const JumpToButton = styled("button", {
  base: {
    ...utility.row(9),
    height: 36,
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.input.background,
    border: `1px solid ${theme.color.divider.surface}`,
    padding: `0 ${theme.space[1.5]} 0 ${theme.space[2.5]}`,
  },
});

const JumpToButtonKeys = styled("div", {
  base: {
    letterSpacing: 0.5,
    fontSize: theme.font.size.mono_xs,
    padding: `${theme.space[1]} ${theme.space[1.5]}`,
    alignItems: "center",
    textTransform: "uppercase",
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.divider.surface,
    lineHeight: "normal",
    color: theme.color.text.dimmed.surface,
  },
});

const JumpToButtonCopy = styled("span", {
  base: {
    lineHeight: "normal",
    fontSize: theme.font.size.xs,
    color: theme.color.text.dimmed.base,
  },
});

export const PageHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    padding: `0 ${theme.space[4]}`,
    justifyContent: "space-between",
    height: theme.headerHeight.stage,
    borderBottom: `1px solid ${theme.color.divider.base}`,
  },
});

const LogoutButton = styled(TextButton, {
  base: {
    ...utility.text.label,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.base,
    ":hover": {
      color: theme.color.text.secondary.base,
    },
  },
});

function isMac() {
  return navigator.userAgent.toUpperCase().indexOf("MAC") !== -1;
}

export const { provider: HeaderProvider, use: useHeaderContext } =
  createInitializedContext("HeaderContext", () => {
    const [children, setChildren] = createSignal<JSX.Element>();
    return {
      set: setChildren,
      clear: () => setChildren(undefined),
      get children() {
        return children();
      },
      get ready() {
        return true;
      },
    };
  });

export function HeaderSlot(props: ParentProps) {
  const ctx = useHeaderContext();
  createEffect(() => {
    ctx.set(props.children);
  });

  onCleanup(() => {
    ctx.clear();
  });

  return null;
}

export function Header(props: { app?: string; stage?: string }) {
  const workspace = useWorkspace();
  const bar = useCommandBar();

  return (
    <Root>
      <Row space="4" vertical="center">
        <WorkspaceLogoLink href={`/${workspace().slug}`}>
          <AvatarInitialsIcon type="workspace" text={workspace().slug} />
        </WorkspaceLogoLink>
        <StageSwitcher
          onClick={() =>
            props.stage
              ? bar.show("stage-switcher")
              : bar.show("workspace-switcher")
          }
        >
          <Show
            when={props.stage}
            fallback={
              <StageSwitcherCopyMain>{workspace().slug}</StageSwitcherCopyMain>
            }
          >
            <Stack space="1.5">
              <StageSwitcherCopyMain>{props.app}</StageSwitcherCopyMain>
              <Text color="dimmed">{props.stage}</Text>
            </Stack>
          </Show>
          <SwitcherIcon />
        </StageSwitcher>
      </Row>
      <Row space="4" vertical="center">
        <JumpToButton onClick={() => bar.show()}>
          <Row space="1" vertical="center">
            <IconMagnifyingGlass
              width="13"
              height="13"
              color={theme.color.icon.dimmed}
            />
            <JumpToButtonCopy>Jump to</JumpToButtonCopy>
          </Row>
          <Row space="1" vertical="center">
            <JumpToButtonKeys>
              {isMac() ? <>&#8984;</> : "Ctrl"}
            </JumpToButtonKeys>
            <JumpToButtonKeys>K</JumpToButtonKeys>
          </Row>
        </JumpToButton>
        <LogoutButton
          onClick={async () => {
            await dropAllDatabases();
            localStorage.clear();
            location.href = "/";
          }}
        >
          Logout
        </LogoutButton>
      </Row>
    </Root>
  );
}
