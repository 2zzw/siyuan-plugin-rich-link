import { convertToBookmarkCard, convertToOembed, processSelectedBlocks, toggleBookmarkCard, convertToMiddleBookmarkCard } from "./convert";
import { i18n } from "./i18n";
import { getBlocks } from "./utils/block";

export interface BlockIconTemplate {
    id: string;
    icon: string;
    label: string;
    handler: (id: string, link: string) => Promise<void>;
}

export const SlashCommandTemplates = {
    bookmarkCard: {
        filter: ["card", "bookmark", "bk", "link"],
        icon: "iconLink",
        name: i18n.insertURLDialogTitle,
        template: `Shift+3`,
        callback: toggleBookmarkCard,
    },
};

export const ToolbarCommandsTemplates = {
    oembed: {
        name: "toggle-oembed",
        icon: "iconOembed",
        hotkey: "⇧1",
        tipPosition: "n",
        tip: i18n.toggleOembed,
        click: async () => {
            await processSelectedBlocks(getBlocks(), convertToOembed, 'oembed');
        },
    },
    middleBookmarkCard: {
        name: "toggle-middleBookmarkCard",
        icon: "iconLink",
        hotkey: "⇧2",
        tipPosition: "n",
        tip: i18n.toggleMiddleBookmarkCard,
        click: async () => {
            await processSelectedBlocks(getBlocks(), convertToMiddleBookmarkCard, 'middle');
        },
    },
    bookmarkCard: {
        name: "toggle-bookmarkCard",
        icon: "iconLink",
        hotkey: "⇧3",
        tipPosition: "n",
        tip: i18n.toggleBookmarkCard,
        click: async () => {
            await processSelectedBlocks(getBlocks(), convertToBookmarkCard, 'normal');
        },
    },
};

export const createBlockIconConfig = (): BlockIconTemplate[] => [
    {
        id: "toggle-oembed",
        icon: "iconOembed",
        label: i18n.toggleOembed,
        handler: convertToOembed,
    },
    {
        id: "toggle-middleBookmarkCard",
        icon: "iconLink",
        label: i18n.toggleMiddleBookmarkCard,
        handler: convertToMiddleBookmarkCard,
    },
    {
        id: "toggle-bookmarkCard",
        icon: "iconLink",
        label: i18n.toggleBookmarkCard,
        handler: convertToBookmarkCard,
    },
];