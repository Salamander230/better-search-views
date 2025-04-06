import { JSX, createContext, useContext } from "solid-js";
import { App, Keymap, MarkdownView, Notice } from "obsidian";
import BetterBacklinksPlugin from "../../plugin";
import { MouseOverEvent } from "../../types";

interface PluginContextProps {
  plugin: BetterBacklinksPlugin;
  infinityScroll: any;
  children: JSX.Element;
}

interface PluginContextValue {
  handleClick: (
    event: MouseEvent,
    path: string,
    line?: number,
  ) => Promise<void>;
  handleMouseover: (event: MouseOverEvent, path: string, line?: number) => void;
  handleHeightChange: () => void;
  plugin: BetterBacklinksPlugin;
  app: App;
}

const PluginContext = createContext<PluginContextValue>();

export function PluginContextProvider(props: PluginContextProps) {
  const handleClick = async (event: MouseEvent, path: string, line: number) => {
    const target = event.target as HTMLElement;
    // do not open backlinked file if certain elements are clicked
    if (target.closest("a, .callout, img, audio, video, .task-list-item-checkbox") && !target.closest(".internal-link")) {
      return;
    }
    
    // if clicked element is an internal link, open it in a new tab
    if (target.closest(".internal-link")) {
      const link = target.closest(".internal-link") as HTMLAnchorElement;
      path = decodeURI(link.href.replace("app://obsidian.md/", ""));
      await props.plugin.app.workspace.openLinkText(path, path, true);
      return;
    }

    const file = props.plugin.app.metadataCache.getFirstLinkpathDest(
      path,
      path,
    );

    if (!file) {
      new Notice(`File ${path} does not exist`);
      return;
    }
    
    // open backlinked file in a new tab by default
    await props.plugin.app.workspace.getLeaf(true).openFile(file);

    const activeMarkdownView =
      props.plugin.app.workspace.getActiveViewOfType(MarkdownView);

    if (!activeMarkdownView) {
      new Notice(`Failed to open file ${path}. Can't scroll to line ${line}`);
      return;
    }

    // Sometimes it works but still throws errors
    try {
      activeMarkdownView.setEphemeralState({ line });
    } catch (error) {
      console.error(error);
    }
  };

  const handleMouseover = (
    event: MouseOverEvent,
    path: string,
    line: number,
  ) => {
    // @ts-ignore
    if (!props.plugin.app.internalPlugins.plugins["page-preview"].enabled) {
      return;
    }

    const target = event.target as HTMLElement;
    
    // show page preview on internal link hover
    if (target.closest(".internal-link")) {
      const link = target.closest(".internal-link") as HTMLAnchorElement;
      path = decodeURI(link.href.replace("app://obsidian.md/", ""));
      props.plugin.app.workspace.trigger("link-hover", {}, target, path, "");
      return;
    }

    if (Keymap.isModifier(event, "Mod")) {
      const previewLocation = {
        scroll: line,
      };
      if (path) {
        props.plugin.app.workspace.trigger(
          "link-hover",
          {},
          target,
          path,
          "",
          previewLocation,
        );
      }
    }
  };

  const handleHeightChange = () => {
    props.infinityScroll.invalidateAll();
  };

  return (
    <PluginContext.Provider
      value={{
        handleClick,
        handleMouseover,
        handleHeightChange,
        plugin: props.plugin,
        app: props.plugin.app,
      }}
    >
      {props.children}
    </PluginContext.Provider>
  );
}

export function usePluginContext() {
  const pluginContext = useContext(PluginContext);
  if (!pluginContext) {
    throw new Error("pluginContext must be used inside a provider");
  }
  return pluginContext;
}
