import {
  For,
  JSX,
  ParentProps,
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import { styled } from "@macaron-css/solid";
import { theme } from "$/ui/theme";
import { Text } from "$/ui/text";
import { filter, groupBy, pipe } from "remeda";
import { globalStyle } from "@macaron-css/core";
import { Portal } from "solid-js/web";
import {
  createEventListener,
  makeEventListener,
} from "@solid-primitives/event-listener";
import { createMutationObserver } from "@solid-primitives/mutation-observer";
import { utility } from "$/ui/utility";

interface Action {
  icon: (props: any) => JSX.Element;
  title: string;
  category?: string;
  hotkeys?: string[];
  run: (control: Control) => void | Promise<void>;
}

type ActionProvider = (filter: string, global: boolean) => Promise<Action[]>;

const Root = styled("div", {
  base: {
    position: "fixed",
    backgroundColor: theme.color.background.overlay,
    opacity: 0,
    inset: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "start",
    pointerEvents: "none",
    transition: "200ms opacity",
    paddingTop: "10vh",
    zIndex: 1,
  },
  variants: {
    show: {
      true: {
        opacity: 1,
        pointerEvents: "all",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      },
    },
  },
});

const Modal = styled("div", {
  base: {
    width: 640,
    borderRadius: 10,
    flexShrink: 0,
    boxShadow: theme.color.shadow.drop.long,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    background: theme.color.background.modal,
    transform: "scale(0.95)",
    transition: "200ms all",
  },
});

globalStyle(`${Root.selector({ show: true })} ${Modal}`, {
  transform: "initial",
});

const Filter = styled("div", {
  base: {
    padding: `${theme.space[4]} ${theme.space[5]}`,
    display: "flex",
  },
});

const FilterInput = styled("input", {
  base: {
    flexGrow: 1,
    border: 0,
    background: "transparent",
  },
});

const Results = styled("div", {
  base: {
    borderTop: `1px solid ${theme.color.divider.base}`,
    maxHeight: 320,
    padding: theme.space[2],
    overflowY: "auto",
    selectors: {
      "&::-webkit-scrollbar": {
        display: "none",
      },
      "&:empty": {
        display: "none",
      },
    },
  },
});

const Category = styled("div", {
  base: {
    display: "flex",
    padding: `${theme.space[2]} ${theme.space[3]}`,
    fontFamily: theme.font.family.heading,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: theme.font.size.sm,
    alignItems: "center",
    fontWeight: theme.textBoldWeight,
    color: theme.color.text.dimmed.base,
  },
});

const ActionRow = styled("div", {
  base: {
    ...utility.row(2),
    padding: `0 ${theme.space[3]}`,
    height: 48,
    alignItems: "center",
    borderRadius: theme.borderRadius,
    fontSize: theme.font.size.base,
  },
});

globalStyle(`${ActionRow}.active`, {
  background: theme.color.background.hover,
});

const ActionRowIcon = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 15,
    height: 15,
  },
});

globalStyle(`${ActionRowIcon} svg`, {
  color: theme.color.icon.secondary,
  transition: `color ${theme.colorFadeDuration} ease-out`,
});

globalStyle(`${ActionRow}.active ${ActionRowIcon} svg`, {
  color: theme.color.icon.primary,
});

function createControl() {
  const providers = new Map<string, ActionProvider>();
  const [activeProviders, setActiveProviders] = createSignal<string[]>([]);
  const [visible, setVisible] = createSignal(false);
  const [actions, setActions] = createSignal<Action[]>([]);
  const [input, setInput] = createSignal("");
  const [root, setRoot] = createSignal<HTMLElement>();

  function show(...providers: string[]) {
    console.log("showing command bar");
    batch(() => {
      setActiveProviders(providers);
      setVisible(true);
      setInput("");
    });
    control.input().focus();
    control.setActive(control.actions()[0]);
  }

  function hide() {
    setVisible(false);
  }

  makeEventListener(document, "keydown", (e) => {
    if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      show();
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const current = control.active();
      if (current) current.click();
    }
  });

  createEffect(async () => {
    if (!visible()) return;
    const p = activeProviders().length
      ? activeProviders()
          .map((p) => providers.get(p)!)
          .filter(Boolean)
      : [...providers.values()].reverse();
    const actions = await Promise.all(
      p.map(async (provider) => {
        const actions = await provider(input(), activeProviders().length === 0);
        return actions;
      })
    ).then((x) => x.flat());
    setActions(actions);
  });

  const groups = createMemo(() => {
    return pipe(
      actions() || [],
      filter((action) =>
        action.title.toLowerCase().includes(input().toLowerCase())
      ),
      groupBy((a) => a.category)
    );
  });

  createMutationObserver(
    () => root()?.querySelector(`[data-element="results"]`)!,
    { childList: true },
    () => control.reset()
  );

  const control = {
    get root() {
      const r = root();
      if (!r) throw new Error("Root not set");
      return r;
    },
    input() {
      return control.root.querySelector("input") as HTMLInputElement;
    },
    actions() {
      return [...control.root.querySelectorAll("[data-element='action']")];
    },
    reset() {
      control.setActive(control.actions()[0]);
    },
    active() {
      return control.root.querySelector(
        "[data-element='action'].active"
      ) as HTMLElement;
    },
    setActive(el: Element, disableScroll?: boolean) {
      if (!el) return;
      const current = control.active();
      if (current) current.classList.remove("active");
      el.classList.add("active");
      if (!disableScroll)
        el.scrollIntoView({
          block: "nearest",
        });
    },
    move(direction: -1 | 1) {
      const current = control.active();
      const all = control.actions();
      if (!current) {
        control.setActive(all[0]);
        return;
      }
      const index = all.indexOf(current);
      const next = all[index + direction];
      control.setActive(next ?? all[direction == 1 ? 0 : all.length - 1]);
    },
    next() {
      return control.move(1);
    },
    back() {
      return control.move(-1);
    },
  };

  createEventListener(window, "keydown", (e) => {
    if (!visible()) return;
    if (e.key === "ArrowDown") {
      control.next();
      e.preventDefault();
    }

    if (e.key === "ArrowUp") {
      control.back();
      e.preventDefault();
    }

    if (e.key === "Escape") {
      setTimeout(() => hide(), 1);
    }
  });

  return {
    bind: setRoot,
    get input() {
      return input();
    },
    setInput,
    setActive: control.setActive,
    get groups() {
      return groups();
    },
    get visible() {
      return visible();
    },
    register(name: string, provider: ActionProvider) {
      providers.set(name, provider);
      onCleanup(() => {
        providers.delete(name);
      });
    },
    show,
    hide,
  };
}

type Control = ReturnType<typeof createControl>;

const CommandbarContext = createContext<Control>();

export function CommandBar(props: ParentProps) {
  createEventListener(document, "mouseup", (e) => {
    if (!modal?.contains(e.target as Node)) {
      if (control.visible) control.hide();
    }
  });
  const control = createControl();
  let scrolling: NodeJS.Timer | undefined;
  let modal!: HTMLDivElement;

  return (
    <CommandbarContext.Provider value={control}>
      {props.children}
      <Portal mount={document.getElementById("styled")!}>
        <Root show={control.visible} ref={control.bind}>
          <Modal ref={modal}>
            <Filter>
              <FilterInput
                value={control.input}
                onInput={(e) => control.setInput(e.target.value)}
                autofocus
                placeholder="Type to search"
              />
            </Filter>
            <Results
              data-element="results"
              onScroll={() => {
                if (scrolling) clearTimeout(scrolling);
                scrolling = setTimeout(() => {
                  scrolling = undefined;
                }, 100);
              }}
            >
              <For each={Object.entries(control.groups)}>
                {([category, actions]) => (
                  <>
                    <Category>{category}</Category>
                    <For each={actions}>
                      {(action) => (
                        <ActionRow
                          onMouseOver={(e) => {
                            const target = e.currentTarget;
                            setTimeout(() => {
                              if (scrolling) return;
                              control.setActive(target, true);
                            }, 0);
                          }}
                          data-element="action"
                          onClick={() => {
                            action.run(control);
                          }}
                        >
                          <ActionRowIcon>
                            <action.icon />
                          </ActionRowIcon>
                          <Text
                            line
                            on="surface"
                            color="primary"
                            leading="normal"
                          >
                            {action.title}
                          </Text>
                        </ActionRow>
                      )}
                    </For>
                  </>
                )}
              </For>
            </Results>
          </Modal>
        </Root>
      </Portal>
    </CommandbarContext.Provider>
  );
}

export function useCommandBar() {
  const ctx = useContext(CommandbarContext);
  if (!ctx) throw new Error("No commandbar context");
  return ctx;
}
