import { Dialog, Protyle, showMessage } from "siyuan";
import { CUSTOM_ATTRS_LINK, defaultBookmarkCardStyle, skeletonBookmarkCardStyle, skeletonMiddleBookmarkCardStyle } from "@/libs/const";
import { LinkData } from "@/types/utils";
import { logger } from "@/utils/logger";
import { getURLMetadata } from "@/utils/metadata";
import { i18n } from "./i18n";
import { extractUrlFromBlock, focusBlock, getCurrentBlock, getElementByBlockId, isEmptyParagraphBlock } from "@/utils/block";
import { blank, getUrlFinalSegment, notBlank, regexp, stripNewlinesAndIndents, wrapInDiv } from "@/utils/strings";
import { forwardProxy, getBlockAttrs, setBlockAttrs, updateBlock } from "./api";
import { progressStatus } from "@/utils/status";

export const generateBookmarkCard = async (config?: LinkData, type?: string) => {
    let conf: LinkData = {
        title: "",
        description: "",
        icon: "",
        author: "",
        link: "",
        thumbnail: "",
        publisher: "",
        date: "",
    };
    if (config) {
        Object.assign(conf, config);
    }
    const missingProps = ["title", "description", "icon", "author", "thumbnail", "publisher"].filter(
        (prop) => !conf[prop as keyof typeof conf]
    );
    const css = type === 'normal' ? stripNewlinesAndIndents(defaultBookmarkCardStyle) : stripNewlinesAndIndents(skeletonMiddleBookmarkCardStyle);

    if (missingProps.length > 0) {
        try {
            const fetchedData = await getURLMetadata(conf.link);
            if (!fetchedData) {
                showMessage(i18n.failure);
                return
            };
            missingProps.forEach((prop) => {
                if (!conf.title && prop === "title") conf.title = fetchedData.title;
                if (!conf.description && prop === "description") conf.description = fetchedData.description;
                if (!conf.icon && prop === "icon") conf.icon = fetchedData.icon;
                if (!conf.author && prop === "author") conf.author = fetchedData.author;
                if (!conf.thumbnail && prop === "thumbnail") conf.thumbnail = fetchedData.thumbnail;
                if (!conf.publisher && prop === "publisher") conf.publisher = fetchedData.publisher;
                if (!conf.date && prop === "date") conf.date = fetchedData.date;
            });
        } catch (error) {
            logger.error("Failed to fetch metadata for link:", { error });
        }
    }
    try {
        if (conf.link) {
            if (type === 'normal')
                return `<div>
                        <style>${css}</style>
                        <main class="kg-card-main">
                            <div class="kg-card-outer">
                                <div class="kg-card kg-bookmark-card">
                                    <a class="kg-bookmark-container" href="${conf.link}">
                                        <div class="kg-bookmark-content">
                                            <div class="kg-bookmark-title">${conf.title}</div>
                                            <div class="kg-bookmark-description">${conf.description || ""}</div>
                                            <div class="kg-bookmark-metadata">
                                                <img class="kg-bookmark-icon" src="${conf.icon}" alt="Link icon" />
                                                ${conf.author
                        ? `<span class="kg-bookmark-author">${conf.author || ""
                        }</span>`
                        : ""
                    }
                                                ${conf.publisher
                        ? `<span class="kg-bookmark-publisher">${conf.publisher || ""
                        }</span>`
                        : ""
                    }
                                                ${conf.date
                        ? `<span class="kg-bookmark-publisher">${conf.date || "2024-10-53"
                        }</span>`
                        : ""
                    }
                                            </div>
                                        </div>
                                        ${conf.thumbnail
                        ? `<div class="kg-bookmark-thumbnail">
                                                <img src="${conf.thumbnail || ""}" alt="Link thumbnail" />
                                            </div>`
                        : ""
                    }
                                    </a>
                                </div>
                            </div>
                        </main>
                    </div>`;
            else {
                return stripNewlinesAndIndents(`
                    <div><style>${css}</style>
                    <main class="kg-card-main">
                        <div class="card">
                                    <a class="kg-bookmark-container" href="${conf.link}">
                                <div class="image">
                                    <img class="img" src="${conf.thumbnail || ''}" alt="">
                                </div>
                                <div class="content">
                                    <h4>${conf.title}</h4>
                                    <div class="description">
                                        ${conf.description || ""}
                                    </div>
                                    <div class="footer">
                                        <div>
                                            <img class="icon" src="${conf.icon}" alt="">
                                            <span class="author"> ${conf.author || ""}
                                                ${conf.publisher || ""}</span>
                                        </div>
                                    </div>
                                </div>
                                    </a>
                        </div>
                    </main>
                </div>`)
            }
        }
    } catch (e) {
        logger.error(e);
        return;
    }
};

export const URLInputDialog = () => {
    return new Promise((resolve, reject) => {
        const dialog = new Dialog({
            title: i18n.insertURLDialogTitle,
            content: `<div class="b3-dialog__content"><textarea class="b3-text-field fn__block" placeholder="Please enter the URL"></textarea></div>
                    <div class="b3-dialog__action">
                    <button class="b3-button b3-button--cancel">${i18n.cancel}</button><div class="fn__space"></div>
                    <button class="b3-button b3-button--text">${i18n.save}</button>
                    </div>`,
            width: "520px",
        });
        const inputElement = dialog.element.querySelector("textarea");
        const btnsElement = dialog.element.querySelectorAll(".b3-button");
        dialog.bindInput(inputElement, () => {
            (btnsElement[1] as HTMLElement).click();
        });
        inputElement.focus();
        btnsElement[0].addEventListener("click", () => {
            dialog.destroy();
            reject();
        });
        btnsElement[1].addEventListener("click", () => {
            dialog.destroy();
            resolve(inputElement.value);
        });
    });
};

export const toggleBookmarkCard = async (protyle: Protyle): Promise<void> => {
    protyle.insert(window.Lute.Caret);

    const currentBlock = getCurrentBlock();
    const id = currentBlock.dataset.nodeId;
    if (!id) {
        throw new Error("No valid block ID found");
    }
    try {
        const link = (await URLInputDialog()) as string;
        if (!link || !regexp.url.test(link)) {
            return;
        }
        try {
            await convertToBookmarkCard(id, link);
            currentBlock.focus();
        } catch (error) {
            logger.error("Error converting to oembed:", { error });
        }
    } catch (error) {
        logger.error("Error toggling oembed link:", { error });
        throw error; // Re-throw to allow caller to handle the error
    }
};

export const convertToOembed = async (id: string, link: string): Promise<void> => {
    if (!id || !link) return;
    try {
        const success = await updateBlock(
            "markdown",
            `[${await fetchUrlTitle(link)}](${link})`,
            id
        );
        if (!success) {
            showMessage(i18n.failure);
        }
        setBlock(id, link)
    } catch (error) {
        logger.error("Failed to convert block to oembed:", { error });
        throw error;
    }
};
export const convertToMiddleBookmarkCard = async (id: string, link: string): Promise<void> => {
    if (!id || !link) return;
    try {
        const skeletonDom = generateSkeletonScreen('middle');
        await updateBlock("dom", skeletonDom, id);
        const dom = await generateBookmarkCard({ link }, 'middle');
        if (!dom) {
            await updateBlock("dom", '', id);
            showMessage(i18n.failure);
            return
        };
        progressStatus(`Converting ${link}`)
        const success = await updateBlock("dom", dom, id);
        if (!success) {
            throw new Error("Failed to update block");
        }
        setBlock(id, link)
    } catch (error) {
        logger.error("Failed to convert block to bookmark card:", { error });
        throw error;
    }
};
export const convertToBookmarkCard = async (id: string, link: string): Promise<void> => {
    if (!id || !link) return;
    try {
        const skeletonDom = generateSkeletonScreen('normal');
        await updateBlock("dom", skeletonDom, id);
        const dom = await generateBookmarkCard({ link }, 'normal');
        if (!dom) {
            await updateBlock("dom", '', id);
            showMessage(i18n.failure);
            return
        };
        progressStatus(`Converting ${link}`)
        const success = await updateBlock("dom", dom, id);

        if (!success) {
            throw new Error("Failed to update block");
        }
        setBlock(id, link)
    } catch (error) {
        logger.error("Failed to convert block to bookmark card:", { error });
        throw error;
    }
};

export const setBlock = async (id: string, link: string) => {
    await setBlockAttrs(id, { [CUSTOM_ATTRS_LINK]: link });
    const element = getElementByBlockId(id);
    focusBlock(element);
    showMessage(i18n.success);
}

export const processSelectedBlocks = async (
    blocks: HTMLElement[],
    processor: (id: string, link: string) => Promise<void>,
) => {
    let link: string = null;
    try {
        const promises = blocks.map(async (item: HTMLElement) => {
            const id = item?.dataset.nodeId;
            if (!id) {
                throw new Error("No valid block ID found");
            }
            try {
                if (isEmptyParagraphBlock(item)) {
                    link = (await URLInputDialog()) as string;
                }
                else {
                    const { isCovered, originalLink } = await isCoveredLink(id);
                    if (isCovered) link = originalLink
                    else
                        link = extractUrlFromBlock(item);

                }
                if (!link || !regexp.url.test(link)) {
                    return;
                }

                try {
                    await processor(id, link);
                } catch (error) {
                    logger.error("Error using link processor:", { error });
                }
            } catch (error) {
                logger.error("Failed to process selected blocks:", { error });
                throw error; // Re-throw to allow caller to handle the error
            }
        });
        await Promise.all(promises);
    } catch (error) {
        logger.error("Error processing blocks:", { error });
    }
};

export const isCoveredLink = async (blockId: string) => {
    const attrs = await getBlockAttrs(blockId);
    const arr_link = attrs?.[CUSTOM_ATTRS_LINK];
    if (!!(arr_link && arr_link.trim() !== "")) {
        return { isCovered: true, originalLink: arr_link }
    }
    return { isCovered: false, originalLink: null };
};

export const fetchUrlTitle = async (url: string): Promise<string> => {
    if (!(url.startsWith("http") || url.startsWith("https"))) {
        url = "https://" + url;
    }
    try {
        let data = await forwardProxy(
            url,
            "GET",
            null,
            [
                {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                },
            ],
            5000,
            "text/html"
        );
        if (!data || data.status !== 200) {
            return "";
        }

        data.headers["Content-Type"].forEach((ele) => {
            if (!ele.includes("text/html")) {
                return getUrlFinalSegment(url);
            }
        });
        let html = data?.body;

        const doc = new DOMParser().parseFromString(html, "text/html");
        const title = doc.querySelectorAll("title")[0];

        if (title == null || blank(title?.innerText)) {
            // If site is javascript based and has a no-title attribute when unloaded, use it.
            var noTitle = title?.getAttribute("no-title");
            if (notBlank(noTitle)) {
                return noTitle;
            }

            // Otherwise if the site has no title/requires javascript simply return Title Unknown
            return "";
        }

        return title.innerText.replace(/(\r\n|\n|\r)/gm, "").trim();
    } catch (ex) {
        logger.error("Error fetching URL title:", { ex });
        return "";
    }
};

export const generateSkeletonScreen = (type: string) => {
    const css = type === 'middle' ? stripNewlinesAndIndents(skeletonMiddleBookmarkCardStyle) : stripNewlinesAndIndents(skeletonBookmarkCardStyle);
    const dom = `
<div>
    <style>
        ${css}
    </style>
        <main class="kg-card-main">
            <div class="card loading">
                <div class="image">
                </div>
                <div class="content">
                    <h4></h4>
                    <div class="description">

                    </div>
                </div>
            </div>
        </main>
</div>`
    return dom;
}


