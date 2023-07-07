import "@fontsource/rubik/latin.css";
import "@fontsource/ibm-plex-mono/latin.css";
import { styled } from "@macaron-css/solid";
import { darkClass, lightClass, theme } from "./ui/theme";
import { globalStyle, macaron$ } from "@macaron-css/core";
import { Component, Match, Switch, createEffect, createSignal } from "solid-js";
import { Navigate, Route, Router, Routes } from "@solidjs/router";
import { CreateWorkspace, Login } from "./pages/auth";
import { AuthProvider, useAuth } from "./providers/auth";
import { RealtimeProvider } from "./providers/realtime";
import { CommandBar } from "./pages/workspace/command-bar";
import { Debug } from "./pages/debug";
import { Design } from "./pages/design";
import { Connect } from "./pages/connect";
import { Workspace } from "./pages/workspace";
import { account, setAccount } from "./data/storage";
import { createSubscription } from "./providers/replicache";
import { WorkspaceStore } from "./data/workspace";

console.log(import.meta.env.VITE_API_URL);

const initializeTheme = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const Root = styled("div", {
  base: {
    inset: 0,
    position: "fixed",
    lineHeight: 1,
    fontFamily: theme.font.family.body,
    fontSynthesis: "none",
    textRendering: "geometricPrecision",
    backgroundColor: theme.color.background.base,
    overflowY: "auto",
  },
});

globalStyle("html", {
  fontSize: 16,
  fontWeight: 400,
});

globalStyle("h1, h2, h3, h4, h5, h6, p", {
  margin: 0,
});

globalStyle("a", {
  textDecoration: "none",
  color: theme.color.link.primary.base,
  transition: `color ${theme.colorFadeDuration} ease-out`,
});

globalStyle("a:hover", {
  color: theme.color.link.primary.hover,
});

globalStyle(`a[href^="http"]`, {
  cursor: "pointer",
});

globalStyle("*:focus", {
  border: 0,
  outline: 0,
});

macaron$(() =>
  ["::placeholder", ":-ms-input-placeholder"].forEach((selector) =>
    globalStyle(selector, {
      opacity: 1,
      color: theme.color.text.dimmed.base,
    })
  )
);

globalStyle("*", {
  cursor: "default",
  boxSizing: "border-box",
});

globalStyle("input", {
  cursor: "text",
});

export const App: Component = () => {
  const [theme, setTheme] = createSignal<string>(initializeTheme());

  createEffect(() => {
    const darkMode = window.matchMedia("(prefers-color-scheme: dark)");

    const setColorScheme = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };

    darkMode.addEventListener("change", setColorScheme);

    return () => {
      darkMode.removeEventListener("change", setColorScheme);
    };
  });

  return (
    <Root class={theme() === "light" ? lightClass : darkClass} id="styled">
      <Router>
        <Routes>
          <Route path="auth/login" component={Login} />
          <Route
            path="*"
            element={
              <AuthProvider>
                <RealtimeProvider />
                <CommandBar>
                  <Routes>
                    <Route path="debug" component={Debug} />
                    <Route path="design" component={Design} />
                    <Route path="connect" component={Connect} />
                    <Route path=":workspaceSlug/*" component={Workspace} />
                    <Route path="/auth/workspace" component={CreateWorkspace} />
                    <Route
                      path="*"
                      component={() => {
                        const auth = useAuth();
                        let existing = account();
                        if (!existing || !auth[existing]) {
                          existing = Object.keys(auth)[0];
                          setAccount(existing);
                        }
                        const workspaces = createSubscription(
                          WorkspaceStore.list,
                          null,
                          () => auth[existing].replicache
                        );

                        const init = createSubscription(
                          () => (tx) => {
                            return tx.get("/init");
                          },
                          false,
                          () => auth[existing].replicache
                        );

                        return (
                          <Switch>
                            <Match
                              when={workspaces() && workspaces()!.length > 0}
                            >
                              <Navigate href={`/${workspaces()![0].slug}`} />
                            </Match>
                            <Match
                              when={
                                init() &&
                                workspaces() &&
                                workspaces()!.length === 0
                              }
                            >
                              <Navigate href={`/auth/workspace`} />
                            </Match>
                          </Switch>
                        );
                      }}
                    />
                  </Routes>
                </CommandBar>
              </AuthProvider>
            }
          />
        </Routes>
      </Router>
    </Root>
  );
};
